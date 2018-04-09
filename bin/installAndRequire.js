// This script will check to ensure a module can be required, and if not attempt to install it with NPM.
// When it is available, it will return the module, otherwise it will exit the script with an error displayed.
const fs = require('fs');
const child = require('child_process');
const path = require('path');
var mainDirName = path.dirname(require.main.filename);

function isModuleAvailableSync(moduleName) { // Based on code from: https://stackoverflow.com/questions/15302618/node-js-check-if-module-is-installed-without-actually-requiring-it
  var ret = false; // return value, boolean
  // var dirSeparator = require("path").sep
  // scan each module.paths. If there exists
  // node_modules/moduleName then
  // return true. Otherwise return false.
  module.paths.forEach(function(nodeModulesPath) {
    if(fs.existsSync(path.join(nodeModulesPath,moduleName)) === true) {
        ret = true;
        return false; // break forEach
    }
    return true; // Added to make ESLint happy.. not sure if it will break the code or what.
  });
  return ret;
}
function installAndRequire(theModule){  // This should only ever be ran on modules that are installable through NPM
  if (isModuleAvailableSync(theModule) == false){
    try {
      process.stdout.write("Installing required module: " + theModule);
      child.execSync('npm install --save ' + theModule,{"cwd": mainDirName});
      process.stdout.write(" ..Done!\n");
    } catch(error) {
      console.error("ERROR installing module, " + theModule + "! Exiting!");
      console.error("Error returned: " + error)
      process.exit(130);
    }
  }
  console.log("Loading module: " + theModule);
  return require(theModule);
}
module.exports = installAndRequire;
