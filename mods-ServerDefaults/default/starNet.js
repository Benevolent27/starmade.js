// This script can be ran independently from the wrapper.  
// It can also be used as a require for other scripts, but won't have as much functionality as a mod using it would have. (no sendDirectToServer function nor {fast:true} options for sending commands)

module.exports={
  starNetVerified, // (commandString,options,cb) - This is normally what you want to use.  Supports CB OR Promise notation.
  starNetVerifiedCB,
  "starNet":starNetCb, // Works the same as starNetVerified, except it will not retry on connection fail.
  starNetCb,
  starNetSync, // Don't use this.  The normal version has callback/promise capabilities.
  mapifyShipInfoUIDString,
  getCoordsAndReturnNumArray,
  getEntityValueSync,
  getEntityValue,
  ShipInfoUidObj,
  verifyResponse,
  detectError,
  detectRan,
  checkForLine, // Checks every line of a starNet.js query for a regExp and returns true/false if found or not.
  detectSuccess, // Returns true/false if a chmod command was successful or not.  Can be fed with "false" to return "false", to be stacked with other check types.
  detectSuccess2, // Returns true/false if a ban/unban command was successful or not.  Can be fed with "false" to return "false", to be stacked with other check types.
  getUIDfromName,
  getUIDfromNameSync,
  getFactionNameFromNumber,
  getFactionNumberFromName,
  getFactionObjFromName,
  returnMatchingLinesAsArray,
  sendDirectToServer, // Only usable for a starmade.js mod, not if this script is used as a require
  runSimpleCommand
}
var defaultPassword; // This can be changed to the superAdminPassword from the server.cfg to make it faster and do less disk reads
var defaultIP; // This can be set to "127.0.0.1" if the intention is to have this connect to the local machine server
var defaultPort; // This can be set to avoid disk reads if intending to run this as part of another script or from the command line.

var starNetJarURL = "http://files.star-made.org/StarNet.jar";
const path=require('path');
const child=require('child_process');
const fs=require('fs');
var mainFolder=path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself.
var mainBinFolder=path.join(mainFolder,"bin");
var starNetJarFileName="StarNet.jar";
var starNetJarPath=path.join(mainBinFolder,starNetJarFileName); // Translates to the current folder/bin if ran by itself

var ini={ // This is ONLY used IF ran by the command line, otherwise replaced by the dependency from starmade.js, which should be superior
  getVal(inputObj,variable){
    var output;
    if (inputObj.hasOwnProperty(variable)){
      output=inputObj[variable];
    }
    return output;
  }
  // example ini.getVal(theServerCfgFile,"SERVER_LISTEN_IP");
}

var serverObj={};
module.debug=false;
var thisConsole=console;
var installObj={};
var event={};
var defaultGlobalEvent={};
if (global.hasOwnProperty("getInstallObj")){ // This is to allow this script to be ran from the command line.
  ini=require(path.join(mainBinFolder,"iniHelper.js")); // replace the command line functionality with this, which should be superior
  installObj=global.getInstallObj(__dirname);
  event=installObj.event; // These are events ONLY for this server.
  defaultGlobalEvent=installObj.defaultGlobalEvent;
  thisConsole=installObj.console;
  defaultGlobalEvent.on("init",function(){ // ONLY NECESSARY FOR DEFAULT MODS SINCE THEY DO NOT RELOAD ON MODRELOAD()
    event.on("start",function(theServerObj){ // the start event indicates that a serverObj has been created.
      serverObj=theServerObj;
    });
  });
} else { // This is required in by another script OR is being ran from the command line.
  // ### Load the server.cfg file if it exists
  var theServerCfg;
  var paramsObject;
  var serverCfgFileName="server.cfg";
  var serverCfgPath=path.join(__dirname,serverCfgFileName);
  if (!existsAndIsFile(serverCfgPath)){
    serverCfgPath=path.join("..",serverCfgFileName);
    if (!existsAndIsFile(serverCfgPath)){
      serverCfgPath=path.join(__dirname,"..","..","StarMade",serverCfgFileName); // This is where it will be if starNet.js is located in a mod folder for an install by starmade.js
    }
  }
  if (existsAndIsFile(serverCfgPath)){
    theServerCfg=convertArrayPairToObj(getIniFileSync(serverCfgPath));
  } // If the server.cfg file doesn't exist, that is ok, we just move on.

  // ### Load the starNetConfig.json file, if it exists.  This may contain the port.
  var starNetConfig;
  var starNetConfigPath=path.join(__dirname,"starNetConfig.json");
  if (existsAndIsFile(starNetConfigPath)){
    starNetConfig=require(starNetConfigPath);
  }
  
  // ### Load the starmade.js settings.json if it exists and pull the port number from it.
  var wrapperInfoPath=path.join(__dirname,"..","..","wrapperInfo.json");
  if (!existsAndIsFile(wrapperInfoPath)){
    wrapperInfoPath=path.join(__dirname,"..","wrapperInfo.json"); // Maybe it was copied into the StarMade folder for a starmade.js install.
  }
  if (existsAndIsFile(wrapperInfoPath)){
    var wrapperInfo=require(wrapperInfoPath);
    if (typeof wrapperInfo=="object"){
      if (wrapperInfo.hasOwnProperty("path")){
        var starmadejsSettingsFile=path.join(wrapperInfo["path"],"settings.json");
        // If we can track back to starmade.js, then we know where the StarNet.jar file should be.
        mainFolder=wrapperInfo["path"];
        mainBinFolder=path.join(wrapperInfo["path"],"bin");
        starNetJarPath=path.join(wrapperInfo["path"],"bin",starNetJarFileName);
        if (existsAndIsFile(starmadejsSettingsFile)){
          var starmadejsSettings=require(starmadejsSettingsFile);
          if (typeof starmadejsSettings=="object"){
            if (starmadejsSettings.hasOwnProperty("servers")){
              var thisInstallPath=path.join(__dirname,"..","..");
              if (process.platform == "win32"){
                thisInstallPath=thisInstallPath.toLowerCase(); // C:\ is capitalizing here for some reason causing the compare to be thrown off
              }
              if (!starmadejsSettings.servers.hasOwnProperty(thisInstallPath)){
                thisInstallPath=path.join(__dirname,".."); // This might have been copied to the starmade install folder for a starmade.js server
                if (process.platform == "win32"){
                  thisInstallPath=thisInstallPath.toLowerCase();
                }
              }
              if (starmadejsSettings.servers.hasOwnProperty(thisInstallPath)){
                var thisInstallSettings=starmadejsSettings.servers[thisInstallPath];
                if (thisInstallSettings.hasOwnProperty("port")){
                  var starmadeJsSettingsPort=thisInstallSettings.port;
                }
              }
            }
          }
        }
      }
    }
  }
  // If we cannot locate the bin folder for starmade.js, change the bin folder to be the current path.
  if (!existsAndIsDirectory(mainBinFolder)){
    mainBinFolder=__dirname;
    starNetJarPath=path.join(mainBinFolder,starNetJarFileName);
  }
  // Now, whether this is a require or ran from the command line, fill in any missing blanks
  // ### Establish the IP    
  if (!paramsObject.hasOwnProperty("ip") && starNetConfig){ // Prefer starNetConfig.json settings
    if (starNetConfig.hasOwnProperty("ip")){
      paramsObject["ip"]=starNetConfig["ip"]; // Use this value if it exists, otherwise move on
    }
  }
  if (!paramsObject.hasOwnProperty("ip") && theServerCfg){
    if (theServerCfg.hasOwnProperty("SERVER_LISTEN_IP")){
      if ((/all|any/i).test(theServerCfg["SERVER_LISTEN_IP"])){
        paramsObject["ip"]="127.0.0.1"; // Should be able to connect on this IP
      } else {
        paramsObject["ip"]=theServerCfg["SERVER_LISTEN_IP"]; // This is needed for servers that have multiple IP's and StarMade is only running on one of them.
      }
    }
  }
  // ### Establish the Port
  if (!paramsObject.hasOwnProperty("port") && starNetConfig){
    if (starNetConfig.hasOwnProperty("port")){
      paramsObject["port"]=starNetConfig["port"]; // Use this value if it exists, otherwise move on
    }
  } // Note there is no port value in the server.cfg file.
  if (!paramsObject.hasOwnProperty("port") && starmadeJsSettingsPort){ // Traced back from the settings.json file for starmade.js for this install.
    paramsObject["port"]=starmadeJsSettingsPort;
  }
  // ### Establish the Super Admin Password
  if (!paramsObject.hasOwnProperty("password") && starNetConfig){ // Prefer starNetConfig.json settings
    if (starNetConfig.hasOwnProperty("password")){
      paramsObject["password"]=starNetConfig["password"]; // Use this value if it exists, otherwise move on
    }
  }
  if (!paramsObject.hasOwnProperty("password") && theServerCfg){
    if (theServerCfg.hasOwnProperty("SUPER_ADMIN_PASSWORD")){
        paramsObject["password"]=theServerCfg["SUPER_ADMIN_PASSWORD"]; // Pull from the server.cfg file
    }
  }

  
  
  // If there are any command line arguments given, process them.
  if (__filename == require.main.filename){
    // eslint-disable-next-line consistent-return
    var theArgsArray=process.argv;
    if ((/node\.exe$|node$/).test(theArgsArray[0])){ // needed to determine whether the script was ran directly or with the node command line
      theArgsArray.shift();
    }
    theArgsArray.shift(); // gets rid of the "starNet.js" value
    if (theArgsArray.length == 0 && starNetConfig){ // If IP, port, or superAdminPassword have no sources, set up the starNetConfig.json file.
      // If config has already been set up, then display this, otherwise let things continue so it can fill in any gaps that might exist.
      console.log("ERROR: starNet.js requires at least 1 parameter!  To display help for this script, type: node starNet.js -help");
      console.log("Note: If you would like to reset the ip, port, or password starNet.js is using, you can either..");
      console.log("  A. Edit the 'starNetConfig.json' file to update these values");
      console.log("  B. Delete the 'starNetConfig.json' file and then run starNet.js again with no parameters.");
      process.exit();
    } else if ((/^-?help$/i).test(theArgsArray[0])){
      showCommandLineHelp();
      process.exit();
    }
    // Find if any of the values for IP, port, or superadminpassword were given
    paramsObject=theArgsArray.reduce((theObj,valStr) => {
      var theVal;
      if (valStr.match(/^-ip[:=]/)){
        theVal=valStr.match(/(?<=-ip[:=]).*$/i);
        if (theVal){ // Discard empty parameters
          theObj["ip"]=theVal.toString();
        }
      } else if (valStr.match(/^-port[:=]/)){
        theVal=valStr.match(/(?<=-port[:=]).*$/i);
        if (theVal){ // Discord empty
          theObj["port"]=theVal.toString();
        }
      } else if (valStr.match(/^-password[:=]/)){
        theVal=valStr.match(/(?<=-password[:=]).*$/i);
        if (theVal){
          theObj["password"]=theVal.toString();
        }
      } else if (theObj.hasOwnProperty("commandString")){ // Add anything that isn't a parameter to the commandString
          theObj["commandString"]+=" " + valStr;
      } else {
        theObj["commandString"]=valStr;
      }
      theVal="";
      return theObj;
    },{});
  }

  
  (async function(){ // We run asynchronously so we can have convenient formatting for prompting for text later
    var changesMade=false; // We will only write to the config if changes were made to values
    // If there are any default values given in this script, override any from any other source
    if (typeof defaultPassword != "undefined"){
      paramsObject["password"]=defaultPassword;
    }
    if (typeof defaultIP != "undefined"){
      paramsObject["ip"]=defaultIP;
    }
    if (typeof defaultPort != "undefined"){
      paramsObject["port"]=defaultPort;
    }

    // Ensure all values are set, whether ran by command line OR through a require.
    if (!paramsObject.hasOwnProperty("ip")){
      console.log("What is the IP of the StarMade server? (Use 127.0.0.1) if ran on this machine.");
      paramsObject["ip"]=await asyncPrompt(" IP to use: ",{force:true});
      changesMade=true;
    }
    if (!paramsObject.hasOwnProperty("port")){
      paramsObject["port"]=await asyncPrompt(" What port should we use? ",{force:true});
      changesMade=true;
    }
    if (!paramsObject.hasOwnProperty("password")){
      console.log("What is the SUPER_ADMIN_PASSWORD of the StarMade server? (This can be found in the server.cfg file)");
      paramsObject["password"]=await asyncPrompt(" Super Admin Password: ",{force:true});
      changesMade=true;
    }    
    // ### Write the starNetConfig.json file -- Don't write the password unless necessary.  This is for security reasons.
    if (changesMade && theServerCfg){
      if (theServerCfg.hasOwnProperty("SUPER_ADMIN_PASSWORD")){
        await writeJSONFile(starNetConfigPath,{ip:paramsObject.ip, port:paramsObject.port}); 
      } else {
        await writeJSONFile(starNetConfigPath,{ip:paramsObject.ip, port:paramsObject.port, password:paramsObject.password});
      }
    } else if (changesMade){
      await writeJSONFile(starNetConfigPath,{ip:paramsObject.ip, port:paramsObject.port, password:paramsObject.password}); 
    }

  // For scripts that use this as a require and no default values are set, let's set the default ip/port/password
    if (paramsObject.hasOwnProperty("password") && typeof defaultPassword == "undefined"){
      defaultPassword=paramsObject["password"];
    }  
    if (paramsObject.hasOwnProperty("ip") && typeof defaultIP == "undefined"){
      defaultIP=paramsObject["ip"];
    }  
    if (paramsObject.hasOwnProperty("port") && typeof defaultPort == "undefined"){
      defaultPort=paramsObject["port"];
    } 


    // If this is being run from the command line, then we should now run the command, otherwise wait.
    if (__filename == require.main.filename){ 
      // ### Run the command
      if (paramsObject.hasOwnProperty("commandString")){
        // ensure the StarNet.jar file exists and if not, download it first.
        // If this script is within a mod subfolder, there should be a "wrapperInfo.json" file left by the wrapper pointing back to it.  This should allow us to determine the location of the starNet.jar file.
        if (!existsAndIsFile(starNetJarPath)){
          await download(starNetJarURL,starNetJarPath).catch((err) => {
            console.log("StarNet.jar did not exist and could not download it!  Exiting!");
            console.log(err);
            process.exit();
          });
        }
        
        return starNetCb(paramsObject.commandString,{"ip":paramsObject.ip,"port":paramsObject.port,"superAdminPassword":paramsObject.password},function(err,result){
          if (err){
            throw err;
          }
          console.log(result);
          process.exit();
        });
      } else if (changesMade){ // Show that the config file was created
        console.log("Config file created: " + starNetConfigPath);
        console.log("You can now run commands with this script and it will use those settings.");
        console.log("Example:  node starNet.js /status");
        console.log("For more help on this script, type:  node starNet.js -help");
        process.exit();
      } else { // No config file created and no command given.
        console.log("ERROR: You must provide a command to send to the server!");
        console.log("For help with this script, type:  node starNet.js -help");
        process.exit();
      }
    }
    return true; // added to make ESLint happy
  }());
}


function showCommandLineHelp(){
  console.log("This script is used to send a command to a StarMade server and then view the results.");
  console.log("If placed in the StarMade directory, or one directory above, it can look up the server IP and SuperAdminPassword, but not the port.");
  console.log("If unable to look up the information, it will ask for whatever is needed and generate a config file (starNetConfig.json).  It will then use this config for future commands if not given different parameters.");
  console.log("Example Usage:  node starNet.js /status");
  console.log(" ");
  console.log(" Optional Parameters:");
  console.log(" -port:[Number]  Example: -port:4242");
  console.log(" -ip:[Number]  Example: -ip:127.0.0.1");
  console.log(" -password:[alphaNumericPassword]  Example: -password:thisIsMySuperAdminPassword");
  console.log(" ");
  console.log(" Note: If the config has an old super admin password or other information, you can simply edit the starNetConfig.json file or delete it to recreate the file.");
  console.log(" ");
}

function getSuperAdminPassword(){
  if (serverObj.hasOwnProperty("getSuperAdminPassword")){
    return serverObj.getSuperAdminPassword();
  }
  return defaultPassword;
}
function getIpToUse(){ // We're using a latch variable setter and retreiver so that when this script is required in, BEFORE the server config has been created, it won't error out, but instead nothing happens.
  if (serverObj.hasOwnProperty("serverCfgFile")){
    var ipToUse="";
    var theServerCfgFile=serverObj.serverCfgFile;
    if (!isObjEmpty(theServerCfgFile)){
      ipToUse=ini.getVal(theServerCfgFile,"SERVER_LISTEN_IP");
      if ((/^all$/i).test(ipToUse.trim())){ // If "all" is used, then sending it to the localhost should work fine.
        ipToUse="127.0.0.1";
      }
      return ipToUse;
    }
    return "127.0.0.1"; // I'm guessing if this field is left blank, starmade will revert to using "any".  But if not, then it should crash, so this doesn't matter then.
  }
  return defaultIP;
}
function getPort(){
  if (serverObj.hasOwnProperty("settings")){
    if (serverObj.settings.hasOwnProperty("port")){
      return serverObj.settings["port"];
    }
  }
  return defaultPort;
}
function starNetCb(commandString,options,cb){ // If no CB given, returns a promise.
  // {"ip":paramsObject.ip,"port":paramsObject.port,"superAdminPassword":paramsObject.password}
  if (typeof cb=="function"){
    var processArray=[];
    if (testIfInput(commandString)){
      var theCommandToUse=toStringIfPossible(commandString);
      if (typeof theCommandToUse=="string"){
        var simulateProblem=getOption(options,"simulateProblem","none").toLowerCase(); // For testing purposes only to ascertain errors
        var theParameters="";
        
        var theSuperAdminPassword=getOption(options,"superAdminPassword",getSuperAdminPassword());
        var theIP=getOption(options,"ip",getIpToUse());
        var thePort=getOption(options,"port",getPort());

        if (typeof theSuperAdminPassword == "string"){
          if (simulateProblem == "none"){
            theParameters=["-jar",starNetJarPath,theIP + ":" + thePort,theSuperAdminPassword,commandString];
          } else if (simulateProblem=="wrongip"){ // Destination unreachable
            thisConsole.log("### Simulating wrong ip -- destination unreachable ###");
            theParameters=["-jar",starNetJarPath,"128.0.0.1:" + thePort,theSuperAdminPassword,commandString];
          } else if (simulateProblem=="wrongport"){ // Refused connection
            thisConsole.log("### Simulating wrong port -- refused connection ###");
            theParameters=["-jar",starNetJarPath,theIP + ":" + 6767,theSuperAdminPassword,commandString];
          } else if (simulateProblem=="wrongsuperadminpassword"){
            thisConsole.log("### Simulating wrong super admin password ###");
            theParameters=["-jar",starNetJarPath,theIP + ":" + thePort,"This is wrong",commandString];
          } else if (simulateProblem=="wrongparameters"){
            // invalid parameters
            thisConsole.log("### Simulating bad parameters ###");
            theParameters=["-jar",starNetJarPath,"This is wrong",commandString];
          } else {
            var theError=new Error("Invalid problem given to simpulate!");
            thisConsole.error(theError);
            return cb(theError,null);
          }
          // console.log(`About to run: 'java ${theParameters}' within the current working directory of: ${mainBinFolder}`);
          return child.execFile("java",theParameters,{"cwd":mainBinFolder},function(error,stdout,stderr){
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
              thisConsole.dir(theError);
              return cb(error,returnString);
            } else {
              return cb(null,returnString);
            }
          });
        } else {
          var theError2=new Error("No super admin password established yet!  Can't do anything!");
          thisConsole.dir(theError2);
          return cb(theError2,null);
        }
      }
      return cb(new Error("Invalid input given as command to starNet function!  Please provide a VALID command!"));
    }
    return cb(new Error("No command given to starNet function!  Please provide a command!"));
  } else {
    return simplePromisifyIt(starNetCb,options,commandString);
  }
}
function starNetSync(commandString,options){ // This should never be used.  Use the CB/Promise version instead.
  // Options are passed as an array.  Eg. {debug:true}
  var debug=false;
  if (module.debug){
    debug=true;
  } else if (isObjHasPropAndEquals(options,"debug",true)){ // checks if any value was passed as an object, if it has a property "debug", and if that property strictly equals true
    debug=true
  }
  // thisConsole.dir(options);
  // thisConsole.dir(command);
  var simulateProblem=getOption(options,"simulateProblem","none").toLowerCase(); // For testing purposes only to ascertain errors
  // thisConsole.log("simulateProblem: " + simulateProblem);
  if (testIfInput(commandString)){
    var theSuperAdminPassword=getOption(options,"superAdminPassword",getSuperAdminPassword());
    var theIP=getOption(options,"ip",getIpToUse());
    var thePort=getOption(options,"port",getPort());
    if (typeof theSuperAdminPassword == "string"){
      var results;
      if (simulateProblem == "none"){
        results=child.spawnSync("java",["-jar",starNetJarPath,theIP + ":" + thePort,theSuperAdminPassword,commandString],{"cwd":mainBinFolder});
      } else if (simulateProblem=="wrongip"){ // Destination unreachable
        results=child.spawnSync("java",["-jar",starNetJarPath,"128.0.0.1:" + thePort,theSuperAdminPassword,commandString],{"cwd":mainBinFolder});
      } else if (simulateProblem=="wrongport"){
        results=child.spawnSync("java",["-jar",starNetJarPath,theIP + ":" + 6767,theSuperAdminPassword,commandString],{"cwd":mainBinFolder});
      } else if (simulateProblem=="wrongsuperAdminPassword"){
        results=child.spawnSync("java",["-jar",starNetJarPath,theIP + ":" + thePort,"This is wrong",commandString],{"cwd":mainBinFolder});
      } else if (simulateProblem=="wrongparameters"){
      // invalid parameters
        results=child.spawnSync("java",["-jar",starNetJarPath,"This is wrong",commandString],{"cwd":mainBinFolder});
      } else {
        thisConsole.error("Invalid problem to simulate, so doing nothing!");
      }
      if (debug == true){ process.stdout.write(results.stderr.toString()); }
      // return results.stderr.toString().trim();
      return results.stderr.toString().trim().replace(/(\r)/g,""); // This is needed for windows
    }
    thisConsole.error("No super admin password established yet!  Can't do anything!");
  }
  return false;
}
function starNetVerifiedCB(commandString,options,cb){ // Takes a string command.  Options are optional
  var optionsToUse={ }; // I'm creating the options object here, because it's changed and reused for retries
  if (typeof options == "object"){
    optionsToUse=options;
  }
  optionsToUse.retryOnConnectionProblem=getOption(options,"retryOnConnectionProblem",true); 
  optionsToUse.retryOnConnectionProblemMs=getOption(options,"retryOnConnectionProblemMs",1000);
  optionsToUse.maxRetriesOnConnectionProblem=getOption(options,"maxRetriesOnConnectionProblem",60); // This is the maximum amount of retries
  optionsToUse.maxTimeToRetry=getOption(options,"maxTimeToRetry",60000); // This is to keep trying for a certain number of MS.
  optionsToUse.simulateProblem=getOption(options,"simulateProblem","none");
  // If these options don't exist on the options, add them for the next try (if needed).
  optionsToUse.starNetVerifiedCBTryCount=getOption(options,"starNetVerifiedCBTryCount",1);
  optionsToUse.starNetVerifiedCBtimeToRetryTill=getOption(options,"starNetVerifiedCBtimeToRetryTill",new Date().getTime() + optionsToUse.maxTimeToRetry);
  // thisConsole.log("Using options:"); // temp
  // thisConsole.dir(optionsToUse);
  if (typeof commandString == "string"){
    return starNetCb(commandString,optionsToUse,async function (err,result){ // Not sure if I should be using async here, but what the hey
      if (err){
        // There will not be an error returned unless StarNet.jar terminates abornally or could not be run.
        // We are throwing an error because the wrapper cannot do anything without StarNet.jar operating correctly.
        thisConsole.error("StarNet.jar either could not be run or terminated abnormally!  This should never happen!  You may need to redownload StarNet.jar or add permission to run it.");
        throw err;
      } else if (verifyResponse(result)){ // Verify that no error happened.
          return cb(err,result); // No connection failure happened!  "err" will be Null.  This does NOT mean the command succeeded.  The result still needs to be processed, success/fail messages vary widely across commands.
      } else { // Some error happened
        var theErrorNum=99; // 99 error code is "unknown"
        theErrorNum=getStarNetErrorType(result,{"returnNum":true});
        var connectionProblem=false;
        if (theErrorNum==1 || theErrorNum==2){ // These two codes indicate either unreachable host or conenction refused.
          connectionProblem=true;
        }
        var timeStamp=new Date().getTime();
        var starNetVerifiedRetrySecondsLeft=Math.ceil((optionsToUse.starNetVerifiedCBtimeToRetryTill-timeStamp)/1000);
        thisConsole.error("ERROR:  Connection problem to server when attempting command: " + commandString);

        if (optionsToUse.retryOnConnectionProblem && connectionProblem && optionsToUse.starNetVerifiedCBTryCount < optionsToUse.maxRetriesOnConnectionProblem && optionsToUse.starNetVerifiedCBtimeToRetryTill > timeStamp){ // Only sleep and then continue to loop IF there was a connection problem.
          // Neither the max time nor max count has been reached yet
          thisConsole.error("Trying again in " + optionsToUse.retryOnConnectionProblemMs + " ms.  (Retry " + optionsToUse.starNetVerifiedCBTryCount + "/" + optionsToUse.maxRetriesOnConnectionProblem + ")  Giving up in " + starNetVerifiedRetrySecondsLeft + " seconds.");
          await sleep(optionsToUse.retryOnConnectionProblemMs); // TODO: Test this.  I made this sub-function async, base function async, and starNetCB async.  How will this affect CB functionality?  Will it still be able to access the variables from the function it's running under?
          optionsToUse.starNetVerifiedCBTryCount++;

          return starNetVerifiedCB(commandString,optionsToUse,cb); // Try again
        } else { // function is either not set to retry, or it's used up all the time/retry counts.
          var theErrorText="Error when sending starNet.jar command: " + commandString;
          var theError=new Error(theErrorText);
          theError.code=theErrorNum;
          return cb(theError,result);
        }
      }
    });
  } else {
    throw new Error("Invalid parameters given to starNetVerified function!");
    // no code given because this is not a connection problem.
  }
  // Returns the result of the command if it verifies, meaning it ran AND there were no java errors.  This does not guarantee the command was successful, like when a person gives an invalid amount of parameters.  The output still needs to be further processed to determine success/fail/warning
};
function starNetVerified(commandString,options,cb){ // Takes a string command.  Options are optional.  If no cb is given, will run as Sync.
  // Options right now include displaying the result on screen by giving "{debug:true}" as an option
  // This should probably not be used on longer sort of responses because it has to parse through every line

  // Be careful using this, since it will crash the scripting if the error isn't handled.
  if (typeof cb == "function"){
    return starNetVerifiedCB(commandString,options,cb);
  } else {
    return simplePromisifyIt(starNetVerified,options,commandString);
  }
}
// start starNetHelper.js
var nameMap={ // This is for mapping LOADED values to DatabaseEntry values, since these values can be safely pulled instead of having to load the sector the entity is in.
    "LastModified":"lastModifier",
    "Creator":"spawner",
    "Sector":"sectorPos",
    "Name":"realName",
    "UID":"uid",
    "MinBB(chunks)":"minPos",
    "MaxBB(chunks)":"maxPos",
    "Local-Pos":"pos"
}
function mapifyDatabaseEntry(databaseEntryStr){ // This will always return a map.  Options, such as returning an object should only be done when assembling and returning values
    // Takes a string, which is the line containing a "DatabaseEntry" set of data and returns a map
    var theLine;
    var tempArray=[];
    var tempMap=new Map();
    if (typeof databaseEntryStr == "string"){
      if ((/^RETURN: \[SERVER, DatabaseEntry /).test(databaseEntryStr)){ // This ensures we are only going to do work on a database entry line
        theLine=databaseEntryStr.replace(/^RETURN: \[SERVER, DatabaseEntry \[/,"").toString(); // remove the database entry value
        theLine=theLine.replace(/\], [0-9]\]$/,"").toString(); // Remove the end spam
        tempArray=theLine.split(/, (?=[a-zA-Z])/); // This uses a lookahead to only match to commas that have a letter value following it.  This is to avoid splitting values that contain arrays or numbers or coordinate values.
        tempMap=new Map(tempArray.map((x) => x.split("="))); // This splits each individual value of the array by a "=" symbol and then converts the array to a map to allow getting the values easily.
        // Further processing of the Map is necessary
        // sectorPos, pos, minPos, and maxPos need to be arrays of numbers
        // type, seed, faction, and creatorID need to be numbers
        // touched needs to be Boolean
        for (let key of tempMap.keys()){
          if (key == "sectorPos" || key == "pos" || key == "minPos" || key == "maxPos"){
            tempMap.set(key,getCoordsAndReturnNumArray(tempMap.get(key)));
          } else if (key == "type" || key == "seed" || key == "faction" || key == "creatorID"){
            tempMap.set(key,toNumIfPossible(tempMap.get(key)));
          } else if (key == "touched"){
            tempMap.set(key,toBoolean(tempMap.get(key)));
          }
        }
        return tempMap;
      } else {
        throw new Error("ERROR: String data given to function, mapifyDatabaseEntry, was NOT a DatabaseEntry string!");
      }
    } else {
      throw new Error("ERROR: Invalid data given to function, mapifyDatabaseEntry!");
    }
}
function cleanRegularValue(inputStr){
    // thisConsole.debug("Cleaning input: " + inputStr);
    if (typeof inputStr == "string"){
      var remBeginSpam=new RegExp("^RETURN: [[]SERVER, "); // Remove the begin spam
      var remEndSpam=new RegExp(", [0-9]{1,1}\\]$"); // Remove the end spam
      let tempVal=inputStr.replace(remBeginSpam,"").toString();
      // thisConsole.debug("Removed begin spam: " + tempVal);
      tempVal=tempVal.replace(remEndSpam,"").toString();
      // thisConsole.debug("Removed end spam: " + tempVal);
      return tempVal;
    } else {
      throw new Error("ERROR: Invalid input given to cleanRegularValue function!  Expected a string!");
    }
}
function getCoordsAndReturnNumArray(inputStr,numsExpected){ // If no
    if (typeof inputStr == "string"){
      var tempStr;
      var returnArray=[];
      var numsExpectedNum=3;
      var patternString;
      if (typeof numsExpected == "number"){
        if (numsExpected > 0){ // Only consider the argument valid if greater than 0
          numsExpectedNum=numsExpected;
        }
      }
      // build the regex pattern based on the number of numbers expected
      for (let i=0;i<numsExpectedNum;i++){
        if (patternString){
          // TODO: Test if the \\ is needed
          patternString+=", [-]{0,1}[0-9\\.E]*" // For each additional number, there needs to be a preceding ", ".
        } else {
          patternString="[-]{0,1}[0-9\\.E]*";  // StarMade is known to include values in scientific notation sometimes, so the E here is necessary.
        }
      }
      patternString+="(?=[)]$)"; // The lookahead "?" operator here will only match to the number set if it is at the END of the string and ends with a ")" character.
      // var patternRegExp=new RegExp(patternString);
      tempStr=inputStr.match(new RegExp(patternString));
      if (tempStr){ // tempStr will be null if no match was found.
        returnArray=tempStr.toString().split(", "); // match returns an object, so we set it to a string first, then split it for the desired array.
        for (let i=0;i<returnArray.length;i++){ // Convert all strings and any E values to decimal before we return the array
          returnArray[i]=toNumIfPossible(returnArray[i]); // The Number method used by toNumIfPossible will convert e numbers, like 10e3 becomes 10000
        }
        return returnArray;
      } else {
        return false;  // No set of coordinates found at the end of the string
      }
    } else {
      throw new Error("ERROR: Invalid parameters given to function, getCoordsReturnArray!");
    }
}
function mapifyShipInfoUIDString(responseStr,options){ // options are optional.  Allows a setting to return objects instead of maps, which are easier to write to a .json file if nested.
    // TODO:  Add processing for:
    // 'ReactorHP' => '40 / 40',
    // 'MissileCapacity' => '1.0 / 1.0',
    // 'Attached' => '[PlS[Benevolent27 [Benevolent27]*; id(2)(1)f(10003)]]',
    
    // The goal here is to take the response of a /entity_info_uid command and turn it into an Map object with nested values
    // Special considerations:
    // The last line is the "type"
    // The DatabaseEntry value will be processed into a map of it's own and nested
    // entries that are expected to be arrays will be processed into arrays (such as Sector and MinBB values)
    var returnType=getOption(options,"objType","map"); // option can be an object
    
    
    // if (typeof options == "object"){
    //   if (options.hasOwnProperty("objType")){
    //     if (options.objType == "object"){
    //       returnType="object"
    //     }
    //   }
    // }
  
    thisConsole.debug("Starting mapify!");
    if (typeof responseStr == "string"){
      thisConsole.debug("Using responseStr: " + responseStr);
      var results=responseStr.split("\n");
      thisConsole.debug("Results found!");
      var loadedValueReg=new RegExp("^RETURN: \\[SERVER, [a-zA-Z()-]+: .+");
      var entityNotExistReg=new RegExp("RETURN: \\[SERVER, UID also");
      var entityNotExistInDBReg=new RegExp("RETURN: \\[SERVER, UID Not");
      var malformedRequestReg=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[ERROR\\]");
  
      var returnMap=new Map();
      // Cycle through all the lines, populating the object with each value.
      for (let i=0;i<results.length;i++){
        thisConsole.debug("Working on result: " + results[i]);
        if (/^RETURN: \[SERVER, Loaded: [a-zA-Z]+/.test(results[i])){ // This is treated specially because it's the only value that should be a boolean
          let loadedVal=toBoolean(cleanRegularValue(results[i]).replace(/^Loaded: /,"").toString());
          returnMap.set("loaded",loadedVal);
          if (loadedVal == true){
            returnMap.set("exists",true);
          }
        } else if (/(^RETURN: \[SERVER, Blocks: )|(^RETURN: \[SERVER, Mass: )/.test(results[i])){
          let cleanedVal=cleanRegularValue(results[i]);
          let tempArray=cleanedVal.split(": ");
          returnMap.set(tempArray[0],toNumIfPossible(tempArray[1]));
        } else if (/(^RETURN: \[SERVER, ReactorHP: )|(^RETURN: \[SERVER, MissileCapacity: )/.test(results[i])){
          let cleanedVal=cleanRegularValue(results[i]);
          let tempArray=cleanedVal.split(": ");
          let tempArray2=tempArray[1].split(" / ");
          for (let i=0;i<tempArray2.length;i++){ // Set the string numbers to numbers
            tempArray2[i]=toNumIfPossible(tempArray2[i]);
          }
          returnMap.set(tempArray[0],tempArray2);
  
        } else if (/^RETURN: \[SERVER, DatabaseEntry \[/.test(results[i])){  // This is only for the DatabaseEntry line, which needs to be treated specially to produce a DatabaseEntry map
          if (returnType == "object"){
            returnMap.set("DatabaseEntry", strMapToObj(mapifyDatabaseEntry(results[i]))); // Coerce into an object if return value is set to an object
          } else {
            returnMap.set("DatabaseEntry", mapifyDatabaseEntry(results[i]));
          }
          returnMap.set("existsInDB",true);
        } else if (loadedValueReg.test(results[i])){ // This applies to values like "Sector"
            let cleanedVal=cleanRegularValue(results[i]); // This should look something like "Name: Hello_There"
            var tempArray=cleanedVal.split(": "); // This should preserve spaces preceding or trailing the "name" of a ship
            // Further processing of the value is necessary for Sector, MinBB(chunks), MaxBB(chunks), Local-Pos, and Orientation, which need to be output as arrays of numbers
            if (tempArray[0] == "Sector" || tempArray[0] == "MinBB(chunks)" || tempArray[0] == "MaxBB(chunks)" || tempArray[0] == "Local-Pos"){
              tempArray[1]=getCoordsAndReturnNumArray(tempArray[1]);
            } else if (tempArray[0] == "Orientation"){
              tempArray[1]=getCoordsAndReturnNumArray(tempArray[1],4); // 4 values are expected, so the getCoords needs to know this to match properly
            }
            returnMap.set(tempArray[0],tempArray[1]);
        } else if (entityNotExistInDBReg.test(results[i])){
            returnMap.set("existsInDB",false);
        } else if (entityNotExistReg.test(results[i])){
          returnMap.set("exists",false);
        } else if (malformedRequestReg.test(results[i])){
          thisConsole.error("ERROR: Malformed request!")
          returnMap.set("malformedRequest",true);
          break;
        } else {
          // This should only ever fire off for the last line, which might say something like "Ship" or "Station"
          // We need to ignore the line that will be "END; Admin command execution ended"
          let testVal=cleanRegularValue(results[i]);
          if (testVal != "END; Admin command execution ended"){
            // thisConsole.log("Setting type to: " + results[i]);
            returnMap.set("type",testVal.toLowerCase());
          }
  
        }
      }
      if (returnType == "object"){
        return strMapToObj(returnMap); // Coerce into an object
      } else {
        return returnMap; // Returns undefined if no value was present.
      }
    } else {
      throw new Error("ERROR: Invalid parameters given to getEntity function!");
    }
}
function ShipInfoUidObj(uidOrShipObj,options){ // options are optional and are merely passed to mapifyEntityInfoUIDString
    var uidToUse;
    if (typeof uidOrShipObj == "object"){
      if (uidOrShipObj.hasOwnProperty("uid")){ // This grabs the UID of a ship object that might be fed to this function
        uidToUse=uidOrShipObj["uid"];
      }
    } else if (typeof uidOrShipObj == "string"){
      uidToUse=uidOrShipObj;
    }
    if (uidToUse){
      var starNetResult=starNetSync("/ship_info_uid " + uidToUse,options)
      return mapifyShipInfoUIDString(starNetResult,options);
    } else {
      throw new Error("ERROR: Invalid parameters given to 'ShipInfoUIDObj'!");
    }
}
function getFactionObjFromName(name,options,cb){
    if (typeof cb == "function"){
      var theName=toStringIfPossible(name);
      if (typeof theName == "string"){
        return getFactionNumberFromName(theName,"",function(err,result){
          if (err){
            return cb(err,result);
          } else {
            return cb(null,new installObj.objects.FactionObj(result));
          }
        });
      }
      return cb(new Error("Invalid input given to getFactionObjFromName as 'name'!"),null);
    }
    return simplePromisifyIt(getFactionObjFromName,options,name);
}
function getFactionNumberFromName(name,options,cb){
    if (typeof cb=="function"){
      var theName=toStringIfPossible(name);
      if (typeof theName == "string"){
        return starNetVerified("/faction_list",options,function(err,result){
          if (err){
            return cb(err,result);
          }
          var resultArray=result.split("RETURN: [SERVER,"); // We don't split by \n because the faction description might have return symbols in it.
          var factionNum;
          var factionName;
          for (let i=0;i<resultArray.length;i++){
            factionNum=toNumIfPossible(resultArray[i].match(/(?<=Faction \[id=)[-]{0,1}[0-9]+/));
            factionName=toStringIfPossible(resultArray[i].match(/(?<=, name=)[^,]+/));
            if (theName == factionName){
              return cb(null,factionNum);
            }
          }
          // No result was found, so return null
          return cb(null,null);
        });
      } else {
        return cb(new Error("Invalid input given to getFactionNumberFromName as 'name'!"),null);
      }
    }
    return simplePromisifyIt(getFactionNumberFromName,options,name);
}
function getFactionNameFromNumber(number,options,cb){
    if (typeof cb=="function"){
      var theNumber=toNumIfPossible(toStringIfPossible(number));
      if (typeof theNumber == "number"){
        return starNetVerified("/faction_list",options,function(err,result){
          if (err){
            return cb(err,result);
          }
          var resultArray=result.split("RETURN: [SERVER,"); // We don't split by \n because the faction description might have return symbols in it.
          var factionNum;
          var factionName;
          for (let i=0;i<resultArray.length;i++){
            factionNum=toNumIfPossible(resultArray[i].match(/(?<=Faction \[id=)[-]{0,1}[0-9]+/));
            factionName=toStringIfPossible(resultArray[i].match(/(?<=, name=)[^,]+/));
            if (theNumber == factionNum){
              return cb(null,factionName);
            }
          }
          // No result was found, so return null
          return cb(null,null);
        });
      } else {
        return cb(new Error("Invalid input given to getFactionNameFromNumber as 'number'!"),null);
      }
    }
    return simplePromisifyIt(getFactionNumberFromName,options,number);
}
function getUIDfromName(name,options,cb){ // Runs in sync mode to assist in creating EntityObj from an entity name, since some events only return the entity name, not the UID..  I need to figure out workarounds for this.
    // Returns:
    // If ship not found:  null
    // If an error is encountered running starnet:  undefined
    // If invalid input is given, it will throw an error
    // If ship is found:  The FULL UID of the ship
    // thisConsole.log("Looking up name: " + name); // temp
    if (typeof cb=="function"){
      let returnResult;
      if (typeof name == "string"){
        thisConsole.log("Getting the UID from entity name: " + name);
        return starNetVerified('/ship_info_name "' + name + '"',options,function(err,result){
          if (err){
            thisConsole.log("There was an error getting the UID from the entity name!");
            return cb(err,result);
          }
          var theArray=result.trim().split("\n");  // Split results by return lines, so we can check each line
          var notFound=false;
          for (let i=0;i<theArray.length;i++){ // Check if it is not found
            if (theArray[i].match(/.*not found in database, 0\]$/)){
              thisConsole.log("Entity not found in the database!");
              notFound=true;
            }
          }
          if (notFound){
            returnResult=null; // The ship was not found, so return null
          } else if (theArray[0].match(/found in loaded objects, 0\]$/)) { // The ship is loaded
            thisConsole.log("Entity found in loaded objects.. cycling through to get the UID..");
            for (let i=1;i<theArray.length;i++){ // Cycle through all the values, looking for the UID
              if (theArray[i].match(/^RETURN: \[SERVER, UID:/)){
                returnResult=theArray[i].match(/[^:]+, 0\]$/)[0].trim().replace(/, 0\]$/,"");
              }
            }
          } else { // The ship was found but not loaded
            thisConsole.log("Entity not found in loaded objects.. cycling through the databaseentry to get the UID..");
            for (let i=1;i<theArray.length;i++){ // Cycle through all the values, looking for the UID
              if (theArray[i].match(/^RETURN: \[SERVER, DatabaseEntry /)){
                returnResult=theArray[i].match(/uid=[^,]+/)[0].replace(/^uid=/,"");
              }
            }
          }
          thisConsole.log("Returning the result: " + returnResult);
          return cb(null,returnResult);
  
        });
      } else {
        return cb(new Error("getUIDfromName given invalid input.  Expected a string!"),null);
      }
    } else {
      return simplePromisifyIt(getUIDfromName,options,name);
    }
  
}
function getUIDfromNameSync(name,options){ // Runs in sync mode to assist in creating EntityObj from an entity name, since some events only return the entity name, not the UID..  I need to figure out workarounds for this.
    // Returns:
    // If ship not found:  null
    // If an error is encountered running starnet:  undefined
    // If invalid input is given, it will throw an error
    // If ship is found:  The FULL UID of the ship
    // thisConsole.log("Looking up name: " + name); // temp
    let returnResult;
    if (typeof name == "string"){
      const results=starNetSync('/ship_info_name "' + name + '"',options);
      // thisConsole.log("Results:"); //temp
      // thisConsole.dir(results); // temp
    
      if (verifyResponse(results)){
        // There are different results that can happen.  Errors are filtered out by verifyResponse
  
        // thisConsole.log("looks like the results came in fine.") // temp
        var theArray=results.trim().split("\n");  // Split results by return lines, so we can check each line
        // thisConsole.dir(theArray);
        var notFound=false;
        // Not found:
        // RETURN: [SERVER, [INFO] Benevolent27_15613535805644 not found in loaded objects. Checking Database..., 0]
        // RETURN: [SERVER, [INFO] Benevolent27_15613535805644 not found in database, 0]
        // RETURN: [SERVER, END; Admin command execution ended, 0]
        for (let i=0;i<theArray.length;i++){ // Check if it is not found
          if (theArray[i].match(/.*not found in database, 0\]$/)){
            notFound=true;
          }
        }
        // thisConsole.log("notFound: " + notFound);
        if (notFound){
          returnResult=null; // The ship was not found, so return null
        } else if (theArray[0].match(/found in loaded objects, 0\]$/)) { // The ship is loaded
            // Found, and Loaded:
  
            // RETURN: [SERVER, [INFO] Benevolent27_1561353580564 found in loaded objects, 0]
            // RETURN: [SERVER, ReactorHP: 1 / 1, 0]
            // RETURN: [SERVER, MissileCapacity: 1.0 / 1.0, 0]
            // RETURN: [SERVER, Attached: [], 0]
            // RETURN: [SERVER, DockedUIDs: , 0]
            // RETURN: [SERVER, Blocks: 3, 0]
            // RETURN: [SERVER, Mass: 0.45, 0]
            // RETURN: [SERVER, LastModified: ENTITY_PLAYERSTATE_Benevolent27, 0]
            // RETURN: [SERVER, Creator: ENTITY_PLAYERSTATE_Benevolent27, 0]
            // RETURN: [SERVER, Sector: 600 -> Sector[600](1000, 1000, 1000), 0]
            // RETURN: [SERVER, Name: Benevolent27_1561353580564, 0]
            // RETURN: [SERVER, UID: ENTITY_SHIP_Benevolent27_1561353580564, 0]
            // RETURN: [SERVER, MinBB(chunks): (-2, -2, -2), 0]
            // RETURN: [SERVER, MaxBB(chunks): (2, 2, 2), 0]
            // RETURN: [SERVER, Local-Pos: (20.523241, -36.74963, 5.297421), 0]
            // RETURN: [SERVER, Orientation: (0.0022727407, -0.7074699, 0.0022768104, 0.70673615), 0]
            // RETURN: [SERVER, Ship, 0]
            // RETURN: [SERVER, END; Admin command execution ended, 0]
  
            //thisConsole.log("Ship loaded.");
            for (let i=1;i<theArray.length;i++){ // Cycle through all the values, looking for the UID
              if (theArray[i].match(/^RETURN: \[SERVER, UID:/)){
                returnResult=theArray[i].match(/[^:]+, 0\]$/)[0].trim().replace(/, 0\]$/,"");
              }
              // There should ALWAYS be a match here, but if for some reason there isn't, then the returnResult will be undefined
            }
        } else { // The ship was found but not loaded
          // thisConsole.log("Ship not loaded.");
  
          // Found, but Unloaded:
          // We'll need to cycle through the DatabaseEntry field
  
          // RETURN: [SERVER, [INFO] Benevolent27_1561353580564 not found in loaded objects. Checking Database..., 0]
          // RETURN: [SERVER, DatabaseEntry [uid=ENTITY_SHIP_Benevolent27_1561353580564, sectorPos=(1000, 1000, 1000), type=5, seed=0, lastModifier=ENTITY_PLAYERSTATE_Benevolent27, spawner=ENTITY_PLAYERSTATE_Benevolent27, realName=Benevolent27_1561353580564, touched=true, faction=10001, pos=(20.523241, -36.74963, 5.297421), minPos=(-2, -2, -2), maxPos=(2, 2, 2), creatorID=0], 0]
          // RETURN: [SERVER, END; Admin command execution ended, 0]
          for (let i=1;i<theArray.length;i++){ // Cycle through all the values, looking for the UID
            if (theArray[i].match(/^RETURN: \[SERVER, DatabaseEntry /)){
              returnResult=theArray[i].match(/uid=[^,]+/)[0].replace(/^uid=/,"");
            }
            // There should ALWAYS be a match here, but if for some reason there isn't, then the returnResult will be undefined
          }
        }
      } else {
        thisConsole.error("There was a problem with the input!  Either starnet didn't run correctly or the parameters were invalid!");
        // Don't change the "returnResult" so that it will be undefined.
      }
    } else {
      throw new Error("getUIDfromName given invalid input.  Expected a string!");
    }
    return returnResult;
}
// TODO: Create a "getEntityValueUsingEntityName" function which will parse the /ship_info_name results -- Note that the results returned are much different so a whole set of supporting functions needs to be created
function getEntityValue(uidOrShipObj,valueString,options,cb){ 
    // valueString can be one of the following:
  
  
    // If necessary, the sector the entity is in will be loaded so the value can be retrieved successfully.
  
  
  
    // Options are optional.  Allows setting the return type for DataBaseEntry to an object
    // The goal of this is to find a value without creating a full map of everything, stopping once the value is found, so it is as efficient as possible.
    // The secondary goal is to make it so this can pull values from the DatabaseEntry if loaded info is not available, without having to load the sector.
    // The tertiary goal is to load a sector prior to trying to pull the value if the ship is currently not loaded.
    if (typeof cb=="function"){
      var returnType=getOption(options,"objectType","map"); // valid option is "object"
      // This only affects DataBaseEntry.  Everything else are objects, arrays, numbers, or strings by default.
      var shipNotExistMsg="Ship does not appear to exist!  Cannot get value of '" + valueString + "'!"
      var malformedRequestMsg="ERROR: Could not get value, '" + valueString + "' because the request was malformed!";
      var returnVal;
      var uidToUse=toStringIfPossible(uidOrShipObj);
      if (typeof uidToUse != "string"){
        return cb(new Error("Invalid input given to getEntityValue as uidOrShipObj!"),null);
      }
      if (typeof valueString != "string"){
        return cb(new Error("Invalid input given to getEntityValue as valueString!"),null);
      }
  
      return starNetVerified("/ship_info_uid \"" + uidToUse + "\"",options,function(err,result){
        if (err){
          return cb(err,result);
        }
        var resultMap=mapifyShipInfoUIDString(result);
        // thisConsole.log("\nMapify result:");
        // thisConsole.dir(resultMap);
        // thisConsole.log("\nJust because, here's the nameMap:");
        // thisConsole.dir(nameMap);
        if (resultMap.get("loaded") == true){
          // If no value existed, this will be returned as undefined.  An exception is made for "faction" because this will likely be included by Schema shortly
          if (valueString == "faction"){
            returnVal=resultMap.get("DatabaseEntry").get("faction"); // This is a special exception since it can only be found here.
          } else if (valueString == "DatabaseEntry" && returnType == "object"){
            returnVal=strMapToObj(returnVal); // A special exception needs to be made for DatabaseEntry, because we will either return it in it's native form as a map, or turn it into an object if directed to do so.
          } else {
            returnVal=resultMap.get(valueString);
          }
          // If no value existed, this will be returned as undefined.
        } else if (valueString == "loaded"){ // This should always be present, provided the ship existed.
          returnVal=resultMap.get("loaded");
        } else if (nameMap.hasOwnProperty(valueString)){ // Return the database entry (when available) if the ship isn't loaded
          // resultMap.existsInDB // will only be true if DatabaseEntry was found
          // resultMap.exists // Will only be true if data was found besides the "loaded" value
          if (resultMap.get("existsInDB") == true){
            returnVal=resultMap.get("DatabaseEntry").get(nameMap[valueString]);
            // thisConsole.log("Ship not loaded.  Translated query of '" + valueString + "' to the DatabaseEntry value, '" + nameMap[valueString] + "'.");
          } else if (resultMap.get("malformedRequest" == true)){
              return cb(new Error(malformedRequestMsg),null);
          } else {
            thisConsole.error(shipNotExistMsg);
            return cb(null,Boolean(false)); // The command failed because the ship did not exist in the DB.
            // If it doesn't exist in the DB, then there is no way to load the ship, even if it exists but is not in the database yet, so we are forced to return undefined.
          }
        } else if (resultMap.get("existsInDB") == true){
            // Ship was not loaded and value does not exist in the DataBaseEntry, so let's try loading the sector and pull the value
            let theSector=resultMap.get("DatabaseEntry").get("sectorPos");
            let theSectorString;
            var tryAgain=true;
            for (let i=0;i<theSector.length;i++){
              if (typeof theSector[i] == "number"){
                if (theSectorString){
                  theSectorString+=" " + theSector[i].toString();
                } else {
                  theSectorString=theSector[i].toString();
                }
              } else {
                // invalid coordinates were found, so break out of the loop and allow the script to return undefined.
                tryAgain=false;
                break;
              }
            }
            if (tryAgain==true){
              thisConsole.debug("Value only available when sector is loaded.  Loading sector, " + theSectorString + ", and trying again.." + new Date());
              return starNetVerified("/load_sector_range " + theSectorString + " " + theSectorString,options,function(err,result2){
                if (err){
                  return cb(err,result2);
                }
                return getEntityValue(uidToUse,valueString,options,cb); // Try again till successful.  This will cause an infinite loop while the sector is unloaded, but will not run again if the command fails.
                // If the entity loads and no value is present, 'undefined' will be returned.  This is intended.
                // The reason we try loading the sector is for futureproofing.
              });
            }
        } else if (resultMap.get("malformedRequest")){
            thisConsole.error(malformedRequestMsg);
            return cb(new Error(malformedRequestMsg),null);
        } else {
          thisConsole.error(shipNotExistMsg);
          return cb(null,Boolean(false));
        }
        return cb(null,returnVal); // Returns undefined if no value was present.
      });
    }
    return simplePromisifyIt(getEntityValue,options,uidOrShipObj,valueString);
}
function getEntityValueSync(uidOrShipObj,valueString,options){ // Options are optional.  Allows setting the return type for DataBaseEntry to an object
    // The goal of this is to find a value without creating a full map of everything, stopping once the value is found, so it is as efficient as possible.
    // The secondary goal is to make it so this can pull values from the DatabaseEntry if loaded info is not available, without having to load the sector.
    // The tertiary goal is to load a sector prior to trying to pull the value if the ship is currently not loaded.
  
    var returnType=getOption(options,"objectType","map"); // valid option is "object"
    // This only affects DataBaseEntry.  Everything else are objects, arrays, numbers, or strings by default.
  
    var shipNotExistMsg="Ship does not appear to exist!  Cannot get value of '" + valueString + "'!"
    var malformedRequestMsg="ERROR: Could not get value, '" + valueString + "' because the request was malformed!";
    var uidToUse;
    var returnVal;
    if (typeof uidOrShipObj == "object"){
      if (uidOrShipObj.hasOwnProperty("uid")){ // This grabs the UID of a ship object that might be fed to this function
        uidToUse=uidOrShipObj["uid"];
      }
    } else if (typeof uidOrShipObj == "string"){
      uidToUse=uidOrShipObj;
    }
  
    if (typeof uidToUse == "string" && typeof valueString == "string"){
      const results=starNetSync("/ship_info_uid \"" + uidToUse + "\"",options);
      // thisConsole.log("Results found: " + results);
      var resultMap=mapifyShipInfoUIDString(results);
      // thisConsole.log("\nMapify result:");
      // thisConsole.dir(resultMap);
      // thisConsole.log("\nJust because, here's the nameMap:");
      // thisConsole.dir(nameMap);
      if (resultMap.get("loaded") == true){
        // If no value existed, this will be returned as undefined.  An exception is made for "faction" because this will likely be included by Schema shortly
        if (valueString == "faction"){
            returnVal=resultMap.get("DatabaseEntry").get("faction"); // This is a special exception since it can only be found here.
        } else {
          returnVal=resultMap.get(valueString);
          // A special exception needs to be made for DatabaseEntry, because we will either return it in it's native form as a map, or turn it into an object if directed to do so.
          if (valueString == "DatabaseEntry" && returnType == "object"){
            returnVal=strMapToObj(returnVal);
          }
        }
        // If no value existed, this will be returned as undefined.
      } else if (valueString == "loaded"){ // This should always be present, provided the ship existed.
        returnVal=resultMap.get("loaded");
      } else if (nameMap.hasOwnProperty(valueString)){ // Return the database entry (when available) if the ship isn't loaded
        // resultMap.existsInDB // will only be true if DatabaseEntry was found
        // resultMap.exists // Will only be true if data was found besides the "loaded" value
        if (resultMap.get("existsInDB") == true){
          returnVal=resultMap.get("DatabaseEntry").get(nameMap[valueString]);
          // thisConsole.log("Ship not loaded.  Translated query of '" + valueString + "' to the DatabaseEntry value, '" + nameMap[valueString] + "'.");
        } else if (resultMap.get("malformedRequest" == true)){
            thisConsole.error(malformedRequestMsg);
        } else {
          thisConsole.error(shipNotExistMsg);
          // If it doesn't exist in the DB, then there is no way to load the ship, even if it exists but is not in the database yet, so we are forced to return undefined.
        }
      } else if (resultMap.get("existsInDB") == true){
          // Ship was not loaded and value does not exist in the DataBaseEntry, so let's try loading the sector and pull the value
          let theSector=resultMap.get("DatabaseEntry").get("sectorPos");
          let theSectorString;
          var tryAgain=true;
          for (let i=0;i<theSector.length;i++){
            if (typeof theSector[i] == "number"){
              if (theSectorString){
                theSectorString+=" " + theSector[i].toString();
              } else {
                theSectorString=theSector[i].toString();
              }
            } else {
              // invalid coordinates were found, so break out of the loop and allow the script to return undefined.
              tryAgain=false;
              break;
            }
          }
          if (tryAgain==true){
            // thisConsole.debug("Value only available when sector is loaded.  Loading sector, " + theSectorString + ", and trying again.." + new Date());
            starNetSync("/load_sector_range " + theSectorString + " " + theSectorString,options);
            returnVal=getEntityValueSync(uidToUse,valueString); // Try again till successful.  This will cause an infinite loop while the sector is unloaded, but will not run again if the command fails.
            // If the entity loads and no value is present, 'undefined' will be returned.  This is intended.
            // The reason we try loading the sector is for futureproofing.
          }
      } else if (resultMap.get("malformedRequest")){
          thisConsole.error(malformedRequestMsg);
      } else {
        thisConsole.error(shipNotExistMsg);
      }
      return returnVal; // Returns undefined if no value was present.
    } else {
      throw new Error("ERROR: Invalid parameters given to getEntity function!");
    }
}
function detectSuccess(input){ // input should be a full starNet.js response as a string
    // This will look for "RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS]" and return true if found.
    // Commands that use this formatting include:
    // /sector_chmod
    // Note: Not all commands return the same kind of success message, so this will ONLY work for specific commands.
    if (input === false){ return false }; // if a "false" boolean is fed to it, it will simply return that.  This allows it to have other checks nested inside the input
    var theReg=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[SUCCESS\\]")
    return checkForLine(input,theReg);
}
function detectSuccess2(input){
    // This takes a starNet.jar output string and checks for the success message.
    // This is used for /ban and /unban commands
    if (input === false){ return false }; // if a "false" boolean is fed to it, it will simply return that.  This allows it to have other checks nested inside the input
    var theReg=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] successfully");
    return checkForLine(input,theReg);
}
function checkForLine(input,regExp){
    // This is designed to look through starNet responses for a specific regExp on every line and return true if at least one instance of the pattern is found
    // This should be used mostly for verifying if there were errors or successes
    if (typeof input == "string" && getObjType(regExp) == "RegExp"){
      var returnVal=Boolean(false);
      var theArray=input.trim().split("\n");
      for (let i = 0;i < theArray.length;i++) {
        if (regExp.test(theArray[i])){
          returnVal=Boolean(true);
          break;
        }
      }
      return returnVal;
    }
    throw new Error("Invalid parameters given to 'checkForLine' function!");
}
function returnMatchingLinesAsArray(input,regExp){
    var returnArray=[];
    if (typeof input == "string" && getObjType(regExp) == "RegExp"){
      var theArray=input.trim().split("\n");
      for (let i = 0;i < theArray.length;i++) {
        if (regExp.test(theArray[i])){
          returnArray.push(theArray[i]);
        }
      }
      return returnArray;
    }
    throw new Error("Invalid parameters given to 'returnMatchingLinesAsArray' function!");
}
function detectError(input){ // Input should be a string.
    // This will scan through a starNet response for a 'java.net' or 'java.io' line, which should only ever appear when there is an error, such as failure to connect to the server.
    // This function is not intended to be ran on every starNet response.  It can be used to parse individual lines or the whole response.
    // Returns true if there was an error, otherwise false.
  
    // var theReg=new RegExp("^java.net."); // This did not catch io errors
    var theReg=new RegExp("^java.");
    return checkForLine(input,theReg);
    // Example of an error connecting due to the server not running:
    // java.net.ConnectException: Connection refused (Connection refused) //  <-- line detected, so will return true
}
function detectRan(input){
    // This checks the last line of a starNet response to see if it ran.
    // This is intended to be used ONLY for commands which have no other response, such as the "/load_sector_range" command.
    // If the server is down and the command fails, this will return false.
    // Returns true if the command ran (even if invalid parameters were given)
    // Either the last line of a starNet.js response can be provided or a single line
    var theReg=new RegExp("^RETURN: \\[SERVER, END; Admin command execution ended, [0-9]\\]");
    var theArray=input.trim().split("\n");
    if (theReg.test(theArray[theArray.length - 1])){
      return true;
    }
    return false;
}
function verifyResponse(input){ // input should be a full starNet.js response string
    // This only checks if there was a java error and that the command actually ran.
    // This does NOT check to verify the command was successful, as the success response can vary from command to command.
    // detectRan should is be preferred for commands that give no response to a command, such as a /sector_save or /load_sector_range to avoid unnecessary computation.
    if (detectError(input) == false && detectRan(input) == true){
      return true;
    }
    return false;
}

  
function getStarNetErrorType(input,options){ // parses through a starNet.jar string return to detect StarNet.jar errors.
    // Usage:  getStarNetErrorType(input,{"returnNum":true})
  
    var returnNum=getOption(options,"returnNum",false);
    var undef;
    var overflow=checkForLine(input,/^java.io.EOFException.*/);
    if (overflow){
      if (returnNum){
        return 11;
      }
      return "overflow";
    }
    var timeout=checkForLine(input,/^java.net.ConnectException: Connection timed out.*/);
    if (timeout){
      if (returnNum){
        return 1;
      }
      return "timeout";
    }
    var refused=checkForLine(input,/^java.net.ConnectException: Connection refused.*/);
    if (refused){
      if (returnNum){
        return 2;
      }
      return "refused";
    }
    var wrongSuperAdminPassword=checkForLine(input,/^RETURN: \[SERVER, END; ERROR: wrong super password, 0\].*/);
    if (wrongSuperAdminPassword){
      if (returnNum){
        return 22;
      }
      return "wrongSuperAdminPassword";
    }
    var badParameters=checkForLine(input,/^usage: <host:port> <password> <commandParam> <commandParam>.*/);
    if (badParameters){
      if (returnNum){
        return 21;
      }
      return "badParameters";
    }
    return undef; // No recognized error, so return undefined.
}


function sendDirectToServer(input, cb) { // if cb not given, functions as Sync. Expects a string input, returning "false" if the input wasn't valid.  This sends a command directly to the console with a return character.
  // Note:  This is probably the one exception I'm making to allow running in sync mode, since it's just sending input to the stdin
  if (Object.keys(serverObj).length > 0){
    var theResult = null;
    var theErr = null;
    if (testIfInput(input)) {
      try {
        theResult = serverObj.spawn.stdin.write(input + "\n");
      } catch (err) {
        theErr = err;
      }
      if (typeof cb == "function") {
        return cb(theErr, theResult);
      } else {
        if (theErr) {
          throw theErr;
        }
        return theResult;
      }
    }
    theErr = new Error("Invalid input given to sendDirectToServer function!");
    if (typeof cb == "function") {
      return cb(theErr, theResult);
    } else {
      throw theErr;
    }
  } else {
    throw new Error("This function cannot be used as a require since it would require direct access to the server spawn object.");
  }

};
function runSimpleCommand(theCommand, options, cb) { // cb/promises compliant
  // This is used for PlayerObj methods that can be sent to either the console or using StarNet
  // An option can be specified so that it sends directly to the console .  {"fast":true}
  if (typeof cb == "function") {
    var theCommandToUse = toStringIfPossible(theCommand);
    if (typeof theCommandToUse == "string") {
      var fast = getOption(options, "fast", false);
      var msgTestFail = new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[ERROR\\]");
      var msgTestFail2 = new RegExp("^RETURN: \\[SERVER, Admin command failed: Error packing parameters, 0\\]")
      if (fast == true) { // this can run in Sync if a CB is not specified, since it's only sending input to a stdin of the server
        return sendDirectToServer(theCommandToUse, cb);
      }
      thisConsole.debug("Running StarNet command: " + theCommandToUse);
      if (testIfInput(options)) {
        thisConsole.debug("Using options:");
        thisConsole.debug(options);
      }
      return starNetVerified(theCommandToUse, options, function (err, msgResult) {
        if (err) {
          // thisConsole.log("Returning an error: " + err);
          return cb(err, msgResult);
        } else if (checkForLine(msgResult, msgTestFail) || checkForLine(msgResult, msgTestFail2)) { // The player was offline, did not exist, or other parameters were incorrect.
          thisConsole.debug("Command connection succeeded, but command failed. Returning a false value.");
          thisConsole.debug("msgResult: " + msgResult);
          return cb(null, Boolean(false)); // err will be null
        } else { // The command appears to have not failed, so let's assume it succeeded.
          // thisConsole.log("Returning an true on success.");
          thisConsole.debug("Command connection succeeded and command succeeded. Returning a true value.");
          thisConsole.debug("msgResult: " + msgResult);
          return cb(null, Boolean(true)); // Err will be null
        }
      });
    } else {
      return cb(new Error("No command given to runSimpleCommand!"), null);
    }
  } else { // No cb specified, so run in promise mode. 
    return simplePromisifyIt(runSimpleCommand, options, theCommand);
  }
};
  
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
  
  
  // Wrong super admin password:
  // RETURN: [SERVER, END; ERROR: wrong super password, 0]
  
  
  // Invalid parameters:
  // usage: <host:port> <password> <commandParam> <commandParam> ...
  


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

//  ### IMPORTED FUNCTIONS FROM HELPERS -- THESE NEED TO BE HERE SO THIS SCRIPT CAN BE SELF-SUFFICIENT.
function sleep(ms) { // Returns a promise.  Ideal usage is within async functions.  Example: await Sleep(300)
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getOption(options,optionToLookFor,whatToUseIfNoOption){ // This is used to parse options given to a command.
  if (typeof options == "object"){
    if (options.hasOwnProperty(optionToLookFor)){ // This is redundant
      if (testIfInput(options[optionToLookFor])){ // This ensures the value is not empty
        return options[optionToLookFor]; // Perhaps this should validate that the entry can be converted to a string and is not an object or array, but meh.
      }
    }
  }
  return whatToUseIfNoOption;
}
function testIfInput(input){
  // This is to test if an input is given.  A "false" boolean value will cause true to be returned, because it was an input.  Empty objects will return false.
  if (typeof input === 'undefined' || input===null || input==="" || (typeof input=="number" && isNaN(input)) ) { // "" needs to be === otherwise it will trigger under a boolean false
    return false;
  } else if (typeof input == "boolean" || input == "0" || input === 0){ // boolean cannot be empty and numbers are input
    return true;
  } else if (typeof input == "object"){ // objects, arrays, and maps are more complicated.  False will be returned if the object is empty.
    if (input instanceof Array){
      if (input.length){ // Array cannot have a 0 length
        return true;
      }
      return false;
    } else if (input instanceof Map){ // This check must be done before checking for an instanceof Object, since maps seem to hold true for that too.
      if (input.size){ // Map object cannot be empty
        return true;
      }
      return false;
    } else if (input instanceof RegExp){ // This will handle RegExp objects.
      var inputToString=input.toString();
      if (inputToString == "/(?:)/" || inputToString == "" || typeof inputToString == 'undefined'){
        return false;
      }
      return true;
    } else if (input instanceof Object){ // This will handle custom objects the same.
      for(var key in input) {
        if (input.hasOwnProperty(key)){ // If there are any properties, then it is not empty.
          return true;
        }
      }
      return false;
    }
  }
  // This covers strings and other numbers with a general truthy check.  It's also a catchall for any other circumstance I might not have thought of to check above.
  if (input){ // This check is just a catch-all, it should always be true at this point.
    return true;
  }
  return false; // This is to cover any other non-true value that I somehow didn't catch.
};
function simplePromisifyIt(cbFunctionToCall,options){ // This is used to turn callback functions into promises. "options" is mandatory.
  if (typeof cbFunctionToCall == "function"){
    var args=Array.from(arguments);
    args.splice(0,2); // Splicing while making the array doesn't work
    args.push(options); // This way options is always the 2nd from last input given to the cb function
    return new Promise(function(resolve,reject){
      return cbFunctionToCall(...args,function(err,result){
        if (err){
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }
  throw new Error("Invalid input given to simplePromisifyIt as functionToCall!");
}
function toStringIfPossible(input,options){ // This also converts numbers from scientific notation to floating point
  if (typeof input !== "undefined" && input !== ""){ // This check is necessary since Number will create a 0 number using them
    try {
      var output=input.toString(options); // Sometimes the .toString() prototype will take options, such as for LocationObj
    } catch (err){
      return input;
    }
    if (typeof output == "string"){
      return output;
    }
  }
  return input;
}
function getObjType(theObj){ // This will return the name of the constructor function that created the object
  if (typeof theObj == "object"){ // This holds true for arrays
    return theObj.constructor.name; // Source:  https://stackoverflow.com/questions/332422/how-do-i-get-the-name-of-an-objects-type-in-javascript
  } else { // If it is NOT an object, then we should just return whatever type it is.
    return typeof theObj;
  }
}
function toNumIfPossible(input){ // This also converts numbers from scientific notation to floating point
  if (typeof input != "undefined" && input != ""){ // This check is necessary since Number will create a 0 number using them
    var output=input;
    if (typeof input == "string"){
      output=input.replace(",",""); // To remove the comma in numbers over 1,000, like "2,000"
    }
    output=Number(output); // Not using parseInt because it would cut of letters, like 123abc would become 123, which is not desired.
    if (isNaN(output)){
      return input;
    } else {
      return output;
    }
  }
  return input;
}
function toBoolean(input){ // The main purpose of this function is to convert strings of "false" to literal false, rather than them being returned as truthy.
  var inputVal=toNumIfPossible(input); // Convert to a number if possible, so "0" will return false;
  if (inputVal){ // First try a truthy
    return (/^false$/i).test(inputVal) ? false : Boolean(inputVal); // Interpret a "false" string as false, otherwise convert to Boolean.  This will convert ANY input to true.
  } else { // any falsey gets turned to false
    return false;
  }
}
function isObjHasPropAndEquals(obj,property,valueCheck){
  if (typeof obj == "object"){
    return objHasPropAndEquals(obj,property,valueCheck);
  }
  return false;
}
function objHasPropAndEquals(obj,property,valueCheck){
  if (obj.hasOwnProperty(property)){
    if (obj[property] === valueCheck){
      return true;
    }
  }
  return false;
}
function isObjEmpty(obj) {
  for(var key in obj) {
      if (obj.hasOwnProperty(key)){
        return false;
      }
  }
  return true;
}
function strMapToObj(strMap) { // Must only be used on map objects with keys that can be used as object elements
  let obj = Object.create(null);
  for (let [k,v] of strMap) {
      // We don’t escape the key '__proto__'
      // which can cause problems on older engines
      obj[k] = v;
  }
  return obj;
}
function existsAndIsFile(pathToFile){ // This returns false if the path is to a directory
  if (isSeen(pathToFile)){
    if (isFile(pathToFile)){
      return true;
    }
  }
  return false;
}
function existsAndIsDirectory(pathToDirectory){ // This returns false if the path is to a directory
  if (isSeen(pathToDirectory)){
    if (isDirectory(pathToDirectory)){
      return true;
    }
  }
  return false;
}
function isSeen(thePath){ // This checks to see if a file/folder/symlink/whatever can simply be seen.
  try {
    fs.accessSync(thePath,fs.constants.F_OK);
    return true;
  } catch (error){
    return false;
  }
}
function isFile(source) { 
  return fs.lstatSync(source).isFile(); 
};
function isDirectory(source) { 
  return fs.lstatSync(source).isDirectory(); 
};
function getIniFileSync(inputFilePath){ // Reads a basic ini file and loads it as an array of [key,value] pairs.
  if (existsAndIsFile(inputFilePath)){
    var fileContents=fs.readFileSync(inputFilePath,'utf8');
    fileContents=fileContents.toString().replace(/[\r]+/g,"").trim();
    var fileContentsArray=fileContents.split("\n");
    return fileContentsArray.reduce((theArr,val) => {
      if (typeof val != "undefined" && val != ""){ // if blank, skip
        let valTrimmed=val.replace(/\/\/.*$/g,"").trim();
        if (valTrimmed != ""){ // If not whitespace
          var theVar=valTrimmed.match(/^.+?(?==)/); // Shortest match, must have equals symbol
          if (theVar){ // Will be null if no match found
            var theVal=valTrimmed.match(/(?<==).+$/); // longest match, even if it contains a = character
            if (theVal){ // Will be null if no value given.  We will not include undefined values
              let theVarTrimmed=theVar.toString().trim();
              let theValTrimmed=theVal.toString().trim();
              if (theVarTrimmed != "" && theValTrimmed != ""){ // We don't want whitespace variables or values..
                theArr.push([theVarTrimmed,theValTrimmed]);
              }
            }
          }
        }
      }
      return theArr;
    },[]);
  }
  throw new Error("File does not exist: " + inputFilePath);
}
function convertArrayPairToObj(arr){ // expects an array of arrays, like [["name","steve"],["age",23]]
  return arr.reduce((theObj,arrVal) => {
    if (Array.isArray(arrVal)){
      if (arrVal.length == 2){
        theObj[arrVal[0]]=arrVal[1].trim(); // Overwrites any existing key pairs
      }
    }
    return theObj;
  },{});
}
function asyncPrompt(text,options,cb){
  if (typeof cb == "function"){
    var force=false;
    if (typeof options == "object"){
      if (options.hasOwnProperty("force")){
        if (options.force == true){
          force=true;
        }
      }
    }
    var rl=require("readline").createInterface({input: process.stdin, output: process.stdout});
    return rl.question(text,function(input){
      rl.close();
      if (force == true && input == ""){
        return asyncPrompt(text,options,cb);
      } else {
        return cb(null,input);
      }
    });
  }
  return simplePromisifyIt(asyncPrompt,options,text);
}
function writeJSONFile(pathToJSONFile,data,options,cb){ // options are passed to fs.writeFile
  if (typeof cb=="function"){
    var theData;
    if (typeof data == "string"){ // If a string is input, we want to parse it back to an object so we can stringify it in a uniform manner
      theData=JSON.parse(data); // Convert to an object first, we then turn it back to a string to write it, but with formatting options.
    } else {
      theData=data;
    }
    return fs.writeFile(pathToJSONFile,JSON.stringify(theData, null, 4),options,function (err,result){
      if (err){
        return cb(err,result);
      }
      return cb(null,true);
    });
  }
  return simplePromisifyIt(writeJSONFile,options,pathToJSONFile,data);
}
function download(httpURL, fileToPlace, options, cb) { // This function handles the pre-downloading of files, such as StarNet.jar.  When all downloads are finished, the StarMade server is started by emitting the event signal, "ready".
  // Code adapted from: https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
  if (typeof cb == "function"){
    let tempFileToPlace = path.resolve(__dirname, fileToPlace + ".tmp");
    quietDelete(tempFileToPlace);
    let resolvedFileToPlace = path.resolve(__dirname, fileToPlace);
    let baseFileToPlace = path.basename(resolvedFileToPlace);
  
    // Check to see if the file already exists or not.  If it does exist, then we can end this operation.
    // fs.accessSync(resolvedFileToPlace),fs.constants.F_OK); // Supposed to check if the file can be seen but it was not working for me for some reason.
    if (fs.existsSync(resolvedFileToPlace)) { // We can see that a file, directory, or symlink exists at the target path
      if (fs.statSync(resolvedFileToPlace).isFile()) {
        // File already existed.  This will only download the file if it does not exist.
        return cb(null,Boolean(false)); // Indicate false so we know the download did not happen, but there was no error.
      } else if (fs.statSync(resolvedFileToPlace).isDirectory()) {
        return cb(new Error(`Cannot download file: ${resolvedFileToPlace}\nDirectory already exists with the name!  Please remove this directory and run this script again!`),null);
      } else {
        return cb(new Error(`ERROR: Cannot download file: ${resolvedFileToPlace}\nPath already exists with the name!  Please rectify this and then run this script again!`),null);
      }
    } else { // If the file does not exist, let's download it.
      var file = fs.createWriteStream(tempFileToPlace); // Open up a write stream to the temporary file.  We are using a temporary file to ensure the file will only exist at the target IF the download is a success and the file write finishes.
      try {
        var request = require('http').get(httpURL, function (response) {
          if (response.statusCode == 200) {
            response.pipe(file);
          } else {
            console.error(`Error downloading file, '${baseFileToPlace}'!  HTTP Code: ${response.statusCode}`);
            return cb(new Error(`Response from HTTP server: ${response.statusMessage}`),null);
          };
          return true;
        });
        request.on('error', (e) => cb(new Error(`problem with request: ${e.message}`),null));
      } catch (err) { // If there was any trouble connecting to the server, then hopefully this will catch those errors and exit the wrapper.
        return cb(err,null);
      }
      file.on('finish', function () {
        file.close();
        return fs.rename(tempFileToPlace, resolvedFileToPlace, (err) => {
          if (err) {
            return cb(err,null);
          }
          return cb(null,Boolean(true)); // SUCCESS
        });
      });
    }
    return true;
  }
  return simplePromisifyIt(download,options,httpURL,fileToPlace);
}
// ### Required Support Functions
function quietDelete (fileToDelete){ // Requires full path to the file.  Throws error if it has problems deleting it, true if it deleted it, and false if nothing to delete
  if (fs.existsSync(fileToDelete)){
    fs.unlinkSync(fileToDelete);
    return true;
  }
  return false;
}
