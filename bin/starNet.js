
// This script can be run independently or as a require for another script.  It returns all results as STDOUT.

module.exports=runStarNetReturn;  // Always put module.exports at the top so circular dependencies work correctly.

const path=require('path');
const child=require('child_process');

var binFolder=path.resolve(__dirname);
var starNetJar=path.join(binFolder,"StarNet.jar");
var settings=require(path.resolve(__dirname,"../settings.json"));
var ini=require(path.join(binFolder,"iniHelper.js"));
var objHelper=require(path.join(binFolder,"objectHelper.js"));


var starmadeServerCfg=path.join(settings["starMadeFolder"],"StarMade","server.cfg");
var starMadeServerCfgObj=ini.getFileAsObj(starmadeServerCfg);
var superAdminPassword=ini.getVal(starMadeServerCfgObj,"SUPER_ADMIN_PASSWORD");

module.debug=false;

if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.
  var clArguments=process.argv.slice(2);
  if (clArguments){
    for (let i=0;i<clArguments.length;i++){
      // console.log("Running on argument: " + clArguments[i]);
      // runStarNet(clArguments);
      var tempResultsString=runStarNetReturn(clArguments);
      // console.log("Results String: " + tempResultsString);
      var tempResultsArray=tempResultsString.split("\n");
      for (let i=0;i<tempResultsArray.length;i++){
        console.log("Line " + i + ": " + tempResultsArray[i]);
      }
    }
  }
}

function runStarNet(command){
  // This is an attempt at making an async type function.  You can't capture the output from it, it's just for display purposes only.
  // This sort of formula can be used though to write the data to a stream and process it that way as it comes in.  This is would be useful for SQL queries that can get rather large.
  if (command){
    var results=child.spawn("java",["-jar",starNetJar,"127.0.0.1:" + settings["port"],superAdminPassword,command],{"cwd":binFolder});
    results.stdout.on('data',function(data){
      process.stdout.write(data);
    });
    results.stderr.on('data',function(data){
      process.stdout.write(data);
    });
  }
}
function runStarNetReturn(command,options){
  // Options are passed as an array.  Eg. {debug:true}
  var debug=false;
  if (module.debug){
    debug=true;
  } else if (objHelper.isObjHasPropAndEquals(options,"debug",true)){ // checks if any value was passed as an object, if it has a property "debug", and if that property strictly equals true
    debug=true
  }
  if (command){
    var results=child.spawnSync("java",["-jar",starNetJar,"127.0.0.1:" + settings["port"],superAdminPassword,command],{"cwd":binFolder});
    if (debug == true){ process.stdout.write(results.stderr.toString()); }
    return results.stderr.toString().trim();
  }
  return false;
}
function ReturnObj(theArray){
  var tempArray=theArray;
  this.columns=tempArray.shift();
  this.data=tempArray;
}
