var path=require('path');
var binFolder=path.resolve(__dirname,"../bin/");
var starNet=require(path.join(binFolder,"starNet.js"));

// TODO: Add support for if a person inputs a UID for a ship that does not exist.  Perhaps add an "exists" value and set to true if data is retrieved, false if not.
// Example for a ship that does not exist:  node starNet.js "/ship_info_uid ENTITY_SHIP_Hello_There34"
// RETURN: [SERVER, Loaded: false, 0]
// RETURN: [SERVER, UID Not Found in DB: ENTITY_SHIP_Hello_There34; checking unsaved objects, 0]
// RETURN: [SERVER, UID also not found in unsaved objects, 0]
// RETURN: [SERVER, END; Admin command execution ended, 0]

// TODO: Add support for malformed requests.  Example: node starNet.js "/ship_info_uid ENTITY_SHIP_Hello_There34 blah"
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







function toBoolean(input){ // The main purpose of this function is to convert strings of "false" to literal false, rather than them being returned as truthy.
  console.debug("Testing for Boolean: " + input);
  return input=="false" ? false : Boolean(input);
}

function mapifyDatabaseEntry(databaseEntryStr){
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
function toNumIfPossible(input){
  var output=Number(input);
  if (isNaN(output)){
    return input;
  }
  return output;
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
        returnArray[i]=toNumIfPossible(returnArray[i]);
      }
      return returnArray;
    } else {
      return false;  // No set of coordinates found at the end of the string
    }
  } else {
    throw new Error("ERROR: Invalid parameters given to function, getCoordsReturnArray!");
  }
}

function mapifyEntityInfoUIDString(responseStr){
  // The goal here is to take the response of a /entity_info_uid command and turn it into an Map object with nested values
  // Special considerations:
  // The last line is the "type"
  // The DatabaseEntry value will be processed into a map of it's own and nested
  // entries that are expected to be arrays will be processed into arrays (such as Sector and MinBB values)
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
        let loadedVal=toBoolean(cleanRegularValue(results[i]).replace(/^Loaded: /,"").toString());
        returnMap.set("loaded",loadedVal);
        if (loadedVal == true){
          returnMap.set("exists",true);
        }
      } else if (/^RETURN: \[SERVER, DatabaseEntry \[/.test(results[i])){  // This is only for the DatabaseEntry line, which needs to be treated specially to produce a DatabaseEntry map
        returnMap.set("DatabaseEntry", mapifyDatabaseEntry(results[i]));
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
        console.log("Setting type to: " + results[i]);
        // This should only ever fire off for the last line, which might say something like "Ship" or "Station"
        // We need to ignore the line that will be "END; Admin command execution ended"
        let testVal=cleanRegularValue(results[i]);
        if (testVal != "END; Admin command execution ended"){
          returnMap.set("type",testVal);
        }

      }
    }
    return returnMap; // Returns undefined if no value was present.
  } else {
    throw new Error("ERROR: Invalid parameters given to getEntity function!");
  }
}

function ShipInfoUidObj(uidOrShipObj){
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
    return mapifyEntityInfoUIDString(starNetResult);
  } else {
    throw new Error("ERROR: Invalid parameters given to 'ShipInfoUIDObj'!");
  }
}


function getEntityValue(uidOrShipObj,valueString){
  // The goal of this is to find a value without creating a full map of everything, stopping once the value is found, so it is as efficient as possible.
  // The secondary goal is to make it so this can pull values from the DatabaseEntry if loaded info is not available, without having to load the sector.
  // The tertiary goal is to load a sector prior to trying to pull the value if the ship is currently not loaded.
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
      returnVal=resultMap.get(valueString);
      // If no value existed, this will be returned as undefined.
    } else if (valueString == "loaded"){ // This should always be present, provided the ship existed.
      returnVal=resultMap.get("loaded");
    } else if (nameMap.hasOwnProperty(valueString)){
      // If the ship is not loaded, but a database entry exists, we should be able return that value
      // console.dir(resultMap);
      // resultMap.existsInDB // will only be true if DatabaseEntry was found
      // resultMap.exists // Will only be true if data was found besides the "loaded" value
      if (resultMap.get("existsInDB") == true){
        returnVal=resultMap.get("DatabaseEntry").get(nameMap[valueString]);
        console.log("Ship not loaded.  Translated query of '" + valueString + "' to the DatabaseEntry value, '" + nameMap[valueString] + "'.");
      } else if (resultMap.get("malformedRequest" == true)){
          console.log(malformedRequestMsg);
      } else {
        console.log(shipNotExistMsg);
        // If it doesn't exist in the DB, then there is no way to load the ship, even if it exists but is not in the database yet, so we are forced to return undefined.
      }
    } else if (resultMap.get("existsInDB") == true){
        // console.log("Ship not loaded. Returning value from DatabaseEntry.");
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
          console.log("Value only available when sector is loaded.  Loading sector, " + theSectorString + ", and trying again.." + new Date());
          starNet("/load_sector_range " + theSectorString + " " + theSectorString);
          returnVal=getEntityValue(uidToUse,valueString); // Try again till successful.  This will cause an infinite loop while the sector is unloaded.
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




function getEntityValueOLD(uidOrShipObj,valueString){ // This was my first attempt at an efficient script to grab values, but it may not be needed if the existing function that maps everything out is fast enough.
  // The goal of this is to find a value without creating a full map of everything, stopping once the value is found, so it is as efficient as possible.
  // The secondary goal is to make it so this can pull values from the DatabaseEntry if loaded info is not available, without having to load the sector.
  // The tertiary goal is to load a sector prior to trying to pull the value if the ship is currently not loaded.
  var uidToUse;
  if (typeof uidOrShipObj == "object"){
    if (uidOrShipObj.hasOwnProperty("uid")){ // This grabs the UID of a ship object that might be fed to this function
      uidToUse=uidOrShipObj["uid"];
    }
  } else if (typeof uidOrShipObj == "string"){
    uidToUse=uidOrShipObj;
  }

  if (typeof uidToUse == "string" && typeof valueString == "string"){
    var results=starNet("/ship_info_uid \"" + uidToUse + "\"").toString().split("\n");
    var loadedValueReg=new RegExp("^RETURN: [[]SERVER, " + valueString + ": .+");
    var loadedValueRegRem=new RegExp("^RETURN: [[]SERVER, " + valueString);
    var remEndSpamLoaded=new RegExp(", [0-9][]]$"); // This is to remove the end spam
    // var remEndSpamUnloaded=new RegExp("[]], [0-9][]]$"); // This is to remove the end spam
    var loaded;
    var returnVal;
    var theLine;
    var tempArray=[];
    var tempMap=new Map();
    for (let i=0;i<results.length && !returnVal;i++){ // Cycle through all the lines, but stop once we have the value we want.
      if (loaded == "" || typeof loaded == "undefined" || loaded === null){
        // loaded=results[i].match(/Loaded: [a-zA-Z]+/);
        // if (loaded){ // Gotta do .replace ONLY if a match is found, otherwise it might throw an error.
        if (/Loaded: [a-zA-Z]+/.test(results[i])){
          loaded=toBoolean(results[i].replace(/^Loaded: /,"").toString());
        }
        // If the ship was loaded or unloaded, the var should now be true or false
      } else if (loaded == true){
        if (loadedValueReg.test(results[i])){ // If the line matches the value we want, process it.
          returnVal=returnVal.replace(loadedValueRegRem,"").toString(); // Remove the front spam
          returnVal=returnVal.replace(remEndSpamLoaded,"").toString(); // Remove the end spam
        }
        // Entity is loaded, great, we can probabably get the value just fine.  We will NOT want to use the DatabaseEntry value since this can be out of date, as it is only updated every force/auto-save.
        // Example:
        // RETURN: [SERVER, Loaded: true, 0]
        // RETURN: [SERVER, DatabaseEntry [uid=ENTITY_SHIP_Hello_There, sectorPos=(2, 2, 2), type=5, seed=0, lastModifier=, spawner=ENTITY_PLAYERSTATE_Benevolent27, realName=Hello_There, touched=true, faction=0, pos=(12.566267, -6.259417, 1.6619873), minPos=(-2, -2, -2), maxPos=(2, 2, 2), creatorID=0], 0]
        // RETURN: [SERVER, Attached: [], 0]
        // RETURN: [SERVER, DockedUIDs: , 0]
        // RETURN: [SERVER, Blocks: 0, 0]
        // RETURN: [SERVER, Mass: 0.01, 0]
        // RETURN: [SERVER, LastModified: , 0]
        // RETURN: [SERVER, Creator: ENTITY_PLAYERSTATE_Benevolent27, 0]
        // RETURN: [SERVER, Sector: 139 -> Sector[139](2, 2, 2), 0]
        // RETURN: [SERVER, Name: Hello_There, 0]
        // RETURN: [SERVER, UID: ENTITY_SHIP_Hello_There, 0]
        // RETURN: [SERVER, MinBB(chunks): (-2, -2, -2), 0]
        // RETURN: [SERVER, MaxBB(chunks): (2, 2, 2), 0]
        // RETURN: [SERVER, Local-Pos: (12.566267, -6.259417, 1.6619873), 0]
        // RETURN: [SERVER, Orientation: (0.0, -0.70710677, 0.0, 0.70710677), 0]
        // RETURN: [SERVER, Ship, 0]
        // RETURN: [SERVER, END; Admin command execution ended, 0]

      } else if (loaded == false){
        // Entity is NOT loaded, so we need to rely on a database request block of text which does NOT contain all values, such as blocks and weight.
        // This is a bit more complicated, because potential values needed to be returned may have commas in them, yet are also terminated by commas.. So how to know where it's value stops if it has commas?
        if ("/^RETURN: [[]SERVER, DatabaseEntry /".test(results[i])){ // This ensures we are only going to do work on the database entry line
          theLine=results[i].replace(/^RETURN: [[]SERVER, DatabaseEntry \[/,"").toString(); // remove the database entry value
          theLine=theLine.replace(/\], [0-9]\]$/,"").toString(); // Remove the end spam
          tempArray=theLine.split(/, (?=[a-zA-Z])/); // This uses a lookahead to only match to commas that have a letter value following it.  This is to avoid splitting values that contain arrays or numbers or coordinate values.
          for (let i=0;i<tempArray.length;i++){ // Preprocess the array to split each value by = characters
            tempArray[i]=tempArray[i].split("=");
          }
          tempMap=new Map(tempArray.map((x) => x.split("="))); // This splits each individual value of the array by a "=" symbol and then converts the array to a map to allow getting the values easily.
          // Example Map:
          // Map {
          //   'uid' => 'ENTITY_SHIP_Hello_There',
          //   'sectorPos' => '(2, 2, 2)',
          //   'type' => '5',
          //   'seed' => '0',
          //   'lastModifier' => '',
          //   'spawner' => 'ENTITY_PLAYERSTATE_Benevolent27',
          //   'realName' => 'Hello_There',
          //   'touched' => 'true',
          //   'faction' => '0',
          //   'pos' => '(12.566267, -6.259417, 1.6619873)',
          //   'minPos' => '(-2, -2, -2)',
          //   'maxPos' => '(2, 2, 2)',
          //   'creatorID' => '0' }

          //  Since we're using the database entry values (simply because they are available), we can return SOME values for an unloaded ship, but not others.
          if (nameMap.hasOwnProperty(valueString)){
            returnVal=tempMap.get(nameMap[valueString]);
          }

        }

        // Example:
        // RETURN: [SERVER, Loaded: false, 0]
        // RETURN: [SERVER, DatabaseEntry [uid=ENTITY_SHIP_Hello_There, sectorPos=(2, 2, 2), type=5, seed=0, lastModifier=, spawner=ENTITY_PLAYERSTATE_Benevolent27, realName=Hello_There, touched=true, faction=0, pos=(12.566267, -6.259417, 1.6619873), minPos=(-2, -2, -2), maxPos=(2, 2, 2), creatorID=0], 0]
        //RETURN: [SERVER, END; Admin command execution ended, 0]
      }

      // The values returned from a DatabaseEntry do NOT have a complete set of corresponding values back and forth, below is are the values mapped back and forth where possible:
      // Loaded Info / DatabaseEntry Info
      // Attached - [none]
      // DockedUIDs - [none]
      // Blocks - [none]
      // Mass - [none]
      // LastModified - lastModifier
      // Creator - spawner
      // Sector - SectorPos
      // Name - realName
      // UID - uid
      // MinBB(chunks) - minPos
      // MaxBB(chunks) - maxPos
      // Local-Pos - pos
      // Orientation - [none]
      // [none] - type
      // [none] - seed
      // [none] - touched
      // [none] - faction

    }
    return returnVal; // Returns undefined if no value was present.
  } else {
    throw new Error("ERROR: Invalid parameters given to getEntity function!");
  }
}
module.exports={
  "mapifyShipInfoUIDString":mapifyEntityInfoUIDString,
  "getCoordsAndReturnNumArray":getCoordsAndReturnNumArray,
  "getEntityValue":getEntityValue,
  "ShipInfoUidObj":ShipInfoUidObj
}
