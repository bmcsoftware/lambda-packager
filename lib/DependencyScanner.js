#!/usr/bin/env node
/**
 * Created by sharad on 9/12/16.
 */

const fs = require('fs');
const JSZip = require('jszip');
const MODULE_DIR = 'modules';
const MODULE_DIR_ALTERNATE = 'src';
const MODULE_DIR_ALTERNATE2 = 'lib';
var DIST_DIR = "dist";


function Set(){
    this._data = [];
}

Set.prototype.add = function(t){
    if(this._data.indexOf(t) === -1){
        this._data.push(t);
        return true;
    }
    return false;
};
Set.prototype.exists = function(t){
    return !(this._data.indexOf(t) === -1);
};

var parallel = function( tasks , cb, timeout){
    if(typeof cb !== 'function') { throw new Error('callback must be of type function, found:' + typeof cb);}
    if(tasks == null || Object.keys(tasks).length === 0){
        cb(undefined, {});
        return;
    }

    var results = {
        metrics : {
            durations: {},
            timedOut: false
        }
    };
    var callbackSent = false;

    var taskStartTime = new Date().getTime();
    if(timeout){
        var timeoutCb = setTimeout(function(){
            var taskEndTime = new Date().getTime();
            // if we have come here clear timeout has not been called , so cb also has not been called
            console.warn('About to timeout Async invocation ...');
            callbackSent = true;
            results.metrics.timedOut = true;
            results.metrics.durations['totalDuration'] = (taskEndTime - taskStartTime);
            cb(undefined, results);
            clearTimeout(timeoutCb);
        }, timeout);
    }
    var taskNames = Object.keys(tasks);


    taskNames.forEach(function(taskName){
        tasks[taskName](function(){
            //console.log('type of args :' + typeof arguments + ", JSON :" + JSON.stringify(arguments, null,2) + ', length :' + arguments.length);
            results[taskName] = arguments;
            var taskEndTime = new Date().getTime();
            results.metrics.durations[taskName] = (taskEndTime - taskStartTime);
            if( Object.keys(results).length === taskNames.length + 1){
                //console.log('About to send cb :' + JSON.stringify(results, null, 2));
                if(!callbackSent) {
                    clearTimeout(timeoutCb);
                    results.metrics.durations['totalDuration'] = (taskEndTime - taskStartTime);
                    cb(undefined , results);
                }
            }
        });
    });
};

function DependencyScanner(){
}

var unique = function(array) {
    var retArr = [];
    for(var i=0;i<array.length;i++){
        if(retArr.indexOf(array[i]) === -1){
            retArr.push(array[i]);
        }
    }
    return retArr;
};

var getStats = function(path){
    var stats = null;
    try {
        stats = fs.statSync(path);
    } catch(err){
        // path does not exists
    }
    return stats;
};

var scanSync = function(root , name, scanned) {
    name = name ? name : root;
    var packageJsonPath = name + '/package.json';
    if(!scanned){
        scanned = new Set();
    }
    //console.log("----- About to scan for :" + packageJsonPath);

    var stats = fs.statSync(packageJsonPath);

    if(name !== root){
        if(!scanned.add(name)){
            return;
        }
    }

    if(stats && stats.isFile()){
        var packageJson = JSON.parse(fs.readFileSync(packageJsonPath , 'utf-8'));
        var dependencies = !packageJson['dependencies'] ? [] : Object.keys(packageJson['dependencies']);
        var bundledDependencies = !packageJson['bundledDependencies'] ? [] : packageJson['bundledDependencies'];
        var bundleDependencies = !packageJson['bundleDependencies']? [] : packageJson['bundleDependencies'];
        var mergedArray = unique(dependencies.concat(bundledDependencies).concat(bundleDependencies));

        //console.log('scan path :' + name);
        //console.log('----- @@ scanned COUNT - PRE :' + scanned._data.length + ", mergedArray COUNT :" + mergedArray.length);
        //console.log('Will scan next :' + mergedArray);

        for(var i=0;i<mergedArray.length;i++){
            var nestedPath = name +'/node_modules/'+mergedArray[i];
            var simplePath = root + '/node_modules/'+mergedArray[i];
            var stat = getStats(simplePath);
            if(stat) {
                if(!scanned.exists(simplePath)) {
                    scanSync(root, simplePath , scanned);
                }
            } else {
                stat = getStats(nestedPath);
                if(stat){
                    if(!scanned.exists(nestedPath)) {
                        scanSync(root, nestedPath , scanned);
                    }
                } else {
                    console.log('Looks like npm installation for :' + mergedArray[i] + ' is not successful .. could not find module dir in top level dir or nested dir');
                    throw new Error('Looks like npm installation for :' + mergedArray[i] + ' is not successful .. could not find module dir in top level dir or nested dir');
                }
            }
        }
    }
    // console.log('----- @@ scanned COUNT - POST :' + scanned._data.length +  ", mergedArray COUNT :" + mergedArray.length);
    var distName = packageJson['name'] +"-"+ packageJson['version'] + '.zip';
    return {'deps': scanned , distName:distName};
};

var mkDir = function(directory) {
    if (!fs.existsSync(directory)){
        fs.mkdirSync(directory);
    }
};

var addDir = function(root , path, zipPath , zip, cb){
    var dirCount = 1;
    var fileCount =0;
    function addToZip(path, zipPath, cb){
        // console.log('@@@@ -- SPS addToZip invoked with  :' + path);
        var statsParent = fs.statSync(path);
        if(statsParent.isDirectory()){
            fs.readdir(path , function(err , filePaths){
                if(err) {
                    throw err;
                }
                dirCount--;
                filePaths.forEach(function(dirPath){
                    var effectivePath = path + '/' + dirPath;
                    fs.stat(effectivePath, function(err, stat){
                        //console.log('@@@ - STAT :' + JSON.stringify(stat, null, 2));
                        if(stat.isFile()){
                            fileCount++;
                            //console.log('--- stat :' + dirPath + "-- FILE :" + effectivePath);
                            fs.readFile(effectivePath, function(err, data){
                                if(err){
                                    return cb(err);
                                }
                                //console.log('effective path :' + effectivePath + ', data :' + data.length+ ", dirCount :" + dirCount+", fc:"+fileCount);
                                var pathInZip = effectivePath;
                                if(zipPath){
                                    pathInZip = zipPath + '/' + dirPath;
                                }
                                zip.file(pathInZip, data, {binary:true});
                                fileCount--;
                                if(fileCount === 0 && dirCount === 0){
                                    cb(null);
                                }
                            });
                        } else if(stat.isDirectory()) {
                            dirCount++;
                            //console.log('--- stat :' + dirPath + '-- DIR, dirCount:' + dirCount);
                            var pathInZip = null;
                            if(zipPath) {
                                pathInZip = zipPath + '/' + dirPath;
                            }
                            addToZip(effectivePath, pathInZip, cb);
                        }
                    });
                });
            });
        } else {
            fs.readFile(path, function(err, data){
                if(err){
                    return cb(err);
                }
                zip.file(zipPath, data, {binary:true});
                cb(null);
            });
        }

    }
    console.log("pushing :" + root + "/" + path + ", to :" + zipPath);
    addToZip(root + "/" + path, zipPath, cb);
};

var addDependencies = function(root, dependencies, zip, packageConfigData, cb){
    var tasks = {};
    var destinationRoot = null;
    if(packageConfigData) {
        var includes = packageConfigData.include;
        destinationRoot = packageConfigData.destination_root;
        if(includes && Array.isArray(includes)) {
            includes.forEach(function(include){
                console.log( "Adding config item :" + include.source + " to " + include.dest);
                tasks[include.source] = function(asyncCB){
                    addDir(root, include.source, include.dest, zip, asyncCB);
                }
            });
        }
    } else {
        var stat = null;
        var moduleDir = null;
        console.log("Searching for modules dir ...");
        try {
            console.log("testing modules dir :" + root + "/" + MODULE_DIR);
            stat = fs.statSync(root + "/" + MODULE_DIR);
            if(stat.isDirectory()) {
                moduleDir = MODULE_DIR;
            }
        } catch(err){
            try {
                console.log("testing modules dir :" + root + "/" + MODULE_DIR_ALTERNATE);
                stat = fs.statSync(root + "/" + MODULE_DIR_ALTERNATE);
                if(stat.isDirectory()) {
                    moduleDir = MODULE_DIR_ALTERNATE;
                }
            } catch(err) {
                console.log("testing modules dir :" + root + "/" + MODULE_DIR_ALTERNATE2);
                try {
                    stat = fs.statSync(root + "/" + MODULE_DIR_ALTERNATE2);
                    if(stat.isDirectory()) {
                        moduleDir = MODULE_DIR_ALTERNATE2;
                    }
                } catch(err){
                }
            }
        }
        console.log("--- Default modules dir picked :" + moduleDir);
        if(moduleDir) {
            tasks[MODULE_DIR] = function(asyncCB){
                addDir(root, moduleDir, moduleDir, zip, asyncCB);
            };
        }
    }
    dependencies.forEach(function(dep){
        tasks[dep] = function(asyncCB){
            var zipPath = dep.substr(root.length + 1);
            if(destinationRoot){
                zipPath = destinationRoot+"/"+zipPath;
            }
            addDir(root, dep.substr(root.length + 1), zipPath, zip, asyncCB);
        }
    });
    parallel(tasks, cb);
};

DependencyScanner.prototype.scanv3 = function(path, cb, distDir){
    var startime = new Date().getTime();
    var root = path ? path : process.cwd();
    console.log('Scanning for dependencies ...');
    try  {
        var scanRes = scanSync(root, path);
    } catch(err) {
        if(typeof cb === 'function') {
            return process.nextTick(function () {
                cb(err);
            });
        }
        else
            throw err;
    }

    console.log('Scanned paths :\n' + JSON.stringify(scanRes, null, 2));

    var bundleDependencies = scanRes.deps;
    if(distDir) {
        DIST_DIR = distDir;
    }
    mkDir(DIST_DIR);
    var distName = DIST_DIR + "/" + scanRes.distName;
    console.log('Scan completed, total dependencies :' + bundleDependencies._data.length);
    console.log('Total dependencies scanned :' + bundleDependencies);

    var packageConfigData = null;
    if(fs.existsSync(root + '/package.config')){
        console.log('package config exists ...');
        var packageConfig = fs.readFileSync(root + '/package.config' , 'utf-8');
        packageConfigData = JSON.parse(packageConfig);
    }
    var packageJsonData = fs.readFileSync(root + '/package.json' , 'utf-8');
    var packageJson = JSON.parse(packageJsonData);
    var zip = new JSZip();
    var packageJsonZipPath = 'package.json';
    if(packageConfigData && packageConfigData.destination_root){
        packageJsonZipPath = packageConfigData.destination_root + "/"+packageJsonZipPath;
    }
    zip.file(packageJsonZipPath, packageJsonData);
    if(packageJson['readmeFilename']){
        var zipPath = packageJson['readmeFilename'];
        if(packageConfigData && packageConfigData.destination_root){
            zipPath = packageConfigData.destination_root + "/"+zipPath;
        }
        zip.file(zipPath , fs.readFileSync(packageJson['readmeFilename'] , 'utf-8'));
    }
    if(packageJson['main']) {
        var zipPath = packageJson['main'];
        if(packageConfigData && packageConfigData.destination_root){
            zipPath = packageConfigData.destination_root + "/"+zipPath;
        }
        var mainFile = path ? path + "/" +  packageJson['main'] : packageJson['main'];
        console.log( "mainfile :" + mainFile);
        zip.file(zipPath, fs.readFileSync(mainFile , 'utf-8'));
    }

    console.log('Adding node modules to zip ...');
    addDependencies(root, bundleDependencies._data, zip, packageConfigData, function(err,data){
        console.log('About to create zip ...');
        if(err) {
            if(typeof cb === 'function') {
                return cb(err);
            } else {
                throw err;
            }
        }
        zip.generateNodeStream({compression: 'DEFLATE', streamFiles:true})
            .pipe(fs.createWriteStream(distName))
            .on('finish', function () {
                var endtime = new Date().getTime();
                console.log("out.zip written. total duration :"  +(endtime - startime));
                if(typeof cb === 'function') cb();
            });
    });
};

module.exports = DependencyScanner;


