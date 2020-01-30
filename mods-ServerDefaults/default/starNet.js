// Combined starNet with starNetHelpers - 01-09-20 - needs testing
// Note:  The StarNet will not function if called before a serverObj exists for this server.
module.exports={
  starNetSync,
  starNetCb,
  mapifyShipInfoUIDString,
  getCoordsAndReturnNumArray,
  getEntityValueSync,
  getEntityValue,
  ShipInfoUidObj,
  starNetVerified,
  starNetVerifiedCB,
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
  sendDirectToServer,
  runSimpleCommand
}

const path=require('path');
const child=require('child_process');

const mainFolder=path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself.
const mainBinFolder=path.join(mainFolder,"bin");
var starNetJar=path.join(mainBinFolder,"StarNet.jar");
var ini=require(path.join(mainBinFolder,"iniHelper.js"));
var objectHelper=require(path.join(mainBinFolder,"objectHelper.js"));
var {getOption,testIfInput,simplePromisifyIt,toStringIfPossible,getObjType,toNumIfPossible,toBoolean}=objectHelper;
const mySleep=require(path.join(mainBinFolder,"mySleep.js"));
const sleep = mySleep.softSleep; // Only accurate for 100ms or higher wait times.
const {sleepPromise}=mySleep; // Less accurate but non-blocking - can only be used in async functions!

var serverObj={};
if (global.hasOwnProperty("getInstallObj")){ // This is to allow this script to be ran from the command line.
  var installObj=global.getInstallObj(__dirname);
  var {event,settings,console,log,installPath}=installObj; // These are events ONLY for this server.
  event.on("start",function(theServerObj){ // the start event indicates that a serverObj has been created.
    serverObj=theServerObj;
  });
}


module.debug=false;
if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.
  // This script must be provided with the ip, port, and superadmin password.
  // TODO: Make it so this script can look up the super admin password for the current server.
  var theArgsArray=process.argv;
  if (theArgsArray[0]=='node'){
    theArgsArray.shift();
  }
  theArgsArray.shift();
  var theIP=toStringIfPossible(theArgsArray[0].match(/^[^:]*/));
  var thePort=toStringIfPossible(theArgsArray[0].match(/[^:]*$/));
  var superAdminPassword=theArgsArray[1];
  theArgsArray.shift();
  theArgsArray.shift();
  var theCommand=theArgsArray.join(" ");
  starNetCb(theCommand,{"ip":theIP,"port":thePort,"superAdminPassword":superAdminPassword},function(err,result){
    if (err){
      throw err;
    }
    console.log(result);
  });
}
function getSuperAdminPassword(){
  if (serverObj.hasOwnProperty("getSuperAdminPassword")){
    return serverObj.getSuperAdminPassword();
  }
  return null;
}
function getPort(){
  if (serverObj.hasOwnProperty("settings")){
    if (serverObj.settings.hasOwnProperty("port")){
      return serverObj.settings["port"];
    }
  }
  return null;
}
function starNetCb(command,options,cb){ // If no CB given, returns a promise.
  if (typeof cb=="function"){
    var processArray=[];
    if (testIfInput(command)){
      var theCommandToUse=toStringIfPossible(command);
      if (typeof theCommandToUse=="string"){
        var simulateProblem=getOption(options,"simulateProblem","none").toLowerCase(); // For testing purposes only to ascertain errors
        var theParameters="";
        
        var theSuperAdminPassword=getOption(options,"superAdminPassword",getSuperAdminPassword());
        var theIP=getOption(options,"ip",getIpToUse());
        var thePort=getOption(options,"port",getPort());

        if (typeof theSuperAdminPassword == "string"){
          if (simulateProblem == "none"){
            theParameters=["-jar",starNetJar,theIP + ":" + thePort,theSuperAdminPassword,command];
          } else if (simulateProblem=="wrongip"){ // Destination unreachable
            console.log("### Simulating wrong ip -- destination unreachable ###");
            theParameters=["-jar",starNetJar,"128.0.0.1:" + thePort,theSuperAdminPassword,command];
          } else if (simulateProblem=="wrongport"){ // Refused connection
            console.log("### Simulating wrong port -- refused connection ###");
            theParameters=["-jar",starNetJar,theIP + ":" + 6767,theSuperAdminPassword,command];
          } else if (simulateProblem=="wrongsuperadminpassword"){
            console.log("### Simulating wrong super admin password ###");
            theParameters=["-jar",starNetJar,theIP + ":" + thePort,"This is wrong",command];
          } else if (simulateProblem=="wrongparameters"){
            // invalid parameters
            console.log("### Simulating bad parameters ###");
            theParameters=["-jar",starNetJar,"This is wrong",command];
          } else {
            var theError=new Error("Invalid problem given to simpulate!");
            console.error(theError);
            return cb(theError,null);
          }
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
function starNetSync(command,options){ // This should never be used.  Use the CB/Promise version instead.
  // Options are passed as an array.  Eg. {debug:true}
  var debug=false;
  if (module.debug){
    debug=true;
  } else if (objectHelper.isObjHasPropAndEquals(options,"debug",true)){ // checks if any value was passed as an object, if it has a property "debug", and if that property strictly equals true
    debug=true
  }
  // console.dir(options);
  // console.dir(command);
  var simulateProblem=getOption(options,"simulateProblem","none").toLowerCase(); // For testing purposes only to ascertain errors
  // console.log("simulateProblem: " + simulateProblem);
  if (testIfInput(command)){
    var theSuperAdminPassword=getOption(options,"superAdminPassword",getSuperAdminPassword());
    var theIP=getOption(options,"ip",getIpToUse());
    var thePort=getOption(options,"port",getPort());
    if (typeof theSuperAdminPassword == "string"){
      var results;
      if (simulateProblem == "none"){
        results=child.spawnSync("java",["-jar",starNetJar,theIP + ":" + thePort,theSuperAdminPassword,command],{"cwd":mainBinFolder});
      } else if (simulateProblem=="wrongip"){ // Destination unreachable
        results=child.spawnSync("java",["-jar",starNetJar,"128.0.0.1:" + thePort,theSuperAdminPassword,command],{"cwd":mainBinFolder});
      } else if (simulateProblem=="wrongport"){
        results=child.spawnSync("java",["-jar",starNetJar,theIP + ":" + 6767,theSuperAdminPassword,command],{"cwd":mainBinFolder});
      } else if (simulateProblem=="wrongsuperAdminPassword"){
        results=child.spawnSync("java",["-jar",starNetJar,theIP + ":" + thePort,"This is wrong",command],{"cwd":mainBinFolder});
      } else if (simulateProblem=="wrongparameters"){
      // invalid parameters
        results=child.spawnSync("java",["-jar",starNetJar,"This is wrong",command],{"cwd":mainBinFolder});
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
function getIpToUse(){ // We're using a latch variable setter and retreiver so that when this script is required in, BEFORE the server config has been created, it won't error out, but instead nothing happens.
  if (serverObj.hasOwnProperty("serverCfgFile")){
    var ipToUse="";
    var theServerCfgFile=serverObj.serverCfgFile;
    if (!objectHelper.isObjEmpty(theServerCfgFile)){
      ipToUse=ini.getVal(theServerCfgFile,"SERVER_LISTEN_IP");
      if ((/^all$/i).test(ipToUse.trim())){ // If "all" is used, then sending it to the localhost should work fine.
        ipToUse="127.0.0.1";
      }
      return ipToUse;
    }
    return "127.0.0.1"; // I'm guessing if this field is left blank, starmade will revert to using "any".  But if not, then it should crash, so this doesn't matter then.
  }
  return null;
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
        throw new Error("ERROR: String data given to function, serializeDatabaseEntry, was NOT a DatabaseEntry string!");
      }
    } else {
      throw new Error("ERROR: Invalid data given to function, serializeDatabaseEntry!");
    }
}
function cleanRegularValue(inputStr){
    // console.debug("Cleaning input: " + inputStr);
    if (typeof inputStr == "string"){
      var remBeginSpam=new RegExp("^RETURN: [[]SERVER, "); // Remove the begin spam
      var remEndSpam=new RegExp(", [0-9]{1,1}\\]$"); // Remove the end spam
      let tempVal=inputStr.replace(remBeginSpam,"").toString();
      // console.debug("Removed begin spam: " + tempVal);
      tempVal=tempVal.replace(remEndSpam,"").toString();
      // console.debug("Removed end spam: " + tempVal);
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
      var patternRegExp=new RegExp(patternString);
      tempStr=inputStr.match(patternRegExp);
      if (tempStr){ // tempStr will be null if no match was found.
        returnArray=tempStr.toString().split(", "); // match returns an object, so we set it to a string first, then split it for the desired array.
        for (let i=0;i<returnArray.length;i++){ // Convert all strings and any E values to decimal before we return the array
          returnArray[i]=objectHelper.toNumIfPossible(returnArray[i]);
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
  
    console.debug("Starting mapify!");
    if (typeof responseStr == "string"){
      console.debug("Using responseStr: " + responseStr);
      var results=responseStr.split("\n");
      console.debug("Results found!");
      var loadedValueReg=new RegExp("^RETURN: \\[SERVER, [a-zA-Z()-]+: .+");
      var entityNotExistReg=new RegExp("RETURN: \\[SERVER, UID also");
      var entityNotExistInDBReg=new RegExp("RETURN: \\[SERVER, UID Not");
      var malformedRequestReg=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[ERROR\\]");
  
      var returnMap=new Map();
      // Cycle through all the lines, populating the object with each value.
      for (let i=0;i<results.length;i++){
        console.debug("Working on result: " + results[i]);
        if (/^RETURN: \[SERVER, Loaded: [a-zA-Z]+/.test(results[i])){ // This is treated specially because it's the only value that should be a boolean
          let loadedVal=objectHelper.toBoolean(cleanRegularValue(results[i]).replace(/^Loaded: /,"").toString());
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
            returnMap.set("DatabaseEntry", objectHelper.strMapToObj(mapifyDatabaseEntry(results[i]))); // Coerce into an object if return value is set to an object
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
          console.error("ERROR: Malformed request!")
          returnMap.set("malformedRequest",true);
          break;
        } else {
          // This should only ever fire off for the last line, which might say something like "Ship" or "Station"
          // We need to ignore the line that will be "END; Admin command execution ended"
          let testVal=cleanRegularValue(results[i]);
          if (testVal != "END; Admin command execution ended"){
            // console.log("Setting type to: " + results[i]);
            returnMap.set("type",testVal.toLowerCase());
          }
  
        }
      }
      if (returnType == "object"){
        return objectHelper.strMapToObj(returnMap); // Coerce into an object
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
            return cb(null,new serverObj.objects.FactionObj(result));
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
    // console.log("Looking up name: " + name); // temp
    if (typeof cb=="function"){
      let returnResult;
      if (typeof name == "string"){
        console.log("Getting the UID from entity name: " + name);
        return starNetVerified('/ship_info_name "' + name + '"',options,function(err,result){
          if (err){
            console.log("There was an error getting the UID from the entity name!");
            return cb(err,result);
          }
          var theArray=result.trim().split("\n");  // Split results by return lines, so we can check each line
          var notFound=false;
          for (let i=0;i<theArray.length;i++){ // Check if it is not found
            if (theArray[i].match(/.*not found in database, 0\]$/)){
              console.log("Entity not found in the database!");
              notFound=true;
            }
          }
          if (notFound){
            returnResult=null; // The ship was not found, so return null
          } else if (theArray[0].match(/found in loaded objects, 0\]$/)) { // The ship is loaded
            console.log("Entity found in loaded objects.. cycling through to get the UID..");
            for (let i=1;i<theArray.length;i++){ // Cycle through all the values, looking for the UID
              if (theArray[i].match(/^RETURN: \[SERVER, UID:/)){
                returnResult=theArray[i].match(/[^:]+, 0\]$/)[0].trim().replace(/, 0\]$/,"");
              }
            }
          } else { // The ship was found but not loaded
            console.log("Entity not found in loaded objects.. cycling through the databaseentry to get the UID..");
            for (let i=1;i<theArray.length;i++){ // Cycle through all the values, looking for the UID
              if (theArray[i].match(/^RETURN: \[SERVER, DatabaseEntry /)){
                returnResult=theArray[i].match(/uid=[^,]+/)[0].replace(/^uid=/,"");
              }
            }
          }
          console.log("Returning the result: " + returnResult);
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
    // console.log("Looking up name: " + name); // temp
    let returnResult;
    if (typeof name == "string"){
      const results=starNetSync('/ship_info_name "' + name + '"',options);
      // console.log("Results:"); //temp
      // console.dir(results); // temp
    
      if (verifyResponse(results)){
        // There are different results that can happen.  Errors are filtered out by verifyResponse
  
        // console.log("looks like the results came in fine.") // temp
        var theArray=results.trim().split("\n");  // Split results by return lines, so we can check each line
        // console.dir(theArray);
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
        // console.log("notFound: " + notFound);
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
  
            //console.log("Ship loaded.");
            for (let i=1;i<theArray.length;i++){ // Cycle through all the values, looking for the UID
              if (theArray[i].match(/^RETURN: \[SERVER, UID:/)){
                returnResult=theArray[i].match(/[^:]+, 0\]$/)[0].trim().replace(/, 0\]$/,"");
              }
              // There should ALWAYS be a match here, but if for some reason there isn't, then the returnResult will be undefined
            }
        } else { // The ship was found but not loaded
          // console.log("Ship not loaded.");
  
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
        console.error("There was a problem with the input!  Either starnet didn't run correctly or the parameters were invalid!");
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
        // console.log("\nMapify result:");
        // console.dir(resultMap);
        // console.log("\nJust because, here's the nameMap:");
        // console.dir(nameMap);
        if (resultMap.get("loaded") == true){
          // If no value existed, this will be returned as undefined.  An exception is made for "faction" because this will likely be included by Schema shortly
          if (valueString == "faction"){
            returnVal=resultMap.get("DatabaseEntry").get("faction"); // This is a special exception since it can only be found here.
          } else if (valueString == "DatabaseEntry" && returnType == "object"){
            returnVal=objectHelper.strMapToObj(returnVal); // A special exception needs to be made for DatabaseEntry, because we will either return it in it's native form as a map, or turn it into an object if directed to do so.
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
            // console.log("Ship not loaded.  Translated query of '" + valueString + "' to the DatabaseEntry value, '" + nameMap[valueString] + "'.");
          } else if (resultMap.get("malformedRequest" == true)){
              return cb(new Error(malformedRequestMsg),null);
          } else {
            console.error(shipNotExistMsg);
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
              console.debug("Value only available when sector is loaded.  Loading sector, " + theSectorString + ", and trying again.." + new Date());
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
            console.error(malformedRequestMsg);
            return cb(new Error(malformedRequestMsg),null);
        } else {
          console.error(shipNotExistMsg);
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
      // console.log("Results found: " + results);
      var resultMap=mapifyShipInfoUIDString(results);
      // console.log("\nMapify result:");
      // console.dir(resultMap);
      // console.log("\nJust because, here's the nameMap:");
      // console.dir(nameMap);
      if (resultMap.get("loaded") == true){
        // If no value existed, this will be returned as undefined.  An exception is made for "faction" because this will likely be included by Schema shortly
        if (valueString == "faction"){
            returnVal=resultMap.get("DatabaseEntry").get("faction"); // This is a special exception since it can only be found here.
        } else {
          returnVal=resultMap.get(valueString);
          // A special exception needs to be made for DatabaseEntry, because we will either return it in it's native form as a map, or turn it into an object if directed to do so.
          if (valueString == "DatabaseEntry" && returnType == "object"){
            returnVal=objectHelper.strMapToObj(returnVal);
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
          // console.log("Ship not loaded.  Translated query of '" + valueString + "' to the DatabaseEntry value, '" + nameMap[valueString] + "'.");
        } else if (resultMap.get("malformedRequest" == true)){
            console.error(malformedRequestMsg);
        } else {
          console.error(shipNotExistMsg);
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
            // console.debug("Value only available when sector is loaded.  Loading sector, " + theSectorString + ", and trying again.." + new Date());
            starNetSync("/load_sector_range " + theSectorString + " " + theSectorString,options);
            returnVal=getEntityValueSync(uidToUse,valueString); // Try again till successful.  This will cause an infinite loop while the sector is unloaded, but will not run again if the command fails.
            // If the entity loads and no value is present, 'undefined' will be returned.  This is intended.
            // The reason we try loading the sector is for futureproofing.
          }
      } else if (resultMap.get("malformedRequest")){
          console.error(malformedRequestMsg);
      } else {
        console.error(shipNotExistMsg);
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
function starNetVerifiedCB(string,options,cb){ // Takes a string command.  Options are optional
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
    // console.log("Using options:"); // temp
    // console.dir(optionsToUse);
    if (typeof string == "string"){
      return starNetCb(string,optionsToUse,async function (err,result){ // Not sure if I should be using async here, but what the hey
        if (err){
          // There will not be an error returned unless StarNet.jar terminates abornally or could not be run.
          // We are throwing an error because the wrapper cannot do anything without StarNet.jar operating correctly.
          throw new Error("StarNet.jar either could not be run or terminated abnormally!  This should never happen!  You may need to redownload StarNet.jar or add permission to run it.");
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
          console.error("ERROR:  Connection problem to server when attempting command: " + string);
  
          if (optionsToUse.retryOnConnectionProblem && connectionProblem && optionsToUse.starNetVerifiedCBTryCount < optionsToUse.maxRetriesOnConnectionProblem && optionsToUse.starNetVerifiedCBtimeToRetryTill > timeStamp){ // Only sleep and then continue to loop IF there was a connection problem.
            // Neither the max time nor max count has been reached yet
            console.error("Trying again in " + optionsToUse.retryOnConnectionProblemMs + " ms.  (Retry " + optionsToUse.starNetVerifiedCBTryCount + "/" + optionsToUse.maxRetriesOnConnectionProblem + ")  Giving up in " + starNetVerifiedRetrySecondsLeft + " seconds.");
            await sleepPromise(optionsToUse.retryOnConnectionProblemMs); // TODO: Test this.  I made this sub-function async, base function async, and starNetCB async.  How will this affect CB functionality?  Will it still be able to access the variables from the function it's running under?
            optionsToUse.starNetVerifiedCBTryCount++;
  
            return starNetVerifiedCB(string,optionsToUse,cb); // Try again
          } else { // function is either not set to retry, or it's used up all the time/retry counts.
            var theErrorText="Error when sending starNet.jar command: " + string;
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
function starNetVerified(string,options,cb){ // Takes a string command.  Options are optional.  If no cb is given, will run as Sync.
    // Options right now include displaying the result on screen by giving "{debug:true}" as an option
    // This should probably not be used on longer sort of responses because it has to parse through every line
  
    // Be careful using this, since it will crash the scripting if the error isn't handled.
    if (typeof cb == "function"){
      return starNetVerifiedCB(string,options,cb);
    } else {
      return simplePromisifyIt(starNetVerified,options,string);
    }
}
  
function starNetVerifiedSync(string,options){ // This runs syncronously.  It should NEVER be used, since it WILL hold up the main thread.  I am only leaving it here for posterity, it will not be updated.
        
    // If retry is enabled, this will still throw an error if a different kind of problem occurs, such as a buffer overflow (which is a response that is too long for StarNet.jar to handle)
    var retryOnConnectionProblem=getOption(options,"retryOnConnectionProblem",false); // by default we do not want the sync version to retry, since this holds up the main thread while it is retrying.
    var retryOnConnectionProblemMs=getOption(options,"retryOnConnectionProblemMs",1000);
    var maxRetriesOnConnectionProblem=getOption(options,"maxRetriesOnConnectionProblem",60); // This is the maximum amount of retries
    var maxTimeToRetry=getOption(options,"maxTimeToRetry",60000); // This is to keep trying for a certain number of MS.


    var retrySecondsLeft=0;
    var keepGoing=true; // Don't change this.
    var starNetResult;
    if (typeof string == "string"){
    var retryCount=0;
    var timeToRetryTill=new Date().getTime() + maxTimeToRetry; // The time right now in ms
    var timeStamp;
    while (keepGoing){ // Loop forever till a return value is given or error thrown.
        starNetResult=starNetSync(string,options);
        if (verifyResponse(starNetResult)){
        keepGoing=false; // This is just to make ESLint happy.. returning a value would break the while loop..
        return starNetResult;
        } else {
        var theCode=99; // This is an unknown error
        var getCode=getStarNetErrorType(starNetResult,{"returnNum":true});
        if (getCode){
            theCode=getCode;
        }

        var connectionProblem=false;
        if (theCode==1 || theCode==2){
            connectionProblem=true;
        }
        timeStamp=new Date().getTime();
        // This method of retrying might work ok, but it holds up the entire wrapper..  I might need to rethink the structure of the wrapper to use callbacks for everything.
        if (retryOnConnectionProblem && connectionProblem && retryCount < maxRetriesOnConnectionProblem && timeToRetryTill > timeStamp){ // Only sleep and then continue to loop IF there was a connection problem.
            // When a connection error happens,
            retrySecondsLeft=Math.ceil((timeToRetryTill-timeStamp)/1000);
            retryCount++;
            console.error("ERROR:  Connection problem to server when attempting command: " + string);
            console.error("Trying again in " + retryOnConnectionProblemMs + " seconds.  (Retry " + retryCount + "/" + maxRetriesOnConnectionProblem + ")  Giving up in " + retrySecondsLeft + " seconds.");
            sleep(retryOnConnectionProblemMs);
        } else {
            // Only throw an error IF retryOnConnectionProblem was falsey.
            var theError=new Error("Could not verify StarNet command ran successfully: " + string);
            theError["code"]=theCode; // Some kind of connection or overflow error.  TODO:  Separate out errors, since a buffer overflow SHOULD NOT be treated the same as a connection problem.
            throw theError;
        }
        }
    }
    return false; // This will never happen.  This is just to make ESlint happy.
    } else {
    throw new Error("Invalid parameters given to starNetVerified function!");
    // no code given because this is not a connection problem.
    }
    // Returns the result of the command if it verifies, meaning it ran AND there were no java errors.  
    // This does not guarantee the command was successful, like when a person gives an invalid amount of parameters, so the output still needs to be further processed to determine success/fail/warning
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
      return theResult; // This should not happen any longer
    }
  }
  theErr = new Error("Invalid input given to sendDirectToServer function!");
  if (typeof cb == "function") {
    return cb(theErr, theResult);
  } else {
    throw theErr;
  }
};
function runSimpleCommand(theCommand, options, cb) { // cb/promises compliant
  // This is used for PlayerObj methods that can be sent to either the console or using StarNet
  // An option can be specified so that it sends directly to the console.  {"fast":true}
  if (typeof cb == "function") {
    var theCommandToUse = toStringIfPossible(theCommand);
    if (typeof theCommandToUse == "string") {
      var fast = getOption(options, "fast", false);
      var msgTestFail = new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[ERROR\\]");
      var msgTestFail2 = new RegExp("^RETURN: \\[SERVER, Admin command failed: Error packing parameters, 0\\]")
      if (fast == true) { // this can run in Sync if a CB is not specified, since it's only sending input to a stdin of the server
        return sendDirectToServer(theCommandToUse, cb);
      }
      console.debug("Running StarNet command: " + theCommandToUse);
      if (testIfInput(options)) {
        console.debug("Using options:");
        console.debug(options);
      }
      return starNetVerified(serverObj, theCommandToUse, options, function (err, msgResult) {
        if (err) {
          // console.log("Returning an error: " + err);
          return cb(err, msgResult);
        } else if (checkForLine(msgResult, msgTestFail) || checkForLine(msgResult, msgTestFail2)) { // The player was offline, did not exist, or other parameters were incorrect.
          console.debug("Command connection succeeded, but command failed. Returning a false value.");
          console.debug("msgResult: " + msgResult);
          return cb(err, Boolean(false)); // err will be null
        } else { // The command appears to have not failed, so let's assume it succeeded.
          // console.log("Returning an true on success.");
          console.debug("Command connection succeeded and command succeeded. Returning a true value.");
          console.debug("msgResult: " + msgResult);
          return cb(err, Boolean(true)); // Err will be null
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
