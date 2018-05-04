var path=require('path');
var binFolder=path.resolve(__dirname,"../bin/");
var starNet=require(path.join(binFolder,"starNet.js"));
var objHelper=require(path.join(binFolder,"objectHelper.js"));


// The goal of this import is to provide all the functions needed for object methods
// Done:
// /ship_info_uid [UID]

// Example ship UID: ENTITY_SHIP_Hello_There

// TODO- DONE: Add support for if a person inputs a UID for a ship that does not exist.  Perhaps add an "exists" value and set to true if data is retrieved, false if not.
// Example for a ship that does not exist:  node starNet.js "/ship_info_uid ENTITY_SHIP_Hello_There34"
// RETURN: [SERVER, Loaded: false, 0]
// RETURN: [SERVER, UID Not Found in DB: ENTITY_SHIP_Hello_There34; checking unsaved objects, 0]
// RETURN: [SERVER, UID also not found in unsaved objects, 0]
// RETURN: [SERVER, END; Admin command execution ended, 0]

// TODO - DONE: Add support for malformed requests.  Example: node starNet.js "/ship_info_uid ENTITY_SHIP_Hello_There34 blah"
// RETURN: [SERVER, [ADMIN COMMAND] [ERROR] you need to provide the full UID (e.g. ENTITY_SHIP_RESTOFUID), 0]
// RETURN: [SERVER, END; Admin command execution ended, 0]

// TODO: Fix it so "type" is only set IF it finds a valid type value..  I'll need to check the values for all entity types that might appear.


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

// Command line running
if (require.main.filename == __filename){ // This is so it only runs based on arguments IF being ran by itself and not being required into another script.  This is for testing purposes.
  var theArguments=process.argv.slice(2);
  if (theArguments[0] == "-debug"){
    console.debug=console.log;
    theArguments.shift();
  }
  if (theArguments[0]){
    var theResult;
    if (theArguments[1]){
      theResult=getEntityValue(theArguments[0],theArguments[1]);
      console.log("Result: " + theResult);
    } else {
      if (theArguments[2]){
        theResult=starNet("/ship_info_uid " + theArguments[0] + " " + new Error("Thanks")); // This is to create malformed requests for testing purposes.
      } else {
        theResult=starNet("/ship_info_uid " + theArguments[0]);
      }
      // ENTITY_SHIP_Hello_There
      if (theResult){
        // console.log("Result found: ");
        // console.dir(theResult);

        console.debug("Starting Mapify on results..");
        var theMap=mapifyEntityInfoUIDString(theResult);
        if (theMap){
          console.log("\nMap output: ")
          // console.dir(theMap);
          for (let key of theMap.keys()){
            // console.log("Key length: " + key.length);
            let tabCount1=key.length > 10?"":"\t";
            let valueLen=theMap.get(key).toString().length;
            // console.log("Key value length: " + valueLen);
            let valueMult=3 - Math.floor(valueLen / 9);
            if (valueLen<4){
              valueMult++;
            }
            let tabCount2="\t".repeat(valueMult);
            let theType=typeof theMap.get(key);
            if (theType=="object"){
              if (Array.isArray(theMap.get(key))){
                theType="array";
              }
            }
            console.log("Key: " + key + tabCount1 + "\tVal: " + theMap.get(key) + tabCount2 + "\ttypeof: " + theType);
          }
          if (theMap.has("DatabaseEntry")){
            console.log("\n\nDatabaseEntry Values: ");
            // console.dir(theMap.get("DatabaseEntry"));
            // console.log("\nKey types of values:");
            for (let key of theMap.get("DatabaseEntry").keys()){
              let tabCount1=key.length > 10?"":"\t";

              let theVal=theMap.get("DatabaseEntry").get(key);
              let theType=typeof theMap.get("DatabaseEntry").get(key);
              if (theType == "object"){
                if (Array.isArray(theMap.get("DatabaseEntry").get(key))){
                  theType="array";
                }
              }
              console.log("Key: " + key + tabCount1 + " \tType: " + theType + "\t Value: " + theMap.get("DatabaseEntry").get(key));
              if (theType=="array"){
                theVal.forEach(function(val){
                  let tabCount2="";
                  if (val.toString().length < 4){
                    tabCount2="\t";
                  }
                  console.log("\tSubvalue: " + val + tabCount2 + " \tType: " + typeof val);
                });
              }
            }
          } else {
            console.log("No DatabaseEntry found.");
          }
        }
      }
    }
  } else {
    console.log("No test value given!");
  }
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
          tempMap.set(key,objHelper.toNumIfPossible(tempMap.get(key)));
        } else if (key == "touched"){
          tempMap.set(key,objHelper.toBoolean(tempMap.get(key)));
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
        returnArray[i]=objHelper.toNumIfPossible(returnArray[i]);
      }
      return returnArray;
    } else {
      return false;  // No set of coordinates found at the end of the string
    }
  } else {
    throw new Error("ERROR: Invalid parameters given to function, getCoordsReturnArray!");
  }
}

function mapifyEntityInfoUIDString(responseStr,options){ // options are optional.  Allows a setting to return objects instead of maps, which are easier to write to a .json file if nested.
  // The goal here is to take the response of a /entity_info_uid command and turn it into an Map object with nested values
  // Special considerations:
  // The last line is the "type"
  // The DatabaseEntry value will be processed into a map of it's own and nested
  // entries that are expected to be arrays will be processed into arrays (such as Sector and MinBB values)
  var returnType="map"; // This is the default
  if (typeof options == "object"){
    if (options.hasOwnProperty("objType")){
      if (options.objType == "object"){
        returnType="object"
      }
    }
  }

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
        let loadedVal=objHelper.toBoolean(cleanRegularValue(results[i]).replace(/^Loaded: /,"").toString());
        returnMap.set("loaded",loadedVal);
        if (loadedVal == true){
          returnMap.set("exists",true);
        }
      } else if (/^RETURN: \[SERVER, DatabaseEntry \[/.test(results[i])){  // This is only for the DatabaseEntry line, which needs to be treated specially to produce a DatabaseEntry map
        if (returnType == "object"){
          returnMap.set("DatabaseEntry", objHelper.strMapToObj(mapifyDatabaseEntry(results[i]))); // Coerce into an object if return value is set to an object
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
          returnMap.set("type",testVal);
        }

      }
    }
    if (returnType == "object"){
      return objHelper.strMapToObj(returnMap); // Coerce into an object
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
    var starNetResult=starNet("/ship_info_uid " + uidToUse)
    return mapifyEntityInfoUIDString(starNetResult,options);
  } else {
    throw new Error("ERROR: Invalid parameters given to 'ShipInfoUIDObj'!");
  }
}


function getEntityValue(uidOrShipObj,valueString,options){ // Options are optional.  Allows setting the return type for DataBaseEntry to an object
  // The goal of this is to find a value without creating a full map of everything, stopping once the value is found, so it is as efficient as possible.
  // The secondary goal is to make it so this can pull values from the DatabaseEntry if loaded info is not available, without having to load the sector.
  // The tertiary goal is to load a sector prior to trying to pull the value if the ship is currently not loaded.

  var returnType="map"; // This only affects DataBaseEntry.  Everything else are objects, arrays, numbers, or strings by default.
  if (typeof options == "object"){
    if (options.hasOwnProperty("objectType")){
      if (options.objectType == "object"){
        returnType="object"
      }
    }
  }

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
    const results=starNet("/ship_info_uid \"" + uidToUse + "\"");
    // console.log("Results found: " + results);
    var resultMap=mapifyEntityInfoUIDString(results);
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
          returnVal=objHelper.strMapToObj(returnVal);
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
          starNet("/load_sector_range " + theSectorString + " " + theSectorString);
          returnVal=getEntityValue(uidToUse,valueString); // Try again till successful.  This will cause an infinite loop while the sector is unloaded, but will not run again if the command fails.
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

function detectRan(input){ // This only checks the last line of a starNet response to see if it ran.  It does not determine errors.
  // This is intended to be used ONLY for commands which have no other response, such as the "/load_sector_range" command.  If the server is down and the command fails, this will return false.
  // Only FULL starNet.js responses should be fed to this function.
  // Returns true if the command ran (even if invalid parameters were given)
  var theArray=input.split("\n");
  var theLastVal=theArray[theArray.length - 1];
  var theReg=new RegExp("^RETURN: \\[SERVER, END; Admin command execution ended, [0-9]\\]");
  if (theReg.test(theLastVal)){
    return true;
  }
  return false;
}

function detectError(input){ // Input should be a string.
  // This will scan through a starNet response for a 'java.net' line, which should only ever appear when there is an error, such as failure to connect to the server.
  // This function is not intended to be ran on every starNet response.  It can be used to parse individual lines or the whole response.
  // Returns true if there was an error, otherwise false.
  var theReg=new RegExp("^java.net.");
  var theArray=input.split("\n"); // If a string is provided, then this simply turns it into an array
  var returnVal=false;
  for (let i=0;i<theArray.length;i++){
    if (theReg.test(theArray[i])){
      returnVal=true;
      break;
    }
  }
  return returnVal;
  // Example of an error connecting due to the server not running:
  // java.net.ConnectException: Connection refused (Connection refused)
  //          at java.net.PlainSocketImpl.socketConnect(Native Method)
  //          at java.net.AbstractPlainSocketImpl.doConnect(AbstractPlainSocketImpl.java:350)
  //          at java.net.AbstractPlainSocketImpl.connectToAddress(AbstractPlainSocketImpl.java:206)
  //          at java.net.AbstractPlainSocketImpl.connect(AbstractPlainSocketImpl.java:188)
  //          at java.net.SocksSocketImpl.connect(SocksSocketImpl.java:392)
  //          at java.net.Socket.connect(Socket.java:589)
  //          at java.net.Socket.connect(Socket.java:538)
  //          at java.net.Socket.<init>(Socket.java:434)
  //          at java.net.Socket.<init>(Socket.java:211)
  //         at util.StarMadeNetUtil.executeAdminCommand(StarMadeNetUtil.java:122)
  //         at gui.StarNet.main(StarNet.java:32)
}

function verifyResponse(input){ // input should be a full starNet.js response string
  // This only checks if there was a java error and that the command actually ran.
  // This does NOT check to verify the command was successful, as the success response can vary from command to command.
  // detectRan should probably be preferred for commands that give no response to a command, such as a /sector_save or /load_sector_range to avoid unnecessary computation.
  if (detectError(input) == false && detectRan(input)){
    return true;
  }
  return false;
}


module.exports={
  "mapifyShipInfoUIDString":mapifyEntityInfoUIDString,
  "getCoordsAndReturnNumArray":getCoordsAndReturnNumArray,
  "getEntityValue":getEntityValue,
  "ShipInfoUidObj":ShipInfoUidObj,
  verifyResponse,
  detectError,
  detectRan
}
