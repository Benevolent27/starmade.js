
// This script can be run independently or as a require for another script.  It returns all results as STDOUT.

const path=require('path');
const child=require('child_process');

var binFolder=path.resolve(__dirname);
var starNetJar=path.join(binFolder,"StarNet.jar");
var settings=require(path.resolve(__dirname,"../settings.json"));
var ini=require(path.join(binFolder,"iniHelper.js"));
var starmadeServerCfg=path.join(settings["starMadeFolder"],"StarMade","server.cfg");

var starMadeServerCfgObj=ini.getFileAsObj(starmadeServerCfg);
var superAdminPassword=ini.getVal(starMadeServerCfgObj,"SUPER_ADMIN_PASSWORD");

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
function runStarNetReturn(command){
  var outputArray=[];
  if (command){
    var results=child.spawnSync("java",["-jar",starNetJar,"127.0.0.1:" + settings["port"],superAdminPassword,command],{"cwd":binFolder});
    return results.stderr.toString().trim();
    // var tempArray=results.stderr.toString().split("\n");
    // // Trim the top
    // while (tempArray.length > 0 && !"/^RETURN: \SERVER, SQL#/".test(tempArray[0])){
    //   tempArray.shift();
    // }
    // // Trim the bottom
    // while (tempArray.length > 0 && !"/^RETURN: [SERVER, SQL#/".test(tempArray[tempArray.length-1])){
    //   tempArray.pop();
    // }
    // for (let i=0;i<tempArray.length;i++){
    //   tempArray[i]=tempArray[i].replace(/(^RETURN: \[SERVER, SQL#[0-9]+: ")|(", 0\]$)/g,"").split('";"');
    // }
    // return new ReturnObj(tempArray);
  }
  return false;
}
function ReturnObj(theArray){
  var tempArray=theArray;
  this.columns=tempArray.shift();
  this.data=tempArray;
}

module.exports=runStarNetReturn;
