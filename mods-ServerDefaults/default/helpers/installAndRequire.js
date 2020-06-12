// TODO:  Add installing under aliases for different versions of the same NPM install.  See here:  https://stackoverflow.com/questions/26414587/how-to-install-multiple-versions-of-package-using-npm

// This script will check to ensure a module can be required, and if not attempt to install it with NPM.
// When it is available, it will return the module, otherwise it will exit the script with an error displayed.
// If a specific version is desired, this can be included
module.exports = installAndRequire;

const fs = require('fs');
const child = require('child_process');
const path = require('path');

if (__filename == require.main.filename){
  console.log("This script cannot be ran by itself!  Exiting!");
  process.exit();
}

var mainDirName = path.dirname(require.main.filename);

function isModuleAvailableSync(moduleName) { // Based on code from: https://stackoverflow.com/questions/15302618/node-js-check-if-module-is-installed-without-actually-requiring-it
  var ret = false; // return value, boolean
  module.paths.forEach(function(nodeModulesPath) { // scan each module.paths. If there exists node_modules/moduleName then return true. Otherwise return false.
    if(fs.existsSync(path.join(nodeModulesPath,moduleName)) === true) {
        ret = true;
        return false; // break forEach
    }
    return true; // Added to make ESLint happy.  This is NOT the return value for the base function.
  });
  return ret;
}
function installAndRequire(theModule,version){  // This should only ever be ran on modules that are installable through NPM
  // npm install lodash@^4.0.0
  // example:  installAndRequire("lodash","^4.0.0");
  var verToUse="";
  var verText="";
  if (typeof version == "string"){
    verToUse="@" + version;
    verText=" Version: " + version;
  }
  if (isModuleAvailableSync(theModule) == false){
    try {
      process.stdout.write("Installing required module: " + theModule + verText);
      child.execSync('npm install --save ' + theModule + verToUse,{"cwd": mainDirName});
      process.stdout.write(" ..Done!\n");
    } catch(error) {
      console.error("ERROR installing module, " + theModule + "! Exiting!");
      throw error;
    }
  }
  // console.log("Loading module: " + theModule);
  return require(theModule);
}
