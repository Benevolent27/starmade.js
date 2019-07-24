
// This script can be run independently or as a require for another script.  It returns all results as STDOUT.

module.exports=runStarNetReturn;  // Always put module.exports at the top so circular dependencies work correctly.

const path=require('path');
const child=require('child_process');
const fs=require('fs');

var binFolder=path.resolve(__dirname);
var starNetJar=path.join(binFolder,"StarNet.jar");
// var settings=require(path.resolve(__dirname,"../settings.json"));
var ini=require(path.join(binFolder,"iniHelper.js"));
var objHelper=require(path.join(binFolder,"objectHelper.js"));

// For any variables that rely on a configuration file or settings file, we need to ensure they only try to pull the information AFTER the files actually exist, such as after the install routine has had a chance to work.
var settings={}; // placeholder to be filled in with actual settings later
function getSettings(){
  if (!objHelper.isObjEmpty(settings)){ // If the settings were already pulled in, just return them
    return settings;
  }
  let theFile=path.resolve(__dirname,"../settings.json");
  if (fs.existsSync(theFile)){ // If not required, and it has been created, then require it in now and set the variable.
    settings=require(theFile);
    return settings;
  }
  return {}; // If the file has not been created yet, then just return an empty object.  The install routine will set up the settings file before starNet.js should be used.
}
// var starmadeServerCfg=path.join(settings["starMadeFolder"],"StarMade","server.cfg");
var starmadeServerCfg=""; // Placeholder for the config path
function getStarmadeServerCfg(){
  if (starmadeServerCfg){
    return starmadeServerCfg;
  }
  if (!objHelper.isObjEmpty(getSettings())){
    starmadeServerCfg=path.join(getSettings()["starMadeFolder"],"StarMade","server.cfg");
    return starmadeServerCfg;
  }
  console.error("No settings file set up.  Cannot grab server config!");
  return null;
}

// var starMadeServerCfgObj=ini.getFileAsObj(starmadeServerCfg);
var starMadeServerCfgObj={};
function getStarMadeServerCfgObj(){ // We're using a latch variable setter and retreiver so that when this script is required in, BEFORE the server config has been created, it won't error out, but instead nothing happens.
  if (!objHelper.isObjEmpty(starMadeServerCfgObj)){
    return starMadeServerCfgObj;
  } else if (getStarmadeServerCfg()){
    if (fs.existsSync(starmadeServerCfg)){
      starMadeServerCfgObj=ini.getFileAsObj(starmadeServerCfg);
      return starMadeServerCfgObj;
    }
  }
  return {}; // Return an empty object since it has not been set up yet.
}

// var superAdminPassword=ini.getVal(starMadeServerCfgObj,"SUPER_ADMIN_PASSWORD");
var superAdminPassword="";
function getSuperAdminPassword(){ // We're using a latch variable setter and retreiver so that when this script is required in, BEFORE the server config has been created, it won't error out, but instead nothing happens.
  if (superAdminPassword){
    return superAdminPassword;
  } else if (!objHelper.isObjEmpty(getStarMadeServerCfgObj())){
    superAdminPassword=ini.getVal(starMadeServerCfgObj,"SUPER_ADMIN_PASSWORD");
    return superAdminPassword;
  }
  return "";
}
module.debug=false;

if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.
  // Initialize the variables
  getStarmadeServerCfg();
  getStarMadeServerCfgObj();
  getSuperAdminPassword();
  var clArguments=process.argv.slice(2);
  if (clArguments){
    for (let i=0;i<clArguments.length;i++){
      // console.log("Running on argument: " + clArguments[i]);
      // runStarNet(clArguments);
      var tempResultsString=runStarNetReturn(clArguments);
      // console.log("Results String: " + tempResultsString);
      var tempResultsArray=tempResultsString.split("\n");
      for (let i=0;i<tempResultsArray.length;i++){
        // console.log("Line " + i + ": " + tempResultsArray[i]);
        console.log(tempResultsArray[i]);
      }
    }
  }
}

// Obsoleting
// function runStarNet(command){
//   // This is an attempt at making an async type function.  You can't capture the output from it, it's just for display purposes only.
//   // This sort of formula can be used though to write the data to a stream and process it that way as it comes in.  This is would be useful for SQL queries that can get rather large.
//   if (command){
//     var results=child.spawn("java",["-jar",starNetJar,"127.0.0.1:" + settings["port"],superAdminPassword,command],{"cwd":binFolder});
//     results.stdout.on('data',function(data){
//       process.stdout.write(data);
//     });
//     results.stderr.on('data',function(data){
//       process.stdout.write(data);
//     });
//   }
// }
function runStarNetReturn(command,options){
  // Options are passed as an array.  Eg. {debug:true}
  var debug=false;
  if (module.debug){
    debug=true;
  } else if (objHelper.isObjHasPropAndEquals(options,"debug",true)){ // checks if any value was passed as an object, if it has a property "debug", and if that property strictly equals true
    debug=true
  }
  if (command){
    if (getSuperAdminPassword()){
      var results=child.spawnSync("java",["-jar",starNetJar,"127.0.0.1:" + settings["port"],getSuperAdminPassword(),command],{"cwd":binFolder});
      if (debug == true){ process.stdout.write(results.stderr.toString()); }
      // return results.stderr.toString().trim();
      return results.stderr.toString().trim().replace(/(\r)/g,""); // This is needed for windows
    }
    console.error("No super admin password established yet!  Can't do anything!");
  }
  return false;
}
// Obsoleting
// function ReturnObj(theArray){
//   var tempArray=theArray;
//   this.columns=tempArray.shift();
//   this.data=tempArray;
// }
