
// This script can be run independently or as a require for another script.  It returns all results as STDOUT.

// module.exports=starNetSync;  // Always put module.exports at the top so circular dependencies work correctly.

// Adding starnet options, sync, cb, and later promises
module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  "starNetSync":starNetSync,
  "starNetCb":starNetCb
};

const path=require('path');
const child=require('child_process');
const fs=require('fs');

var binFolder=path.resolve(__dirname);
var starNetJar=path.join(binFolder,"StarNet.jar");
// var settings=require(path.resolve(__dirname,"../settings.json"));
var ini=require(path.join(binFolder,"iniHelper.js"));
var objHelper=require(path.join(binFolder,"objectHelper.js"));
var {getOption,testIfInput,simplePromisifyIt,toStringIfPossible}=objHelper;

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
var ipToUse="";
function getIpToUse(){ // We're using a latch variable setter and retreiver so that when this script is required in, BEFORE the server config has been created, it won't error out, but instead nothing happens.
  
  if (ipToUse){
    return ipToUse;
  } else if (!objHelper.isObjEmpty(getStarMadeServerCfgObj())){
    ipToUse=ini.getVal(starMadeServerCfgObj,"SERVER_LISTEN_IP");
    if ((/^all$/i).test(ipToUse.trim())){ // If "any" is used, then sending it to the localhost should work fine.
      ipToUse="127.0.0.1";
    }
    return ipToUse;
  }
  return "127.0.0.1"; // I'm guessing if this field is left blank, starmade will revert to using "any".  But if not, then it should crash, so this doesn't matter then.
}
module.debug=false;

if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.
  // Initialize the variables
  // getStarmadeServerCfg();
  // getStarMadeServerCfgObj();
  // getSuperAdminPassword();
  // var clArguments=process.argv.slice(2);
  // if (clArguments){
  //   for (let i=0;i<clArguments.length;i++){
  //     // console.log("Running on argument: " + clArguments[i]);
  //     // runStarNet(clArguments);
  //     var tempResultsString=starNetSync(clArguments);
  //     // console.log("Results String: " + tempResultsString);
  //     var tempResultsArray=tempResultsString.split("\n");
  //     for (let i=0;i<tempResultsArray.length;i++){
  //       // console.log("Line " + i + ": " + tempResultsArray[i]);
  //       console.log(tempResultsArray[i]);
  //     }
  //   }
  // }
  // console.log("Running command: " + process.argv.slice(2));
  starNetCb(process.argv.slice(2),"",function(err,result){
    if (err){
      throw err;
    }
    console.log(result);
    process.exit();
  });
  
}
function starNetCb(command,options,cb){ // If no CB given, returns a promise.
  if (typeof cb=="function"){
    var processArray=[];
    if (testIfInput(command)){
      var theCommandToUse=toStringIfPossible(command);
      if (typeof theCommandToUse=="string"){
        var simulateProblem=getOption(options,"simulateProblem","none").toLowerCase(); // For testing purposes only to ascertain errors
        var theParameters;
        if (getSuperAdminPassword()){
          if (simulateProblem == "none"){
            theParameters=["-jar",starNetJar,getIpToUse() + ":" + settings["port"],getSuperAdminPassword(),command];
          } else if (simulateProblem=="wrongip"){ // Destination unreachable
            console.log("### Simulating wrong ip -- destination unreachable ###");
            theParameters=["-jar",starNetJar,"128.0.0.1:" + settings["port"],getSuperAdminPassword(),command];
          } else if (simulateProblem=="wrongport"){ // Refused connection
            console.log("### Simulating wrong port -- refused connection ###");
            theParameters=["-jar",starNetJar,getIpToUse() + ":" + 6767,getSuperAdminPassword(),command];
          } else if (simulateProblem=="wrongsuperadminpassword"){
            console.log("### Simulating wrong super admin password ###");
            theParameters=["-jar",starNetJar,getIpToUse() + ":" + settings["port"],"This is wrong",command];
          } else if (simulateProblem=="wrongparameters"){
            // invalid parameters
            console.log("### Simulating bad parameters ###");
            theParameters=["-jar",starNetJar,"This is wrong",command];
          } else {
            var theError=new Error("Invalid problem given to simpulate!");
            console.error(theError);
            return cb(theError,null);
          }
          return child.execFile("java",theParameters,{"cwd":binFolder},function(error,stdout,stderr){
            var stdOutArray=[];
            var stdErrArray=[];
            if (testIfInput(stdout)){ // Normally there is never stdout
              var stdOutString=stdout.toString().trim().replace(/(\r)/g,"");
              stdOutArray=stdOutString.split("\n"); // Sometimes more than 1 line is included in each output
              for (let i=0;i<stdOutArray.length;i++){
                if (stdOutArray[i] != "" && typeof stdOutArray[i] == "string"){
                  processArray.push(stdOutArray[i]);
                }
              }
            }
            if (testIfInput(stderr)){ // Normally only stderr outputs from StarNet.jar for some reason
              var stdErrString=stderr.toString().trim().replace(/(\r)/g,"");
              stdErrArray=stdErrString.split("\n"); // Sometimes more than 1 line is included in each output
              for (let i=0;i<stdErrArray.length;i++){
                if (stdErrArray[i] != "" && typeof stdErrArray[i] == "string"){
                  processArray.push(stdErrArray[i]);
                }
              }
            }
            var returnString=processArray.join("\n");
            if (error){ // This normally does not happen, even on a connection issue.  
              // The return value needs to be processed further to determine if there was any problem.
              // The only reason there might be an error is if the file cannot be ran or something.
              var theErrorText;
              if (error.status){ // Any non-zero value will mean abnormal process termination.  This should pretty much never happen.
                theErrorText="StarNet exited with code: " + error.status;
              } else if (error.signal){ // results.status will be null if the process was killed
                theErrorText="StarNet was killed with signal: " + error.signal;
              }
              var theError=new Error(theErrorText); // Not sure if this is necessary.
              console.dir(theError);
              return cb(error,returnString);
            } else {
              return cb(null,returnString);
            }
          });
        } else {
          var theError2=new Error("No super admin password established yet!  Can't do anything!");
          console.dir(theError2);
          return cb(theError2,null);
        }
      }
      return cb(new Error("Invalid input given as command to starNet function!  Please provide a VALID command!"));
    }
    return cb(new Error("No command given to starNet function!  Please provide a command!"));
  } else {
    return simplePromisifyIt(starNetCb,options,command);
  }
}


function starNetSync(command,options){ // This should never be used.  Use the CB/Promise version
  // Options are passed as an array.  Eg. {debug:true}
  var debug=false;
  if (module.debug){
    debug=true;
  } else if (objHelper.isObjHasPropAndEquals(options,"debug",true)){ // checks if any value was passed as an object, if it has a property "debug", and if that property strictly equals true
    debug=true
  }
  // console.dir(options);
  // console.dir(command);
  var simulateProblem=getOption(options,"simulateProblem","none").toLowerCase(); // For testing purposes only to ascertain errors
  // console.log("simulateProblem: " + simulateProblem);
  if (testIfInput(command)){
    if (getSuperAdminPassword()){
      var results;
      if (simulateProblem == "none"){
        results=child.spawnSync("java",["-jar",starNetJar,getIpToUse() + ":" + settings["port"],getSuperAdminPassword(),command],{"cwd":binFolder});
      } else if (simulateProblem=="wrongip"){ // Destination unreachable
        results=child.spawnSync("java",["-jar",starNetJar,"128.0.0.1:" + settings["port"],getSuperAdminPassword(),command],{"cwd":binFolder});
      } else if (simulateProblem=="wrongport"){
        results=child.spawnSync("java",["-jar",starNetJar,getIpToUse() + ":" + 6767,getSuperAdminPassword(),command],{"cwd":binFolder});
      } else if (simulateProblem=="wrongsuperAdminPassword"){
        results=child.spawnSync("java",["-jar",starNetJar,getIpToUse() + ":" + settings["port"],"This is wrong",command],{"cwd":binFolder});
      } else if (simulateProblem=="wrongparameters"){
      // invalid parameters
        results=child.spawnSync("java",["-jar",starNetJar,"This is wrong",command],{"cwd":binFolder});
      } else {
        console.error("Invalid problem to simulate, so doing nothing!");
      }
      if (debug == true){ process.stdout.write(results.stderr.toString()); }
      // return results.stderr.toString().trim();
      return results.stderr.toString().trim().replace(/(\r)/g,""); // This is needed for windows
    }
    console.error("No super admin password established yet!  Can't do anything!");
  }
  return false;
}

// ###########################
// ### StarNet.jar errors: ###
// ###########################

// java.io.EOFException
// java.net.ConnectException: Connection timed out: connect
// java.net.ConnectException: Connection refused: connect

// Buffer overflow (happens with sql queries with too many results):
// java.io.EOFException
//  at java.io.DataInputStream.readFully(DataInputStream.java:197)
//  at java.io.DataInputStream.readFully(DataInputStream.java:169)
//  at util.StarMadeNetUtil.executeAdminCommand(StarMadeNetUtil.java:178)
//  at gui.StarNet.main(StarNet.java:32)
 
 
// Connection error - destination unreachable - seems to time out after about 30 seconds
//  java.net.ConnectException: Connection timed out: connect
//         at java.net.DualStackPlainSocketImpl.connect0(Native Method)
//         at java.net.DualStackPlainSocketImpl.socketConnect(Unknown Source)
//         at java.net.AbstractPlainSocketImpl.doConnect(Unknown Source)
//         at java.net.AbstractPlainSocketImpl.connectToAddress(Unknown Source)
//         at java.net.AbstractPlainSocketImpl.connect(Unknown Source)
//         at java.net.PlainSocketImpl.connect(Unknown Source)
//         at java.net.SocksSocketImpl.connect(Unknown Source)
//         at java.net.Socket.connect(Unknown Source)
//         at java.net.Socket.connect(Unknown Source)
//         at java.net.Socket.<init>(Unknown Source)
//         at java.net.Socket.<init>(Unknown Source)
//         at util.StarMadeNetUtil.executeAdminCommand(StarMadeNetUtil.java:122)
//         at gui.StarNet.main(StarNet.java:32)


// Connection error - no service running on that port
// java.net.ConnectException: Connection refused: connect
//         at java.net.DualStackPlainSocketImpl.connect0(Native Method)
//         at java.net.DualStackPlainSocketImpl.socketConnect(Unknown Source)
//         at java.net.AbstractPlainSocketImpl.doConnect(Unknown Source)
//         at java.net.AbstractPlainSocketImpl.connectToAddress(Unknown Source)
//         at java.net.AbstractPlainSocketImpl.connect(Unknown Source)
//         at java.net.PlainSocketImpl.connect(Unknown Source)
//         at java.net.SocksSocketImpl.connect(Unknown Source)
//         at java.net.Socket.connect(Unknown Source)
//         at java.net.Socket.connect(Unknown Source)
//         at java.net.Socket.<init>(Unknown Source)
//         at java.net.Socket.<init>(Unknown Source)
//         at util.StarMadeNetUtil.executeAdminCommand(StarMadeNetUtil.java:122)
//         at gui.StarNet.main(StarNet.java:32)


// Wrong super admin password
// RETURN: [SERVER, END; ERROR: wrong super password, 0]

// Invalid parameters
// usage: <host:port> <password> <commandParam> <commandParam> ...
