/**
 * Created by sharad on 9/23/17.
 */

const DependencyScanner = require('../index');
const ds = new DependencyScanner();
const assert = require('chai').assert;

/**
 * Note : The tests below are only to be executed from top level directory as there are fs paths used
 * All paths are relative relative to process.cwd() and hence test must be run from top level dir
 */


describe("lambda-packager-tests", function () {
    it("test happy path", function (done) {
        ds.scanv3("tests/sample-lambda-no-config", function (err) {
            if(err) {
                throw err;
            }
            done();
        }, "tests/sample-lambda-no-config/dist");
    });

    it("test with config", function (done) {
        ds.scanv3("tests/sample-lambda-with-config", function (err) {
            if(err) {
                throw err;
            }
            done();
        }, "tests/sample-lambda-with-config/dist");
    });

    it("test no config def lib", function (done) {
        ds.scanv3("tests/sample-lambda-no-config-def-modules", function (err) {
            if(err) {
                throw err;
            }
            done();
        }, "tests/sample-lambda-no-config-def-modules/dist");
    });

    it("test missing npm deps", function (done) {
        ds.scanv3("tests/sample-lambda-missing-dep", function (err) {
            assert(err.message === 'Looks like npm installation for :colors is not successful .. could not find module dir in top level dir or nested dir')
            done();
        }, "tests/sample-lambda-missing-dep/dist");
    });
});