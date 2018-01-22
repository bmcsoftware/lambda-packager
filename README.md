# aws-lambda-packager
![alt text](https://img.shields.io/badge/coverage-81%25-green.svg?style=flat)

## Synopsis
A node module to package node js lambdas.

## Motivation
The size of a node js lambda bundle is critical when it comes to cold starts. Thus its imperative that we only bundle bare minimum files. **aws-lambda-packager** attempts to solve this problem. Key features includes the following

+ Intelligently package required npm dependencies
+ Add any additional resources as applicable
+ works with flat node_modules or with hierarchical node_modules
 
## Getting Started 

### Prerequisites
The project assumes that one must have node js installed on the target environment.

### Build and Run

#### Build Instructions
 
No special build steps are required.
 
### Tests

 To run the tests, you can use the command 
 
 ```
    npm test
 ```
The above triggers tests/index.test.js using *mocha* test framework.

## Usage
### Cli Usage
```
npm install -g aws-lambda-packager
```

Form your project dir
```
aws-lambda-packager
```

The above will run package modules using default configurations. The default configurations assumes the following

1. main js file shall be derived from package.json main attribute
1. source dir shall be either of src | modules | lib
1. destination directory shall be dist
1. destination file shall be derived from package.json as <name><version>.zip
 
The above behaviour can be tweaked using a configuration file. The config file must be called package.config and must be present on root dir from where packager will be run. The configuration file looks something as shown below
 
```
{
	"include" :[
		{
			"source": "modules",
			"dest": "collector/modules"
		},
		{
			"source": "config",
			"dest": "config"
		},
		{
			"source": "cfn",
			"dest": "cfn"
		},
		{
			"source": "binaries/run.bat",
			"dest": "run.bat"
		},
		{
			"source": "binaries/run.sh",
			"dest": "run.sh"
		},
		{
			"source": "contents",
			"dest": "contents"
		}
	],
	"destination_root":"collector"
}

```
#### destination_root
This attribute can be used to define a single root within which all project files shall be placed. So, if this attribute is set, index.js( main ) and node_modules shall be placed under this directory

#### include
This attribute can be used too add any other dependencies that might be needed.
    
#### node_modules
The packager shall start with top level package.json and traverse all package.json in the project dir to bundle required packages. The packager only bundles dependencies, bundleDependency, bundledDependencies.    

### Code usage
```
const DependencyScanner = require('aws-lambda-packager');
const ds = new DependencyScanner();

ds.scanv3("SOURCE_DIR", function (err) {
    // do something on completion
}, "DEST_DIR");

```

### Limitation
There may be instances when an external npm dependency does not correctly defines its dependencies. For example a required dependency may be by mistake mentioned as dev-dependency. This will cause the required package to not get bundled. To work around this problem, you can add the trouble some dependency as top level dependency.

## Contributors
Feel free to fork/clone the repo and provide your contributions.
In order to make contributions, please follow these steps
  1.  Submit an issue describing your proposed changes
  2.  The repo owner will respond to your issue promptly
  3.  If your proposed change is accepted, fork the repo, develop and test your changes
  4.  Submit a pull request

## License
Lambda Packager is under the Apache License 2.0.  See the [LICENSE](LICENSE) file for details.
