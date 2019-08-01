
// This script assists with creating all custom object types used by the wrapper.

module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  // init, // This is needed so objects can send text directly to the server
  BluePrintObj,
  BotObj,
  ChannelObj,
  CoordsObj,
  EntityObj,
  FactionObj,
  IPObj,
  LocationObj,
  LockFileObj,
  MessageObj,
  PlayerObj,
  SectorObj,
  ServerObj,
  SpawnObj,
  SMNameObj,
  SystemObj,
  RemoteServer: RemoteServerObj,
  isPlayerOnline,
  getPlayerList,
  getAdminsList
}

// Requires
const fs                   = require('fs');
const path                 = require('path');
const events               = require('events');
const mainFolder           = path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself for testing purposes.
const binFolder            = path.resolve(__dirname,"../bin/");
const spawn                = require('child_process').spawn;
const http                 = require('http');
const miscHelpers          = require(path.join(binFolder,"miscHelpers.js"));
const requireBin           = miscHelpers["requireBin"];
const sqlQuery             = requireBin("sqlQuery.js");
// SqlQueryObj is not in the module.exports above because it cannot be defined till after sqlQuery.js is required.
module.exports.SqlQueryObj = sqlQuery.SqlQueryObj; // Module injections should occur as quickly as possible to allow circular dependencies to function properly
const starNet              = requireBin("starNet.js");
const {starNetSync,starNetCb}=starNet;
const starNetHelper        = requireBin("starNetHelper.js");
const objectHelper         = requireBin("objectHelper.js");
const regExpHelper         = requireBin("regExpHelper.js");
const ini                  = requireBin("iniHelper.js");
var setSettings            = requireBin("setSettings2.js"); // This will confirm the settings.json file is created and the install folder is set up.
const installAndRequire    = requireBin("installAndRequire.js");
const sleep                = requireBin("mySleep.js").softSleep;

// NPM installable requires
const treeKill      = installAndRequire('tree-kill'); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes
const isInvalidPath = installAndRequire("is-invalid-path"); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
const exitHook      = installAndRequire('exit-hook'); // https://github.com/sindresorhus/exit-hook Handles normal shutdowns, sigterm, sigint, and a "message=shutdown" event.  Good for ensuring the server gets shutdown.

var lockFile   = path.join(mainFolder,"server.lck");

// Aliases for requires - These are set up for readability
const stripFullUIDtoUID     = regExpHelper["stripFullUIDtoUID"]; // Function that removes text like ENTITY_SHIP_ and ENTITY_PLANET_ from the beginning of a full UID so it can be used to perform SQL queries on UID
const SqlQueryObj           = sqlQuery.SqlQueryObj;
var sectorProtectionsArray  = regExpHelper.sectorProtections; // This should include all the possible protections a sector can have.
// const verifyStarNetResponse = starNetHelper.verifyResponse; // This can be used to perform a verification on a StarNet response without consuming the response
// const starNetVerified       = starNetHelper.starNetVerified; // If the response does not verify, this consumes the response and throws an error instead
const {verifyStarNetResponse,starNetVerified,starNetVerifiedCB,returnMatchingLinesAsArray} = starNetHelper;
// const copyArray             = objectHelper.copyArray;
// const toNumIfPossible       = objectHelper.toNumIfPossible;
// const subArrayFromAnother   = objectHelper.subArrayFromAnother;
// const findSameFromTwoArrays = objectHelper.findSameFromTwoArrays;
const {copyArray,toNumIfPossible,toStringIfPossible,subArrayFromAnother,findSameFromTwoArrays,isInArray} = objectHelper;
// const colorize              = objectHelper["colorize"];
// const getObjType            = objectHelper.getObjType; // Gets the prototype name of an object, so instead of using "typeof", which returns "object" for things like arrays and SectorObj's, etc, this will return their object name instead.
const {testIfInput,trueOrFalse,isTrueOrFalse,isNum,colorize,getObjType,returnLineMatch} = objectHelper;
const {isTrue,isFalse,getOption}=objectHelper;
const toNum                 = objectHelper.toNumIfPossible;

// Set up aliases from the global variable
var server=global["serverSpawn"];
console.log("### OBJECT CREATOR - SET SERVER VARIABLE");



// Set up prototypes for constructors, such as replacing .toString() functionality with a default value.  Prototypes will not appear as a regular key.
SectorObj.prototype.toString = function(){ return this.coords.toString() };
SectorObj.prototype.toArray=function(){ return this.coords.toArray() };

CoordsObj.prototype.toString = function(){ return this.x.toString() + " " + this.y.toString() + " " + this.z.toString() };
CoordsObj.prototype.toArray=function(){ return [this.x, this.y, this.z]; }

EntityObj.prototype.toString = function(){ return this.fullUID.toString() };
IPObj.prototype.toString = function(){ return this.address };
IPObj.prototype.toArray = function(){ return this.address.split(".") };
PlayerObj.prototype.toString = function(){ return this.name }; // This allows inputs for functions to use a playerObj or string easily.  Example:  playerObj.toString() works the same as playerString.toString(), resulting in a string of the player's name.
SMNameObj.prototype.toString = function(){ return this.name };
BluePrintObj.prototype.toString = function(){ return this.name };
BotObj.prototype.toString = function(){ return this.name };
ChannelObj.prototype.toString = function(){ return this.name };
FactionObj.prototype.toString = function(){ return toStringIfPossible(this.number) };
LocationObj.prototype.toString = function(options){ 
    // default is to return the sector.toString(), spacial can be given instead by specifying options as {"type":"spacial"}
  let valToReturnType=getOption(options,"type","sector").toLowerCase();
  if (valToReturnType == "sector"){
    return this.sector.toString();
  } else if (valToReturnType=="spacial"){
    return this.spacial.toString();
  }
  throw new Error("Invalid option given to LocationObj.toString()!");
}; 
LocationObj.prototype.toArray = function(options){ 
  // default is to return an array of objects, but an array of strings is an option with {"type":"string"}
  let valToReturnType=getOption(options,"type","objects").toLowerCase();
  if (valToReturnType == "objects"){
    return [this.sector , this.spacial];
  } else if (valToReturnType=="string"){
    return [this.sector.toString() , this.spacial.toString()]; 
  }
  throw new Error("Invalid option given to LocationObj.toArray()!");
}; 
MessageObj.prototype.toString = function(){ return this.text };
ServerObj.prototype.toString = function(){ return this.filePath };
SystemObj.prototype.toString = function(){ return this.coords.toString() };



//  #######################
//  ###     TESTING     ###
//  #######################


if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.
  var testSuit={ // This is used to match a command line argument to an element to then run a specific test function
    sectorTests1:sectorTests,
    sectorTests2:sectorTests2,
    sectorTests3:sectorTests3,
    entityObjTests:entityObjTests,
    starNetHelperTests:starNetHelperTests,
    ipObjTests:ipObjTests,
    getServerListTest: getServerListTest,
    lockFileTest
  }
  var clArgs=process.argv.slice(2);

  if (testSuit.hasOwnProperty(clArgs[0])){
    console.log("Running test suit: " + clArgs[0]);
    testSuit[clArgs[0]](clArgs[1]);
  } else {
    console.log("Test suit does not exist: " + clArgs[0]);
    console.log("Available tests:");
    for (let key in testSuit){
      if (testSuit.hasOwnProperty(key)){
        console.log("- " + key);
      }
    }
    console.log("\nTo run an individual test, include it as the first argument.");
    console.log("Example:  node objectCreator.js sectorTests1");
  }
}
function entityObjTests(){
  var theShip=new EntityObj("ENTITY_SHIP_Hello_There");
  console.log("My ship is named: " + colorize(theShip.name()));
  console.log("Is my ship loaded?: " + colorize(theShip.loaded()));
  console.log("It has a default value of: " + colorize(theShip.toString()));
  console.log("It has a total block count of: " + colorize(theShip.blocks()));
  console.log("It is currently in sector: " + colorize(theShip.sector().toString()));
  console.log("And its very strange orientation coords are: " + colorize(theShip.orientation()));
  console.log("And here's all the data, mapified:");
  console.dir(theShip.dataMap());
  console.log("And here's all the data as an object:");
  console.log(colorize(theShip.dataObj()));


  console.log("New entityObj: ");
  console.dir(theShip);
  console.log("\n");
  console.log("Ship faction number: " + theShip.faction().number);

  Object.keys(theShip).forEach(function(key){
    if (theShip.hasOwnProperty(key)){ // This is to filter out prototype values
      if (typeof theShip[key] == "object"){
        process.stdout.write(key + ": (type: " + getObjType(theShip[key]) + ") ");
        console.log(theShip[key]);
      } else if (typeof theShip[key] == "function"){
        let tempVal=theShip[key]();
        if (typeof tempVal == "object"){
          process.stdout.write(key + ": (type: " + getObjType(tempVal) + ") ");
          console.log(tempVal);
        } else if (typeof tempVal == "string"){
          console.log(key + ": " + tempVal);
        } else {
          console.dir(tempVal);
        }
        // console.log(key + ": " + theShip[key]());
      } else if (typeof theShip[key] == "string"){
        console.log(key + ": " + theShip[key]);
      }
    }
  });

  console.log("UID: " + theShip.UID);
  console.log("fullUID: " + theShip.fullUID);
}
function sectorTests(){
  var theSector=new SectorObj(2,2,2);
  var chmodResults;
  console.log("Start:");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- peace");
  console.log("-Peace Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- protected");
  console.log("-Protected Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ peace");
  console.log("Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ protected");
  console.log("Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ nofploss");
  console.log("+ nofploss Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noindications");
  console.log("+ noindications Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noexit");
  console.log("+ noexit Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noenter");
  console.log("+ noenter Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noexit");
  console.log("- noexit Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noindications");
  console.log("- noindications Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noenter");
  console.log("- noenter Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- nofploss");
  console.log("- nofploss Result: " + chmodResults);
  starNetSync("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- frakkin");
  console.log("Attempt at a bullshit change: " + chmodResults);
  // chmodResults=theSector.setChmod("+ noindications");
  // console.log("Attempt at + noindications: " + chmodResults);
  // chmodResults=theSector.setChmod("- noindications");
  // console.log("Attempt at - noindications: " + chmodResults);
  return true;
}
function sectorTests2(){
  var theSector=new SectorObj(2,2,2);
  console.log("Resetting for start:");
  theSector.setChmodNum(0);
  console.log("Performing test 1");
  var test1time=sectorTestHelper2(theSector);
  console.log("Resetting..");
  theSector.setChmodNum(0);
  console.log("Performing test 2");
  var test2time=sectorTestHelper2(theSector,{forcesave:true});
  console.log("Test 1 time: " + test1time + " test 2 time: " + test2time);
}
function sectorTests3(){
  var theSector=new SectorObj(2,2,2);
  console.log("Resetting for start:");
  theSector.setChmodNum(0);
  console.log("Performing test 1");
  var test1time=sectorTestHelper3(theSector);
  console.log("Resetting..");
  theSector.setChmodNum(0);
  console.log("Performing test 2");
  var test2time=sectorTestHelper3(theSector,{forcesave:true});
  console.log("Test 1 time: " + test1time + " test 2 time: " + test2time);
}
function starNetHelperTests(){
  starNetSync("/load_sector_range 2 2 2 2 2 2");
  var testObj=new starNetHelper.ShipInfoUidObj("ENTITY_SHIP_Hello_There");
  console.log("\nDisplaying object (size: " + testObj.size + "):");
  console.dir(testObj);
  console.log("\nWhat is SqlQuery?");
  console.dir(sqlQuery);

  var sqlQueryObj=new sqlQuery.SqlQueryObj("SELECT * FROM PUBLIC.SECTORS WHERE X=2 AND Y=2 AND Z=2;");
  console.log("\nSql query: ");
  console.dir(sqlQueryObj);

  var shipBlocks=starNetHelper.getEntityValue("ENTITY_SHIP_Hello_There","Blocks");
  console.log("\nBlocks: " + shipBlocks);
}
function sectorTestHelper3(theSector,options){
    var startTime=Date.now();
    var randomNum=0;
    for (let i=1;i<=50;i++){
      randomNum=Math.floor(Math.random()*64);
      sectorTestHelper(theSector,randomNum,options);
    }
    sectorTestHelper(theSector,50,options); // These should be super fast since no changes are needed.
    sectorTestHelper(theSector,50,options);
    var timeDifference=colorize(Math.round((Date.now() - startTime) / 1000));
    console.log("Total time: " + timeDifference + " seconds.");
    return timeDifference;
}
function sectorTestHelper2(theSector,options){
    var startTime=Date.now();
    for (let i=1;i<=50;i++){
      sectorTestHelper(theSector,i,options);
    }
    sectorTestHelper(theSector,50,options); // These should be super fast since no changes are needed.
    sectorTestHelper(theSector,50,options);
    var timeDifference=colorize(Math.round((Date.now() - startTime) / 1000));
    console.log("Total time: " + timeDifference + " seconds.");
    return timeDifference;
}
function sectorTestHelper(sectorObj,inputNum,options){
  // console.log("\nSetting sector, '" + sectorObj.toString() + "', to chmod number: " + inputNum + " Values need to be: " + decodeChmodNum(inputNum));
  sectorObj.setChmodNum(inputNum,options);
  // starNetSync("/force_save");
  // console.log("New Chmod Num: " + sectorObj.getChmodNum() + " Chmods: " + sectorObj.getChmodArray());
}
function ipObjTests(){
  var myIPObj=new IPObj("7.7.7.7",Date.now(),{debug:true});
  console.log("Created IPObj");
  console.log("myIPObj.address: " + myIPObj.address);
  console.log("myIPObj.time: " + myIPObj.time);
  console.log("myIPObj.toString(): " + myIPObj.toString());
  console.log("myIPObj.toArray(): " + myIPObj.toArray());
  console.log("myIPObj.ban(60) result: " + myIPObj.ban(60));
  console.log("myIPObj.unban() result: " + myIPObj.unban());
  console.log("myIPObj.ban() result: " + myIPObj.ban());
  console.log("myIPObj.unban() result: " + myIPObj.unban());
  console.log("Attempting to unban the IP again, which should fail:");
  console.log("myIPObj.unban() result: " + myIPObj.unban());
}
function getServerListTest(){
  console.log("Test result: ");
  getServerListArray(showResponseCallback);
}
function lockFileTest(){
  console.log("Creating new lock file..");
  var lockFileObj=new LockFileObj("justTesting.lck");
  console.log("Created new lock file object:");
  console.dir(lockFileObj);
  sleep(4000);
  console.log("\nAdding a few nonsense pids..");
  console.log("Result: " + lockFileObj.addSubProcessPid(12345));
  console.log("Result: " + lockFileObj.addSubProcessPid(32345));
  sleep(2000);
  console.log("\nTrying one of the same nonsense pids again..");
  console.log("Result: " + lockFileObj.addSubProcessPid(12345));
  sleep(2000);
  console.log("\nDeleting serverPid 12345..");
  console.log("Result: " + lockFileObj.delSubProcessPid(12345));
  sleep(2000);
  console.log("\nGrabbed data from file: ");
  console.dir(lockFileObj.getData());
  console.log("Alive Pids Count: " + lockFileObj.countAlivePids());
  console.log("Alive Pids: " + lockFileObj.getAlivePids() + " This script pid: " + process.pid);

  // TODO:  Spawn a process that does not exit and add the PID to the lock file.  See if it kills it successfully.

  // process.on('exit',function(){
  //   console.log("Killing any alive pids, except the main script..");
  //   lockFileObj.killAlivePidsExceptThisProcess();
  //   lockFileObj.deleteFile();
  // });
}

function showResponseCallback(error,output){ // This is a helper function for testing purposes.  It shows any error or output when it's used as a callback function.
  if (error){
    console.error("Error: " + error.toString());
  }
  if (output){
    console.log("output: ");
    console.dir(output);
  }
}

// TESTING END

// The following is outdated since I'm using the global object for javascript instead of passing along the info.
// var server;  // This is needed so objects can send text to the server directly.  I may add the global object to this as well.
// var global;

// function init(theServer,theGlobal) {
//   server=theServer; // This is the spawn childprocess.
//   global=theGlobal;
// }

function ServerObj(spawn){ // This will be used to run server commands or gather specific information regarding the server.
  // TODO:  Make it so the server is actually spawned when this object is created.
  // TODO: Add sections with information on the parameters used for the server, the path to the jar file ran, etc.

  this.filePath="This is just a filler for now till I complete this.";
  this.filePathWithArguments="more filler";
  // TODO:  Need to test all the methods below.
  // Tests done:
  // search
  // status
  // getAdmins
  // getBannedIPs
  // getBannedNames
  // getWhitelistedAccounts
  // getWhitelistedIPs
  // getWhitelistedNames
  this.spawn=spawn;
  this.onlinePlayers=getPlayerList;
  this.getAdmins=function(options){ return getAdminsList(options) };
  this.getBannedAccounts=function(options){ return getBannedAccountsList(options) };
  this.getBannedIPs=function(options){ return getBannedIPList(options) };
  this.getBannedNames=function(options){ return getBannedNameList(options) };
  this.getWhitelistedAccounts=function(options){ return getWhitelistedAccountsList(options) };
  this.getWhitelistedIPs=function(options){ return getWhitelistedIPList(options) };
  this.getWhitelistedNames=function(options){ return getWhitelistedNameList(options) };
  this.msg=function (message,options){ // Sends a message to online players.
    // options can be {"type":plain/info/warning/error} <-- pick one.
    let msgType=getOption(options,"type","plain"); // Default is a plain message, which sends to main chat.
    let messageToSend=toStringIfPossible(message);
    if (testIfInput(messageToSend)){
      if (typeof messageToSend != "string"){
        throw new Error("Invalid input given to ServerObj.msg!");
      }
    } else {
      messageToSend=" "; // no message given, so let's just be nice and assume they want a blank message
    }    
    // I don't think there is any difference between using "plain" with this command and the /chat command.
    return runSimpleCommand("/server_message_broadcast " + msgType + " '" + messageToSend.toString().trim() + "'",options);
  }
  this.botMsg=function (message,options){ // Sends a plain message to the player with the bot's name.
    let messageToSend=toStringIfPossible(message);
    if (testIfInput(message)){
        if (typeof messageToSend != "string"){
          console.error("Invalid input given to ServerObj.botMsg!");
        }
    } else {
      messageToSend=" "; // no message given, so let's just be nice and assume they want a blank bot message
    }
    return global.bot.serverMsg(messageToSend,options); // This should throw an error if there is a problem connecting to the server
  }
  this.clearShipSpawns=function(options){ // clears all ship entities not spawned by a player ie. admin spawned or mobs
    // Note: Be careful with this!  This applies to the entire universe!
    // Does not have success or fail messages
    return runSimpleCommand("/clear_system_ship_spawns_all",options);
  }
  this.daytime=function(timeInHours,options){
    let timeToUse=toNumIfPossible(timeInHours);
    // Does not have success or fail messages
    if (typeof timeToUse == "number"){
      return runSimpleCommand("/daytime " + timeToUse,options);
    } else {
      throw new Error("Invalid input given to Server.daytime() for timeInHours!");
    }
  }
  this.delaySave=function(timeInSeconds,options){
    let timeToUse=toNumIfPossible(timeInSeconds);
    // Does not have success or fail messages
    if (typeof timeToUse == "number"){
      return runSimpleCommand("/delay_save " + timeToUse,options);
    } else {
      throw new Error("Invalid input given to Server.delaySave() for timeInSeconds!");
    }
  }
  this.despawn=function(partOfShipName,used,shipOnly,options){ // Only partOfShipName input is mandatory.
    // Note: Becareful with this because this will despawn ALL ships in the entire universe that match!
    // EXAMPLE: /despawn_all MOB_ unused true
    var partOfShipNameToUse=toStringIfPossible(partOfShipName);
    if (typeof partOfShipNameToUse != "string"){
      throw new Error("Invalid input given to Server.despawn as partOfShipNameToUse!");
    }
    var usedToUse="all";
    var usedTest=toStringIfPossible(used);
    if (typeof usedTest == "string"){
      usedTest=usedTest.toLowerCase();
    }
    if (usedTest == "all" || usedTest == "used" || usedTest == "unused"){
      usedToUse=usedTest;
    }
    var shipOnlyToUse="false";
    if (isTrueOrFalse(shipOnly)){
      shipOnlyToUse=shipOnly;
    }
    return runSimpleCommand("/despawn_all \"" + partOfShipNameToUse + "\" " + usedToUse + " " + shipOnlyToUse,options);
  }
  this.exportSector=function(sector,nameToUse,options){
    var sectorToUse=new SectorObj(sector); // Throws an error if input is bad.
    return sectorToUse.exportSector(nameToUse,options);
  }
  this.importSector=function(sector,nameToUse,options){
    var sectorToUse=new SectorObj(sector); // Throws an error if input is bad.
    return sectorToUse.importSector(nameToUse,options);
  }
  this.exportSectorBulk=function(textFileToUse,options){
    let textFileToUseToUse=toStringIfPossible(textFileToUse);
    if (typeof textFileToUseToUse == "string"){
      return runSimpleCommand("/export_sector_bulk " + textFileToUse,options);
    }
    throw new Error("Invalid textFileToUse specified for Server.exportSectorBulk");
  }
  this.importSectorBulk=function(textFileToUse,options){
    // I should actually check to see if the file specified exists, because I'm guessing no error is returned if the file does not exist, but meh I'll be lazy on this for now.
    let textFileToUseToUse=toStringIfPossible(textFileToUse);
    if (typeof textFileToUseToUse == "string"){
      return runSimpleCommand("/import_sector_bulk " + textFileToUse,options);
    }
    throw new Error("Invalid textFileToUse specified for Server.importSectorBulk");
  }
  this.factionSanityCheck=function(options){ // checks sanity of factions (removes leftover/invalid factions)
    // Does not have success or fail messages
    return runSimpleCommand("/faction_check",options);
  }
  this.factionCreate=function(factionName,playerName,factionNumber,options){ // factionNumber is optional. Can take strings or objects as input
    // Creates a new faction, assigning a player to it.  The faction description will be blank!
    var factionNameToUse=toStringIfPossible(factionName);
    var playerNameToUse=toStringIfPossible(playerName);
    var factionNumberToUse=toNumIfPossible(factionNumber);

    if (typeof factionNameToUse == "string" && typeof playerNameToUse == "string"){
      if (typeof factionNumberToUse == "number"){ // If a faction number is provided
        // Warning:  I do not know what happens if a faction number is given for one that already exists!
        return runSimpleCommand("/faction_create_as " + factionNumberToUse + " " + factionNameToUse + " " + playerNameToUse,options);
      }
      return runSimpleCommand("/faction_create " + factionNameToUse + " " + playerNameToUse,options);
    }
    throw new Error("Invalid parameters given to Server.factionCreate!");
  }
  this.factionCreateAmount=function(factionName,numberOfFactions,options){ // accepts inputs that can be converted to string or number
    // Creates empty, open factions with the same name -- I'm not sure what the purpose of this is exactly.
    var factionNameToUse=toStringIfPossible(factionName);
    var numberOfFactionsToUse=toNumIfPossible(numberOfFactions);
    if (typeof factionNameToUse == "string" && typeof numberOfFactionsToUse == "number"){
      return runSimpleCommand("/faction_create_amount " + factionNameToUse + " " + numberOfFactionsToUse,options);
    }
    throw new Error("Invalid parameters given to Server.factionCreateAmount!");
  }
  this.factionPointTurn=function(options){ // Forces the next faction point calculation turn
    // Does not have success or fail messages
    return runSimpleCommand("/faction_point_turn",options);
  }
  this.fleetSpeed=function(timeInMs,options){
    let numberToUse=toNumIfPossible(timeInMs);
    // Does not have success or fail messages
    if (typeof numberToUse == "number"){
      return runSimpleCommand("/fleet_speed " + numberToUse,options);
    } else {
      throw new Error("Invalid input given to Server.fleetSpeed() for timeInMs!");
    }
  }
  this.fogOfWar=function(trueOrFalse,options){ // Turns fog of war on or off
    let booleanToUse=trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
    // Does not have success or fail messages
    if (isTrueOrFalse(booleanToUse)){
      return runSimpleCommand("/fog_of_war " + booleanToUse,options);
    } else {
      throw new Error("Invalid input given to Server.fogOfWar() for trueOrFalse!");
    }
  }
  this.ignoreDockingArea=function(trueOrFalse,options){ //  enables/disables docking area validation (default off)
    let booleanToUse=trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
    // Does not have success or fail messages
    if (isTrueOrFalse(booleanToUse)){
      return runSimpleCommand("/ignore_docking_area " + booleanToUse,options);
    } else {
      throw new Error("Invalid input given to Server.ignoreDockingArea() for trueOrFalse!");
    }
  }
  this.forceSave=function(options){ // Performs a force save
    // Does not have success or fail messages
    return runSimpleCommand("/force_save",options);
  }
  this.activateWhitelist=function(trueOrFalse,options){ //  activates the whitelist, so only players listed in the whitelist.txt file can join the server.
    let booleanToUse=trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
    // Does not have success or fail messages
    if (isTrueOrFalse(booleanToUse)){
      return runSimpleCommand("/whitelist_activate " + booleanToUse,options);
    } else {
      throw new Error("Invalid input given to Server.activateWhitelist() for trueOrFalse!");
    }
  }
  this.updateShopPrices=function(options){ // Updates shop prices.
    // Does not have success or fail messages
    return runSimpleCommand("/update_shop_prices",options);
  }
  this.sectorSize=function(sizeInM,options){ // Resizes the sector for the server - writes to the server.cfg file
    // WARNING: Setting sector sizes to be smaller can cause some really bizarre issues if entities are now outside of the sector but still inside it!
    let numberToUse=toNumIfPossible(sizeInM);
    if (typeof numberToUse == "number"){
      return runSimpleCommand("/sector_size " + numberToUse,options);
    } else {
      throw new Error("Invalid input given to Server.sectorSize() for sizeInM!");
    }
  }
  this.setWeaponRangeReference=function(sizeInM,options){ // Sets the weapon reference range distance in meters, which config values are multiplied with (default is sector distance)
    let numberToUse=toNumIfPossible(sizeInM);
    if (typeof numberToUse == "number"){
      return runSimpleCommand("/set_weapon_range_reference " + numberToUse,options);
    } else {
      throw new Error("Invalid input given to Server.setWeaponRangeReference() for sizeInM!");
    }
  }
  this.aiSimulation=function(trueOrFalse,options){ //  activates or deactivates AI simulation
    let booleanToUse=trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
    // Does not have success or fail messages
    if (isTrueOrFalse(booleanToUse)){
      return runSimpleCommand("/simulation_ai_enable " + booleanToUse,options);
    } else {
      throw new Error("Invalid input given to Server.aiSimulation() for trueOrFalse!");
    }
  }
  this.simulationClear=function(options){ // Clears all AI from simulation
    // Does not have success or fail messages
    return runSimpleCommand("/simulation_clear_all",options);
  }
  this.simulationSpawnDelay=function(timeInSeconds,options){ // Not sure what this does.  If I had to guess what this is for, it's the delay before pirates come attack when near a pirate station or in void space?  I think the help for this command is wrong which is:  sets the time of the day in hours
    let timeToUse=toNumIfPossible(timeInSeconds);
    if (typeof timeToUse == "number"){
      return runSimpleCommand("/set_weapon_range_reference " + timeToUse,options);
    } else {
      throw new Error("Invalid input given to Server.simulationSpawnDelay() for sizeInM!");
    }
  }
  this.simulationInfo=function(options){ // Prints info about macro AI Simulation
    // this returns a string for now.. I'm not interested in discovery and parsing of the data at this time.
    return starNetVerified("/simulation_info",options);
  }
  this.factionList=function(options){ // Returns an array of FactionObj for all factions on the server.
    var returnArray=[];
    var results=starNetVerified("/faction_list",options);
    // RETURN: [SERVER, FACTION: Faction [id=-9999992
    let theReg=new RegExp("^RETURN: \\[SERVER, FACTION: Faction \\[id=[-]{0,1}[0-9]+.*");
    var theArray=results.trim().split("\n");
    var theLine;
    for (let i = 0;i < theArray.length;i++) {
      if (theReg.test(theArray[i])){
        theLine=theArray[i].match(/^RETURN: \[SERVER, FACTION: Faction \[id=[-]{0,1}[0-9]+/).toString();
        theLine=theLine.match(/[-]{0,1}[0-9]+$/).toString();
        returnArray.push(new FactionObj(theLine));
        theLine="";
      }
    }
    return returnArray; // Array is empty if no factions were found.
  }
  this.blueprintList=function(options){ // Returns an array of FactionObj for all factions on the server.
    var returnArray=[];
    var results=starNetVerified("/list_blueprints",options);
    // RETURN: [SERVER, [CATALOG] INDEX 0: This is another test, 0]
    let theReg=new RegExp("^RETURN: \\[SERVER, \\[CATALOG\\] INDEX.*");
    var theArray=results.trim().split("\n");
    var theLine;
    for (let i = 0;i < theArray.length;i++) {
      if (theReg.test(theArray[i])){
        theLine=theArray[i].replace(/^RETURN: \[SERVER, \[CATALOG\] INDEX [0-9]+: /,"");
        theLine=theLine.replace(/, 0\]$/,"");
        returnArray.push(new BluePrintObj(theLine));
        theLine="";
      }
    }
    return returnArray; // Array is empty if no factions were found.
  }
  this.listControlUnits=function(options){ // Prints info about characters and entities
    // this returns a string for now.. I'm not interested in discovery and parsing of the data at this time, since other commands have better info than this.
    return starNetVerified("/list_control_units",options);
  }
  this.loadSectorRange=function(firstSector,SecondSector,options){ // Allows any input that can create a CoordsObj, including any other Sector or Coords obj
    var sectorToUse1=new CoordsObj(firstSector); // This will error if invalid input is given.
    var sectorToUse2=new CoordsObj(SecondSector);
    return runSimpleCommand("/load_sector_range " + sectorToUse1.toString() + " " + sectorToUse2.toString(),options);
  }
  this.friendlyMissileFire=function(trueOrFalse,options){ //  activates or deactivates friendly fire for missiles.
    let booleanToUse=trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
    // Does not have success or fail messages
    if (isTrueOrFalse(booleanToUse)){
      return runSimpleCommand("/missile_defense_friendly_fire " + booleanToUse,options);
    } else {
      throw new Error("Invalid input given to Server.friendlyMissileFire() for trueOrFalse!");
    }
  }
  this.npcLoadedFleetSpeed=function(floatTime,options){ // Expects a number between 0 and 1, ie. 0.5.  Changes how fast, in percentage, npc fleets travel.
    let numberToUse=toNumIfPossible(floatTime);
    if (typeof numberToUse == "number"){
      if (numberToUse >= 0 && numberToUse <=1){
        return runSimpleCommand("/npc_fleet_loaded_speed " + numberToUse,options);
      }
      throw new Error("Invalid input given to Server.npcLoadedFleetSpeed() for floatTime!  Expects a number between 0 and 1. ie. 0.5");
    } else {
      throw new Error("Invalid input given to Server.npcLoadedFleetSpeed() for floatTime!  Expects a number between 0 and 1. ie. 0.5");
    }
  }
  this.npcTurn=function(options){ // "Turn for all NPC factions"
    return runSimpleCommand("/npc_turn_all",options);
  }
  this.refreshServerMessage=function(options){ // Refreshes the server message that players see upon joining the server from the "server-message.txt" located in the StarMade folder.
    return runSimpleCommand("/refresh_server_msg",options);
  }
  this.restructAABB=function(options){ // "Reconstructs the AABBs of all objects on the server"
    return runSimpleCommand("/restruct_aabb",options);
  }
  this.startCountdown=function(timeInSeconds,message,options){ // Expects a number between 0 and 1, ie. 0.5.  Changes how fast, in percentage, npc fleets travel.
    let numberToUse=toNumIfPossible(timeInSeconds);
    let messageToUse=toStringIfPossible(message);
    if (typeof numberToUse == "number"){
      if (numberToUse >= 1){
        if (typeof messageToUse == "string"){
          return runSimpleCommand("/start_countdown " + numberToUse,options);
        }
        throw new Error("Invalid input given to Server.startCountdown() for message!  Expects a string value!  ie. Explosions happening in..");
      }
      throw new Error("Invalid input given to Server.startCountdown() for timeInSeconds!  Expects a number LARGER than 0! ie. 10");
    } else {
      throw new Error("Invalid input given to Server.startCountdown() for timeInSeconds!  Expects a number larger than 0! ie. 10");
    }
  }
  this.spawnNPCFaction=function(npcName,npcFactionName,npcDescription,initialGrowth,system,options){ // system is optional.  If none given, the npc will be spawned in a random system.
    // DOES NOT GIVE AN ERROR IF THE NPC TYPE IS NOT CORRECT - NEED TO DO MY OWN CHECKING HERE TO SEE IF VALID.
    if (!testIfInput(npcName)){
      throw new Error("No NPC name given to server.spawnNPCFaction!"); // Input was either blank or a blank object or something.
    }
    var npcNameToUse=npcName.toString(); // If it's an object or something that can be converted to a string, we can use the string.  This will throw an error if it cannot be converted to a string.
    if (typeof npcNameToUse != "string"){
      throw new Error("Invalid NPC name given to server.spawnNPCFaction!");
    }
    if (!testIfInput(npcFactionName)){
      throw new Error("No NPC faction name given to server.spawnNPCFaction!"); // Input was either blank or a blank object or something.
    }
    var npcFactionNameToUse=npcFactionName.toString();
    if (typeof npcFactionNameToUse != "string"){
      throw new Error("Invalid NPC faction name given to server.spawnNPCFaction!");
    }

    // Description and initial growth can be blank, but throw error if invalid input given
    var npcDescriptionToUse="";
    if (testIfInput(npcDescription)){
      npcDescriptionToUse=npcDescription.toString();
    }
    var initialGrowthToUse=10;
    if (isNum(initialGrowth)){
      initialGrowthToUse=initialGrowth;
    }
    if (testIfInput(system)){ // Check to see if the system is valid
      try {
        var systemToUse=new SystemObj(system); // this will throw an error if invalid input given.
      } catch (err) {
        throw new Error("Invalid System given to server.spawnNPCFaction!");
      }
    }

    // /npc_spawn_faction_pos_fixed
    // DESCRIPTION: Spawns a faction on a fixed position
    // PARAMETERS: name(String), description(String), preset (npc faction config folder name)(String), Initial Growth(Integer), System X(Integer), System Y(Integer), System Z(Integer)
    // EXAMPLE: /npc_spawn_faction_pos_fixed "My NPC Faction" "My Faction's description" "Outcasts" 10 12 3 22
    if (systemToUse){
      // This is lazy and might return an error in the systemobj rather than pointing here: return systemToUse.spawnNPCFaction(npcName,npcFactionName,npcDescription,initialGrowth,options);
      return runSimpleCommand("/npc_spawn_faction_pos_fixed \"" + npcNameToUse + "\" \"" + npcFactionNameToUse + "\" \"" + npcDescriptionToUse + "\" " + initialGrowthToUse + " " + systemToUse.toString(),options);
    } else {
      return runSimpleCommand("/npc_spawn_faction \"" + npcNameToUse + "\" \"" + npcFactionNameToUse + "\" \"" + npcDescriptionToUse + "\" " + initialGrowthToUse,options);
    }
  }
  this.search=function(partOfEntityName,options){ // Searches for entities by part of their name.  Accepts inputs that can be converted to string
    // Returns a compound array of EntityObj and SectorObj
    // Example: [[ entityObj, sectorObj],[ entityObj, sectorObj ], [entityObj, sectorObj ]]
    var partOfEntityNameToUse=toStringIfPossible(partOfEntityName);
    if (typeof partOfEntityNameToUse == "string"){
      var returnArray=[];
      var results=starNetVerified("/search " + partOfEntityNameToUse,options);
      let theReg=new RegExp("RETURN: \\[SERVER, FOUND: .*");
      var resultsArray=starNetHelper.returnMatchingLinesAsArray(results,theReg);
      var shipName;
      var shipCoords;
      var line;
      var tempArray=[];
      for (let i=0;i<resultsArray.length;i++){
        line=resultsArray[i].replace(/^RETURN: \[SERVER, FOUND: /,"");
        shipName=line.replace(/ ->.*$/,"");
        shipCoords=line.replace(/^.* -> \(/,"").replace(/\), 0\]$/,"").split(", ");
        tempArray.push(new EntityObj("",shipName));
        tempArray.push(new SectorObj(shipCoords));
        returnArray.push(tempArray);
        tempArray=[];
      }
      // RETURN: [SERVER, FOUND: second_name -> (2, 2, 2), 0]
      // RETURN: [SERVER, FOUND: And this is named -> (1000, 998, 1000), 0]
      // RETURN: [SERVER, END; Admin command execution ended, 0]
      return returnArray;
    }
    throw new Error("Invalid parameters given to Server.search!");
  }
  this.status=function(options){ // returns an object with the server's status, as reported by /server_status
    let results=starNetVerified("/status",options);
    // RETURN: [SERVER, PhysicsInMem: 0; Rep: 1, 0]
    // RETURN: [SERVER, Total queued NT Packages: 0, 0]
    // RETURN: [SERVER, Loaded !empty Segs / free: 189 / 184, 0]
    // RETURN: [SERVER, Loaded Objects: 82, 0]
    // RETURN: [SERVER, Players: 1 / 32, 0]
    // RETURN: [SERVER, Mem (MB)[free, taken, total]: [214, 631, 845], 0]
    var returnObj={ };
    var searchReg=/^RETURN: \[SERVER, PhysicsInMem: .*/;
    var remReg1=/^RETURN: \[SERVER, PhysicsInMem: /;
    var remReg2=/, 0\]$/;
    var physicsLine=returnLineMatch(results,searchReg,remReg1,remReg2);
    var physicsArray=physicsLine.split("; Rep:");
    returnObj["physics"]=toNumIfPossible(physicsArray[0]);
    returnObj["physicsRep"]=toNumIfPossible(physicsArray[1]);

    searchReg=/^RETURN: \[SERVER, Total queued NT Packages: .*/;
    remReg1=/^RETURN: \[SERVER, Total queued NT Packages: /;
    remReg2=/, 0\]$/;
    returnObj["queuedNTPackages"]=toNumIfPossible(returnLineMatch(results,searchReg,remReg1,remReg2));

    searchReg=/^RETURN: \[SERVER, Loaded !empty Segs \/ free:.*/;
    remReg1=/^RETURN: \[SERVER, Loaded !empty Segs \/ free: /;
    remReg2=/, 0\]$/;
    var loadedSegsLine=returnLineMatch(results,searchReg,remReg1,remReg2);
    var loadedSegsArray=loadedSegsLine.split(" / ");
    returnObj["loadedEmptySegs"]=toNumIfPossible(loadedSegsArray[0]);
    returnObj["loadedEmptySegsFree"]=toNumIfPossible(loadedSegsArray[1]);

    searchReg=/^RETURN: \[SERVER, Loaded Objects: .*/;
    remReg1=/^RETURN: \[SERVER, Loaded Objects: /;
    remReg2=/, 0\]$/;
    returnObj["loadedObjects"]=toNumIfPossible(returnLineMatch(results,searchReg,remReg1,remReg2));

    searchReg=/^RETURN: \[SERVER, Players: .*/;
    remReg1=/^RETURN: \[SERVER, Players: /;
    remReg2=/, 0\]$/;
    var playersLine=returnLineMatch(results,searchReg,remReg1,remReg2);
    var playersArray=playersLine.split(" / ");
    returnObj["players"]=toNumIfPossible(playersArray[0]);
    returnObj["playersMax"]=toNumIfPossible(playersArray[1]);

    searchReg=/^RETURN: \[SERVER, Mem \(MB\)\[free, taken, total\]: \[.*/;
    remReg1=/^RETURN: \[SERVER, Mem \(MB\)\[free, taken, total\]: \[/;
    remReg2=/\], 0\]$/;
    var memLine=returnLineMatch(results,searchReg,remReg1,remReg2);
    var memArray=memLine.split(", ");
    returnObj["memFree"]=toNumIfPossible(memArray[0]);
    returnObj["memTaken"]=toNumIfPossible(memArray[1]);
    returnObj["memTotal"]=toNumIfPossible(memArray[2]);
    return returnObj;
  }

  // /status
  // DESCRIPTION: Displays server status
  // PARAMETERS:
  // EXAMPLE: /status
  

  // shutdown(seconds,"message") // message is optional.  If given, a countdown timer will be used and then a 1 second shutdown when it is set to expire.
  // ip
  // 


};
function BotObj(botName){
  var theBotName=botName.toString(); // This is to allow other objects that can be converted to a string to be used, such as mimicking a player's name, but will return an error if it cannot be turned into a string.
  if (typeof theBotName == "string"){
    this.name=theBotName;
    this.msg=function(player,msgString,options,cb){ // This expects a player object OR a string with a player's name, then the message to send, either as a string or an object that can be converted to a string with .toString()
      var theMessage=toStringIfPossible(msgString); // This allows certain objects that can be converted to strings to be used, such as matches or other objects
      if (typeof theMessage == "string"){
        var thePlayer=new PlayerObj(player); // This creates a new playerObj with the playername string or PlayerObj
        return thePlayer.msg("[" + this.name + "]: " + theMessage,options,cb); // Any options PlayerObj.msg can take will be forwarded to it.
      } else {
        var theError=new Error("Error with BotObj.msg command.  Invalid input given to message player with!")
        if (typeof cb=="function"){
          return cb(theError,false); // Could not send message, so both error and false.
        } else {
          throw theError; // Behavior of Sync is to throw an error.
        }
        
      }
    }
    this.serverMsg=function(msgString,options){ // This expects the message to send either as a string or an object that can be converted to a string
      var theMessage=toStringIfPossible(msgString); // This allows certain objects that can be converted to strings to be used, such as matches or other objects
      if (typeof theMessage == "string"){
        global.server.msg("[" + this.name + "]: " + theMessage,options); // options are forwarded to server.msg
      } else {
        throw new Error("Invalid message given to BotObj.serverMsg!");
      }
    }
  } else {
    throw new Error("Invalid botName given to BotObj!");
  }
};
function ServerSpawnObj(configurationName,lockFileObj){ // I am discontinuing this idea and focusing on making starmade.js a single-server wrapper to start with. // TODO: Remove this object
  // configurationName is the name of the server from the settings.json file under the section "servers".
  // All configuration values specific to that name will be created if they don't exist alrady.
  // The goal here is to have this object be the root of running server based commands, such as force_save, shutdown, etc.

  // TODO:  This should do all the installation, verification, spawning, etc, necessary to get this spawn up and running and then add it's PID to the lock file.

  // Should this create a new server entry in the master settings file if configurationName is blank?  Or should it use default settings?  Hmm..

  // Load the settings.json file from the main dir.
  this.settings=setSettings(configurationName); // This will return the settings, setting them if needed by asking questions.
  // Build the java arguments, separating by java arguments and arguments passed to StarMade.jar
  this.starMadeJar=path.join(this.settings["starMadeInstallFolder"],"StarMade.jar");
  var baseJavaArgs=["-Xms" + this.settings["javaMin"], "-Xmx" + this.settings["javaMax"],"-jar"]; // These run on any OS.  TODO: Add support for JVM arguments
  var baseJavaArgsWindows=["-Xincgc","-Xshare:off"]; // These will run on windows only
  var baseSMJarArgs=[this.starMadeJar,"-server", "-port:" + this.settings["port"]];
  if (process.platform == "win32"){
    this.javaArgs=baseJavaArgs.concat(baseJavaArgsWindows).concat(baseSMJarArgs);
  } else {
    this.javaArgs=baseJavaArgs.concat(baseSMJarArgs);
  }
  this.cfgFile=path.join(this.settings["starMadeInstallFolder"],"server.cfg");
  this.cfg=function(){ return ini.getFileAsObj(this.cfgFile) }; // This generates a new ini file object each time it's ran

  this.event=new new events.EventEmitter(); // This is for custom events
  if (getObjType(lockFileObj) == "LockFileObj"){ // Only set the lock file if it's provided.
    this.lockFile=lockFileObj;
  }
  // Perform any install needed


  // Verify any install


  this.getServerList=function(cb){
    if (getObjType(cb) == "Function"){
      return getServerListArray(cb); // This does NOT return the server list.  It returns a  <http.ClientRequest> object (https://nodejs.org/api/http.html#http_class_http_clientrequest).  The callback function must handle the actual server list.  Example: cb(err,serverListString)
    }
    throw new Error("ERROR: No callback function provided to getServerList method on ServerObj!  Example: myServerObj.getServerList(myFunction)");
  }

  // The last thing we do is spawn the StarMade instance
  this.spawn=spawn("java",this.javaArgs,{"cwd": this.settings["starMadeInstallFolder"]});
  // Register the spawn with the lock file and set up exit events.
};
function MessageObj(sender,receiver,receiverType,message){
  // Takes string values and converts to strings or objects of the correct types
  this.sender=new PlayerObj(sender); // This should ALWAYS be a player sending a message
  if (receiverType=="DIRECT"){ // This is a private message sent from one player to another
    this.type="private";
    this.receiver=new PlayerObj(receiver);
  } else if (receiverType=="CHANNEL"){
    this.type="channel";
    this.receiver=new ChannelObj(receiver);
  } else { // This should never happen, but hey maybe in the future they'll expand on the receiverTypes
    this.receiver=receiver; // This is a string, which is no bueno, and is only temporary till receiverTypes are broken down
    this.type=receiverType;
    console.error("ERROR: Unknown Receiever type for message! Set receiver and type as string! " + receiverType);
  }
  this.text=message;
};
function ChannelObj(channelName){
  var factionTest=new RegExp("^Faction-{0,1}[0-9]+");
  if (channelName == "all"){
    this.type="global";
  } else if (factionTest.test(channelName)){
    var getFactionNumberReg=new RegExp("-{0,1}[0-9]+$");
    this.type="faction";
    var factionNumber=toNumIfPossible(channelName.match(getFactionNumberReg));
    if (testIfInput(factionNumber)){
      this.factionNumber=factionNumber.toString();
    }
    if (testIfInput(this.factionNumber)){
      this.faction=new FactionObj(this.factionNumber);
    }
  } else {
    this.type="named";
  }
  this.name=channelName;
};
function IPObj(ipAddressString,date,options){
  // Example:  var myIPObj = new IpObj("192.0.0.100",Date.now());
  // ipAddressString should look something like "7.7.7.7"
  // date can be a string that "new Date()" can turn into an object or can be a Date object.  It's easier to debug if you create the date object yourself and then pass it here, so if there are any issues, the stack trace will point to the place where the bad string is attempted to be converted to a Date object.
  // Options is optional and should be an object, which is passed to subcommands.  Right now only {debug:true} is supported.

  this.address=ipAddressString;
  if (typeof date != "undefined"){ // We're using typeof because we don't want to do a truthy assessment
    var possibleDate=createDateObjIfPossible(date);  // Returns false if no information given or invalid information.  Returns a date object if given a date object.
    if (!possibleDate){
      console.error("Unable to use date information given when creating new IpObj for IP, " + ipAddressString + "! Invalid date information: " + date);
    }
  }
  if (possibleDate){ this.date = possibleDate } // If date information is given, but it is invalid, it will NOT be included in this object.
  // TODO:  Redo this section to standardize with the same options given as the PlayerObj
  this.ban=function(minutes){ return ipBan(this.address,minutes,options) };
  this.unban=function(){ return ipUnBan(this.address,options) };

  this.isBanned=function(){
    return isIPBanned(this.address);
  }
  this.isWhitelisted=function(){
    return isWhitelisted(this.address);
  }
  // To test:
  // isBanned()
  // isWhitelisted()

  // TODO: Add Info Methods:
  // date - This will only be set if the IP is attached to a date somehow, such as when listing all the IP's for a player

  // Action Methods:
  // ban(time) - PERM BAN if no time given, otherwise a temp ban

  // Optional:
  // crawl(Num) - reveals all players who share the same IP.  If a Num is provided, then will crawl that level deep, gathering more IP's and ipcrawling those.
};
function SMNameObj(smName){
  this.name=smName;
  // TODO:

  // TO TEST:
  // ban(time,options) // /ban_account Benevolent27
  // isBanned()
  // isWhitelisted()

  // DONE:
  // getNames - Returns an array of PlayerObj's for all the usernames associated with this registry account name
  this.isBanned=function (){ // Returns true or false depending on whether it is banned or not
    return isAccountBanned(this.name);
  }
  this.isWhitelisted=function(){
    return isAccountWhitelisted(this.name);
  }

  this.ban=function (timeToBan,options){ // timeToBan is optional.  If no number given, it will be a perm ban.  Options can be {"fast":true}
    var theTimeToUse=toNumIfPossible(timeToBan);
    if (typeof theTimeToUse=="number"){ // temp ban
      console.log("Banning player account: " + this.name);
      return runSimpleCommand("/ban_account_temp " + this.name,options + " " + theTimeToUse);
    } else { // permban
      console.log("Banning player account: " + this.name);
      return runSimpleCommand("/ban_account " + this.name,options);    
    }
  }
  this.getNames=function(){ // Returns an array of PlayerObj's for all the usernames associated with this registry account name
    var theSmNameToUse=this.name.toLowerCase(); // This is in case the smname returned has uppercase letters.  The sql db will ALWAYS have it in lowercase.
    var sqlQuery=new SqlQueryObj("SELECT NAME FROM PUBLIC.PLAYERS WHERE STARMADE_NAME='" + theSmNameToUse + "'");
    console.dir(sqlQuery);
    var outputArray=[];
    if (!sqlQuery.error){ // This will be false if there was no error
      for (let i=0;i<sqlQuery.objArray.length;i++){
        outputArray.push(new PlayerObj(sqlQuery.objArray[i].NAME));
      }
    }
    return outputArray;
  }
};

function runSimpleCommand(theCommand,options,cb){ // If no cb is given, it will run syncronously
  // This is used for PlayerObj methods that can be sent to either the console or using StarNet
  if (theCommand){
    var fast=getOption(options,"fast",false);
    var msgTestFail=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[ERROR\\]");
    // RETURN: [SERVER, Admin command failed: Error packing parameters, 0]
    // RETURN: [SERVER, Admin command failed: Error packing parameters, 0]
    var msgTestFail2=new RegExp("^RETURN: \\[SERVER, Admin command failed: Error packing parameters, 0\\]")
    if (fast==true){
      return sendDirectToServer(theCommand,cb);
    } else if (typeof cb == "function"){
      starNetHelper.starNetVerified(theCommand,options,function(err,msgResult){
        if (err){
          return cb(err,msgResult);
        } else if (starNetHelper.checkForLine(msgResult,msgTestFail) || starNetHelper.checkForLine(msgResult,msgTestFail2)){ // The player was offline, did not exist, or other parameters were incorrect.
            return cb(err,false); // err will be null
        } else { // The command appears to have not failed, so let's assume it succeeded.
          return cb(err,true); // Err will be null
        }
      });
    } else {
      var msgResult=starNetHelper.starNetVerified(theCommand); // This will throw an error if the connection to the server fails.
      if (starNetHelper.checkForLine(msgResult,msgTestFail) || starNetHelper.checkForLine(msgResult,msgTestFail2)){ // The player was offline, did not exist, or other parameters were incorrect.
        return false;
      } else { // The command appears to have not failed, so let's assume it succeeded.
        return true;
      }
    }
  }
  return false;
};

function simplePromisifyIt2(functionToCall,options,firstParameter){ // If there is no first parameter, use "" as the input here.
  // Takes a callback function with options specified.
  // if no firstParameter is given example: this.msg(options,cb)
  // If a firstParameter is given example: this.msg(message,options,cb)
  // Note: If no first parameter, use "" as the input!
  if (typeof functionToCall == "function"){
    var theFunctionToCall=functionToCall;
    var theFirstParameter=firstParameter;
    return new Promise(function(resolve,reject){
      if (theFirstParameter==""){
        console.log("promise created WITHOUT parameter");
        theFunctionToCall(options,function(err,result){
          if (err){
            reject(err);
          } else {
            resolve(result);
          }
        });
      } else {
        console.log("promise created WITH parameter");
        theFunctionToCall(theFirstParameter,options,function(err,result){
          console.log("This is the err: " + err); //temp
          console.log("This is the result: " + result); //temp
          if (err){
            reject(err);
          } else {
            resolve(result);
          }
        });
      }
    });
  }
  throw new Error("Invalid input given to simplePromisifyIt as functionToCall!");
}

function simplePromisifyIt(cbFunctionToCall,options){ // This is used to turn callback functions that follow the convention used by objectCreator.js into promises
  // Takes a callback function with options and arguments specified.
  // Can take additional parameters as extra arguments after the "options" argument.  Example: simplePromisifyIt(self.whatever,options,someVal,anotherVal,AnotherVal)
  
  // As an example, if no extra parameters are needed, such as for the PlayerObj, self.isBanned(options,cb)
  // ie: simplePromisifyIt(self.isBanned,options)

  // If 1 additional parameter is given, this can be used for the PlayerObj method, this.msg(message,options,cb)
  // ie: simplePromisifyIt(self.msg,options,message)

  // Any additional parameters given are added to the BEGINNING of the this.whatever method, since the callback should always be at the end, and options should always be second from last.

  if (typeof functionToCall == "function"){
    // console.log("Running with arguments: ");
    // console.dir(arguments);
    var args=Array.from(arguments);
    // console.log("arguments as an array: " + args);
    var theFunctionToCall=cbFunctionToCall;
    args.splice(0,2); // Splicing while making the array doesn't seem to work properly
    // console.log("args spliced: ");
    // console.dir(args);
    if (args.length<0){ // arguments were used
      return new Promise(function(resolve,reject){
        console.log("promise created WITHOUT parameter");
        theFunctionToCall(options,function(err,result){
          if (err){
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    } else { // No arguments were used, so we should not expand them
      return new Promise(function(resolve,reject){
        // console.log("promise created WITH parameter(s)");
        theFunctionToCall(...args,options,function(err,result){
          // console.log("This is the err: " + err); //temp
          // console.log("This is the result: " + result); //temp
          if (err){
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    }
  }
  throw new Error("Invalid input given to simplePromisifyIt as functionToCall!");
}

function PlayerObj(player){ // "Player" must be a string and can be just the player's nickname or their full UID
  if (player){
    var self = this; // this is needed to reference the "this" of functions in other contexts, particularly for creating promises via the outside function.  If "this" is used, the promisify function will not work correctly.
    var playerName=player.toString().trim(); // This allows the player input to be another PlayerObj
    // var playerName=player.replace(/^ENTITY_PLAYERCHARACTER_/,"").replace(/^ENTITY_PLAYERSTATE_/,""); // strip the UID
    self.name=playerName.replace(/^ENTITY_PLAYERCHARACTER_/,"").replace(/^ENTITY_PLAYERSTATE_/,""); // strip the UID
    self.msg=function (message,options,cb){ // if no cb is given, this will run sync, returning true or false depending on success and throwing an error if failed connection.  Sends a message to the player.  Type is optional.  If not provided "plain" is used.
      var msgType=getOption(options,"type","plain").toLowerCase(); // This does not throw an error if invalid options are specified.
      var msgToUse=toStringIfPossible(message);
      console.log("This is the string we are attempting to use: " + msgToUse);
      console.log("And this is before any changes: " + message);
      if (typeof msgToUse == "string"){
        return runSimpleCommand("/server_message_to " + msgType + " " + self.name + "'" + message.toString().trim() + "'",options,cb);
      } else {
        throw new Error("Invalid message given to PlayerObj.msg!");
      }
    }
    self.msgPromise=function(message,options){
      return simplePromisifyIt(self.msg,options,message);
    }

    self.botMsg=function (message,options,cb){ // cb is optional, runs as Sync if not given.  Sends a plain message to the player with the bot's name.
      console.log("Working on messagae for PlayerObj.botMsg: " + message);
      var messageToSend=toStringIfPossible(message);
      if (!testIfInput(messageToSend) || messageToSend == "" || typeof messageToSend == "undefined"){
        messageToSend=" ";  // If empty, let's assume they meant to send an empty line.
      }
      if (typeof messageToSend != "string"){ // Some kind of object that could not convert to a string was provided
        var theError=new Error("Invalid input given to PlayerObj.botMsg!");
        throw theError;
      }
      // console.log("Sending bot message: " + messageToSend);
      return global.bot.msg(self.name,messageToSend,options,cb); // This should throw an error if there is a problem connecting to the server
    }
    self.botMsgPromise=function(message,options){
      return simplePromisifyIt(self.botMsg,options,message);
    }


    self.creativeMode=function (input,options,cb){ // expects true or false as either boolean or string
      if (isTrueOrFalse(input)){
        return runSimpleCommand("/creative_mode " + self.name + " " + input,options,cb);
      }
      return false;
    }
    self.godMode=function (input,options,cb){ // expects true or false as either boolean or string
      if (isTrueOrFalse(input)){
        return runSimpleCommand("/god_mode " + self.name + " " + input,options,cb);
      }
      return false;
    }
    self.invisibilityMode=function (input,options,cb){ // expects true or false as either boolean or string
      if (isTrueOrFalse(input)){
        return runSimpleCommand("/invisibility_mode " + self.name + " " + input,options,cb);
      }
      return false;
    }
    
    self.isBanned=function(options,cb){
      return isNameBanned(self.name,options,cb);
    }
    self.isBannedPromise=function(options){ // testing
      return new Promise(function(resolve,reject){
        self.isBanned(options,function(err,result){
          if (err){
            reject(err);
          } else {
            resolve(result);
          }
        });
      })
    }
    self.isWhitelisted=function(){
      return isNameWhitelisted(self.name);
    }
    self.factionPointProtect=function (input,options){ // expects true or false as either boolean or string
      if (isTrueOrFalse(input)){
        return runSimpleCommand("/faction_point_protect_player " + self.name + " " + input,options);
      }
      return false;
    }
    self.give=function (input,number,options){ // expects an element name and number of items to give
      if (testIfInput(input) && isNum(number)){
        return runSimpleCommand("/give " + self.name + " " + input + " " + number,options);
      }
      return false;
    }
    self.giveId=function (inputNumber,number,options){ // expects an element id and number of items to give
      if (isNum(inputNumber) && isNum(number)){
        return runSimpleCommand("/giveid " + self.name + " " + inputNumber + " " + number,options);
      }
      return false;
    }
    self.giveAllItems=function (number,options){ // expects an element name and number of items to give
      if (isNum(number)){
        return runSimpleCommand("/give_all_items " + self.name + " " + number,options);
      }
      return false;
    }
    self.giveCategoryItems=function (category,number,options){ // expects a category such as terrain/ship/station and number of items to give
      if (testIfInput(category) && isNum(number)){
        return runSimpleCommand("/give_category_items " + self.name + " " + number + " " + category,options);
      }
      return false;
    }
    self.giveCredits=function (number,options){ // expects a number of credits to give.  If this value is negative, it will subtract credits.
      if (isNum(number)){
        return runSimpleCommand("/give_credits " + self.name + " " + number,options);
      }
      return false;
    }
    self.giveGrapple=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (number>1){ countTo=theNum; }
      }
      for (var i=0;countTo>i;i++){
        result=runSimpleCommand("/give_grapple_item " + self.name,options);
      }
      return result;
    }
    self.giveGrappleOP=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        result=runSimpleCommand("/give_grapple_item_op " + self.name,options);
      }
      return result;
    }
    self.giveHealWeapon=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        result=runSimpleCommand("/give_heal_weapon " + self.name,options);
      }
      return result;
    }
    self.giveLaserWeapon=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        result=runSimpleCommand("/give_laser_weapon " + self.name,options);
      }
      return result;
    }
    self.giveLaserWeaponOP=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        result=runSimpleCommand("/give_laser_weapon_op " + self.name,options);
      }
      return result;
    }
    self.giveMarkerWeapon=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        result=runSimpleCommand("/give_marker_weapon " + self.name,options);
      }
      return result;
    }
    self.giveTransporterMarkerWeapon=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        result=runSimpleCommand("/give_transporter_marker_weapon " + self.name,options);
      }
      return result;
    }
    self.givePowerSupplyWeapon=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        result=runSimpleCommand("/give_power_supply_weapon " + self.name,options);
      }
      return result;
    }
    self.giveRocketLauncher=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        // result=sendDirectToServer("/give_rocket_launcher_weapon " + self.name); // the input should never fail, so this should normally always return true
        result=runSimpleCommand("/give_rocket_launcher_weapon " + self.name,options);
      }
      return result;
    }
    self.giveRocketLauncherOP=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        // result=sendDirectToServer("/give_rocket_launcher_op " + self.name); // the input should never fail, so this should normally always return true
        result=runSimpleCommand("/give_rocket_launcher_op " + self.name,options);
      }
      return result;
    }
    self.giveSniperWeapon=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        // result=sendDirectToServer("/give_sniper_weapon " + self.name); // the input should never fail, so this should normally always return true
        result=runSimpleCommand("/give_sniper_weapon " + self.name,options);
      }
      return result;
    }
    self.giveSniperWeaponOP=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        // result=sendDirectToServer("/give_sniper_weapon_op " + self.name); // the input should never fail, so this should normally always return true
        result=runSimpleCommand("/give_sniper_weapon_op " + self.name,options);
      }
      return result;
    }
    self.giveTorchWeapon=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        // result=sendDirectToServer("/give_torch_weapon " + self.name); // the input should never fail, so this should normally always return true
        result=runSimpleCommand("/give_torch_weapon " + self.name,options);
      }
      return result;
    }
    self.giveTorchWeaponOP=function (number,options){ // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
        if (theNum>1){ countTo=theNum; } 
      }
      for (var i=0;countTo>i;i++){
        // result=sendDirectToServer("/give_torch_weapon_op " + self.name); // the input should never fail, so this should normally always return true
        result=runSimpleCommand("/give_torch_weapon_op " + self.name,options);
      }
      return result;
    }
    self.kill=function (options){ // kills the player
      // return sendDirectToServer("/kill_character " + self.name);
      return runSimpleCommand("/kill_character " + self.name,options);
    }
    self.kick=function (reason,options){ // Reason is optional.  Note that since reason is optional, this will always return true.
      if (testIfInput(reason)){
        // return sendDirectToServer("/kick_reason " + self.name + "'" + reason.toString().trim() + "'");
        return runSimpleCommand("/kick_reason " + self.name + "'" + reason.toString().trim() + "'",options);
      } else {
        // return sendDirectToServer("/kick " + self.name);
        return runSimpleCommand("/kick " + self.name,options);
      }
    }
    self.setFactionRank=function (number,options){ // expects a number 1-5.  5 is founder, 1 is lowest rank.
      if (isNum(number)){
        if (number>=1 && number<=5){
          // return sendDirectToServer("/faction_mod_member " + self.name + " " + number);
          return runSimpleCommand("/faction_mod_member " + self.name + " " + number,options);
        }
        return false; // The number was invalid
      }
      return false; // the input was invalid
    }
    self.addAdmin=function (options){ // Adds the player as an admin
      // this gives a warning if player does not exist on the server, so runSimpleCommand will not work
      // TODO: I need separate text processing for this:
      // RETURN: [SERVER, [ADMIN COMMAND] [WARNING] 'sdflkjdsf' is NOT online. Please make sure you have the correct name. Name was still added to admin list, 0]
      // When successful, no specific message returned.
      // return sendDirectToServer("/add_admin " + self.name);
      return runSimpleCommand("/add_admin " + self.name,options); 
      // Since this will add a player that is even offline, there is no check to ensure the name is a valid one and so this will not return false if the player is offline either.
    }
    self.removeAdmin=function (options){ // Removes the player as an admin
      // return sendDirectToServer("/remove_admin " + self.name);
      return runSimpleCommand("/remove_admin " + self.name,options);
    }
    self.addAdminDeniedCommand=function (commandOrCommands,options){ // Adds denied commands for an admin, input can be an array of commands to deny.  It will cycle through them all.
      // Note:  This does not check to ensure the command actually exists.
      var returnVal=true;
      var result;
      if (typeof commandOrCommands == "object"){ // An array is an object typeof
        if (commandOrCommands instanceof Array){ // This is how you figure out it is an array.  We cannot do this directly, because if it is not an object, this will throw an error.
          if (commandOrCommands.length){ // This is to make sure it isn't an empty array
            for (var i=0;i<commandOrCommands.length;i++){
              // result=sendDirectToServer("/add_admin_denied_comand " + self.name + " " + commandOrCommands[i]);
              result=runSimpleCommand("/add_admin_denied_comand " + self.name + " " + commandOrCommands[i],options);
              if (result===false){ returnVal=false; } // This works as a latch, so that if ANY of the commands fail, it returns false
            }
            return returnVal; // This will return false if ANY of the inputs failed.
          } else {
            return false;
          }
        }
        return false; // This handles if an object of another type was given, which would be invalid.
      } else if (testIfInput(commandOrCommands)){ // This would trigger for strings or numbers.
        // return sendDirectToServer("/add_admin_denied_comand " + self.name + " " + commandOrCommands);
        return runSimpleCommand("/add_admin_denied_comand " + self.name + " " + commandOrCommands,options);
      }
      return false; // This should never happen.
    }
    self.removeAdminDeniedCommand=function (commandOrCommands,options){ // Adds denied commands for an admin, input can be an array of commands to deny.  It will cycle through them all.
      // Note:  This does not check to ensure the command actually exists.
      var returnVal=true;
      var result;
      if (typeof commandOrCommands == "object"){ // An array is an object typeof
        if (commandOrCommands instanceof Array){ // This is how you figure out it is an array.  We cannot do this directly, because if it is not an object, this will throw an error.
          if (commandOrCommands.length){ // This is to make sure it isn't an empty array
            for (var i=0;i<commandOrCommands.length;i++){
              // result=sendDirectToServer("/remove_admin_denied_comand " + self.name + " " + commandOrCommands[i]);
              result=runSimpleCommand("/remove_admin_denied_comand " + self.name + " " + commandOrCommands[i],options);
              if (result===false){ returnVal=false; }
            }
            return returnVal; // This will return false if ANY of the inputs failed.
          } else {
            return false;
          }
        }
        return false; // This handles if an object of another type was given, which would be invalid.
      }
      if (testIfInput(commandOrCommands)){ // This would trigger for strings or numbers.
        // return sendDirectToServer("/remove_admin_denied_comand " + self.name + " " + commandOrCommands);
        return runSimpleCommand("/remove_admin_denied_comand " + self.name + " " + commandOrCommands,options);
      }
      return false; // This should never happen.
    }
    self.unban=function (options){
      return runSimpleCommand("/unban_name " + self.name,options);
      // Note that this does not unban their ip or smname
    }
    self.ban=function (toKick,reason,time,options){ // No value is mandatory, but toKick will be true by default if not specified.  toKick should be true/false. Time is in minutes.
      // Note that a player MUST BE ONLINE in order for the kick to work.
      // Note that no reason is given to the player if they are not kicked.
      // Also note that this ban does not apear to actually work.  It will kick the player, but then they can just rejoin.  An IP ban or ban via SMNameObj will actually be effective.
      // If options are specified, the other values can be ""
      console.log("Banning player: " + self.name);
      // return sendDirectToServer("/ban " + self.name + " " + toKick + " '" + reason.toString().trim() + "' " + time);
      var banArray=[];
      banArray.push("/ban");
      banArray.push(self.name);
      if (isTrueOrFalse(toKick)){
        banArray.push(toKick);
      } else {
        banArray.push(true); // By default the command will kick the player. But this will lead to "false" being returned if they are offline
      }
      if (testIfInput(reason)){
        banArray.push("'" + reason + "'");
      } else {
        banArray.push("''");
      }
      if (isNum(time)){
        banArray.push(time);
      }
      var banString=banArray.join(" ");
      console.log("Banning player with string: " + banString);
      return runSimpleCommand(banString,options);
    }
    self.giveMetaItem=function (metaItem,number,options){ // number is optional, but if options are given, it should be "".  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      // EXAMPLE: /give_metaitem schema blueprint, recipe, log_book, helmet, build_prohibiter, flash_light, virtual_blueprint, block_storage, laser, heal, power_supply, marker, rocket_launcher, sniper_rifle, grapple, torch, transporter_marker
      // Note:  The primary usage for this is for log_book, helmet, and build_prohibiter
      var theNum=toNumIfPossible(number);
      var countTo=1; // The default times to run the command is 1
      var result;
      var resultToReturn=true;
      if (testIfInput(metaItem)){
        if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.  We don't use 'isNum()' since this would be duplicating efforts.
          if (theNum>1){ countTo=theNum; } 
        }
        for (var i=0;countTo>i;i++){
          // result=sendDirectToServer("/give_metaitem " + self.name + " " + metaItem.toString().trim()); // the input should never fail, so this should normally always return true
          result=runSimpleCommand("/give_metaitem " + self.name + " " + metaItem.toString().trim(),options);
          if (result===false){
            resultToReturn=false;
          }
        }
        return resultToReturn; // If any of the commands given to the server are invalid, then this will be false
      }
      return false; // The input was invalid, so return false.
    }
    self.isOnline=function(){ return isPlayerOnline(self.name) }; // Conforms to the standard of throwing an error on connection error, but gives false if player is offline.  There is no error for a failure of command since this should never happen.
    self.isAdmin=function (options){
      return isPlayerAdmin(self.name,options);
      // let adminList=getAdminsList(options);
      // for (let i=0;i<adminList.length;i++){
      //   if (self.name.toLowerCase() == adminList[i].toString()){
      //     return true;
      //   }
      // }
      // return false;
    }
    self.spawnLocation=function(){ // Returns a LocationObj of the player's spawn coordinates, but can only be successful if the player is online.  Will return false if offline.
      try {
        var result=starNetHelper.starNetVerified("/player_get_spawn " + self.name);
        // RETURN: [SERVER, [ADMINCOMMAND][SPAWN][SUCCESS] PlS[Benevolent27 ; id(2)(1)f(10002)] spawn currently absolute; sector: (2, 2, 2); local position: (8.0, -6.5, 0.0), 0]
        // RETURN: [SERVER, END; Admin command execution ended, 0]

        var resultArray=result.trim().split("\n");
        // RETURN: [SERVER, [PL] Name: Benevolent27, 0]
        var theReg=new RegExp("^RETURN: \\[SERVER, \\[ADMINCOMMAND\\]\\[SPAWN\\]\\[SUCCESS\\]");
        for (let i = 0;i < resultArray.length;i++) {
          if (theReg.test(resultArray[i])){
            // This will only trigger if there is a success
            // RETURN: [SERVER, [ADMINCOMMAND][SPAWN][SUCCESS] PlS[Benevolent27 ; id(2)(1)f(10002)] spawn currently absolute; sector: (2, 2, 2); local position: (8.0, -6.5, 0.0), 0]
            // Scientific E notation: RETURN: [SERVER, [ADMINCOMMAND][SPAWN][SUCCESS] PlS[Benevolent27 ; id(2)(1)f(10002)] spawn currently absolute; sector: (2, 2, 2); local position: (0.01E5, -6.5, 0.0), 0]
            var sectorCoords=resultArray[i].match(/sector: \([-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+/).toString().replace(/sector: \(/,"").split(", ");
            var sectorCoordsObj=new CoordsObj(sectorCoords);
            var sectorObj=new SectorObj(sectorCoordsObj.x,sectorCoordsObj.y,sectorCoordsObj.z);
            var spacialCoords=resultArray[i].match(/position: \([-]{0,1}[0-9]+[.]{0,1}[0-9]*[eE]{0,1}[0-9]*, [-]{0,1}[0-9]+[.]{0,1}[0-9]*[eE]{0,1}[0-9]*, [-]{0,1}[0-9]+[.]{0,1}[0-9]*[eE]{0,1}[0-9]*/).toString().replace(/position: \(/,"").split(", "); // Supports scientific e notation, which is used sometimes for spacial coordinates.
            var coordsObj=new CoordsObj(spacialCoords);
            // Returns a LocationObj, which has the sector and spacial coordinates in it.
            return new LocationObj(sectorObj,coordsObj);
          }
        }
        // If failed, the player is offline:
        // RETURN: [SERVER, [ADMINCOMMAND][SPAWN] Player not found, 0]
        return false; // The player must have been offline.

      } catch (error){
        var spawnLocationError="StarNet command failed when attempting to get the spawn sector for player: " + self.name;
        throw new Error(spawnLocationError);
      }
    }
    self.setSpawnLocation=function(location,coordsObj,options){ // Needs sector and spacial coords.  coordsObj is needed if a SectorObj is given as first parameter.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      var sectorToUse=location;
      var spacialToUse=coordsObj;

      if (typeof location=="object"){
        if (location instanceof LocationObj){
          if (location.hasOwnProperty("spacial") && location.hasOwnProperty("sector")){ // This handles LocationObj types given.  This will lead to the coordsObj being ignored if given.
            spacialToUse=location.spacial;
            sectorToUse=location.sector;
          } else {
            throw new Error("Invalid LocationObj given to setSpawnLocation!"); // This is redundant and should never happen.
          }
        } else if ((location instanceof SectorObj || location instanceof CoordsObj) && (coordsObj instanceof CoordsObj)) {
          sectorToUse=location.toString();
          spacialToUse=coordsObj.toString();
        } else {
          // Invalid objects or objects given as input.
          throw new Error("Invalid object types given to setSpawnLocation!");
        }
      }
      if (testIfInput(sectorToUse) && testIfInput(spacialToUse)){ // Two inputs given
        // Let's see if coordinates can be made from the input.  String, Array, or object can be given with coordinates.
        try {
          sectorToUse=new CoordsObj(location).toString();
          spacialToUse=new CoordsObj(coordsObj).toString();
        } catch (error){ // Invalid input given.
          var setSpawnLocationError="Invalid input given to setSpawnLocation!";
          throw new Error(setSpawnLocationError); 
        }
      } else { // Invalid amount of arguments given
        throw new Error("Invalid number of parameters given to setSpawnLocation!");
      }

      if (typeof spacialToUse=="string" && typeof sectorToUse=="string"){ // This is redundant, an error should have been thrown by now if there was a problem.
        // We should be all set to send the command now.

        // TODO:  This needs a "fast" option
        var fast=false;
        if (typeof options == "object"){
          if (options.hasOwnProperty("fast")){
            if (isTrue(options.fast)){
              fast=true;
            }
          }
        }
        var setSpawnLocationCommand="/player_set_spawn_to " + self.name + " " + sectorToUse + " " + spacialToUse;
        if (fast){
          return sendDirectToServer(setSpawnLocationCommand);
        } else {
          var result2=starNetHelper.starNetVerified(setSpawnLocationCommand); // This will throw an error if the connection to the server fails.
          // Success:
          // RETURN: [SERVER, [ADMINCOMMAND][SPAWN][SUCCESS] set spawn of player PlS[Benevolent27 ; id(2)(1)f(10002)] to sector (1000, 1000, 1000); local position: (0.0, 0.0, 0.0), 0]

          // Fail - either player offline or player does not exist.
          // RETURN: [SERVER, [ADMINCOMMAND][SPAWN] Player not found, 0]
          var theReg2=new RegExp("^RETURN: \\[SERVER, \\[ADMINCOMMAND\\]\\[SPAWN\\]\\[SUCCESS\\]");
          if (starNetHelper.checkForLine(result2,theReg2)){ // The command succeeded.
            return true;
          } else { // The command failed.  Player either offline or does not exist for some reason.
            return false;
          }
        }
      }
      throw new Error("Invalid parameters given to playerObj setSpawnLocation method!");
    }
    self.changeSector=function(sector,options){ // sector can be a LocationObj, SectorObj, CoordsObj, or other input that can be translated to a CoordsObj.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      var sectorToUse=sector;
      if (typeof location=="object"){
        if (sector instanceof LocationObj){
          if (sector.hasOwnProperty("sector")){ // This handles LocationObj objects
            sectorToUse=sector.sector;
          } else {
            throw new Error("Invalid LocationObj given to setSpawnLocation!");
          }
        } else if (sector instanceof SectorObj || sector instanceof CoordsObj) {
          sectorToUse=sector.toString();
        } else { // Invalid objects or objects given as input.
          throw new Error("Invalid object types given to changeSector!");
        }
      } else if (testIfInput(sector)){ // Non-object input given
        // Let's see if coordinates can be made from the input.  A String (separated by , or spaces) or an Array can be given as input.
        try {
          sectorToUse=new CoordsObj(sector).toString();
        } catch (error){ // Invalid input given.
          console.error("Invalid input given to changeSector!");
          throw error; 
        }
      } else { // Invalid amount of arguments given
        throw new Error("No sector value given changeSector!");
      }
      if (typeof sectorToUse=="string"){
        // We should be all set to send the command now.

        var fast=false;
        if (typeof options == "object"){
          if (options.hasOwnProperty("fast")){
            if (isTrue(options.fast)){
              fast=true;
            }
          }
        }
        var changeSectorCommand="/change_sector_for " + self.name + " " + sectorToUse;
        if (fast){
          return sendDirectToServer(changeSectorCommand);         
        } else {
          var result2=starNetHelper.starNetVerified(changeSectorCommand); // This will throw an error if the connection to the server fails.
          // Success: RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] changed sector for Benevolent27 to (1000, 1000, 1000), 0]
          // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client Benevolent27, 0]
          var theReg3=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[SUCCESS\\]");
          if (starNetHelper.checkForLine(result2,theReg3)){ // The command succeeded.
            return true;
          } else { // The command failed.  Player either offline or does not exist for some reason.
            return false;
          }
        }
      }
      throw new Error("Invalid parameters given to playerObj changeSector method!");
    }
    self.changeSectorCopy=function(sector,options){ // sector can be a LocationObj, SectorObj, CoordsObj, or other input that can be translated to a CoordsObj.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      var sectorToUse=sector;
      if (typeof location=="object"){
        if (sector instanceof LocationObj){
          if (sector.hasOwnProperty("sector")){ // This handles LocationObj objects
            sectorToUse=sector.sector;
          } else {
            throw new Error("Invalid LocationObj given to changeSectorCopy!");
          }
        } else if (sector instanceof SectorObj || sector instanceof CoordsObj) {
          sectorToUse=sector.toString();
        } else { // Invalid objects or objects given as input.
          throw new Error("Invalid object types given to changeSectorCopy!");
        }
      } else if (testIfInput(sector)){ // Non-object input given
        // Let's see if coordinates can be made from the input.  A String (separated by , or spaces) or an Array can be given as input.
        try {
          sectorToUse=new CoordsObj(sector).toString();
        } catch (error){ // Invalid input given.
          console.error("Invalid input given to changeSectorCopy!");
          throw error; 
        }
      } else { // Invalid amount of arguments given
        throw new Error("No sector value given changeSectorCopy!");
      }
      if (typeof sectorToUse=="string"){
        // We should be all set to send the command now.

        var fast=false;
        if (typeof options == "object"){
          if (options.hasOwnProperty("fast")){
            if (isTrue(options.fast)){
              fast=true;
            }
          }
        }
        var changeSectorCommand="/change_sector_for_copy " + self.name + " " + sectorToUse;
        if (fast){
          return sendDirectToServer(changeSectorCommand);         
        } else {
          var result2=starNetHelper.starNetVerified(changeSectorCommand); // This will throw an error if the connection to the server fails.
          // Success: RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] changed sector for Benevolent27 to (1000, 1000, 1000), 0]
          // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client Benevolent27, 0]
          var theReg3=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[SUCCESS\\]");
          if (starNetHelper.checkForLine(result2,theReg3)){ // The command succeeded.
            return true;
          } else { // The command failed.  Player either offline or does not exist for some reason.
            return false;
          }
        }
      }
      throw new Error("Invalid parameters given to playerObj changeSectorCopy method!");
    }
    self.teleportTo=function(coords,options){ // Needs sector and spacial coords.  coordsObj is needed if a SectorObj is given as first parameter.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      var spacialCoordsToUse=coords;
      console.log("coords typeof: " + typeof coords);
      if (typeof coords=="object"){
        if (coords instanceof LocationObj){
          if (coords.hasOwnProperty("spacial")){ // This handles LocationObj objects
            spacialCoordsToUse=coords.spacial;
          } else {
            throw new Error("Invalid LocationObj given to teleportTo!");
          }
        } else if (coords instanceof CoordsObj) {
          spacialCoordsToUse=coords.toString();
        } else { // Invalid objects or objects given as input.
          throw new Error("Invalid object type given to teleportTo!");
        }
      } else if (testIfInput(coords)){ // Input given
        // Let's see if coordinates can be made from the input.  A String (separated by , or spaces) or an Array can be given as input.
        try {
          spacialCoordsToUse=new CoordsObj(coords).toString();
        } catch (error){ // Invalid input given.
          console.error("Invalid input given to teleportTo!");
          throw error; 
        }
      } else { // Invalid amount of arguments given
        throw new Error("No spacial coords given teleportTo!");
      }
      if (typeof spacialCoordsToUse=="string"){
        // We should be all set to send the command now.

        var fast=false;
        if (typeof options == "object"){
          if (options.hasOwnProperty("fast")){
            if (isTrue(options.fast)){
              fast=true;
            }
          }
        }
        var teleportToCommand="/teleport_to " + self.name + " " + spacialCoordsToUse;
        if (fast){
          return sendDirectToServer(teleportToCommand);         
        } else {
          var result2=starNetHelper.starNetVerified(teleportToCommand); // This will throw an error if the connection to the server fails.
          // Success: RETURN: [SERVER, [ADMIN COMMAND] teleported Benevolent27 to , 0]
          // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client, 0]
          var theReg3=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] teleported");
          if (starNetHelper.checkForLine(result2,theReg3)){ // The command succeeded.
            return true;
          } else { // The command failed.  Player either offline or does not exist for some reason.
            return false;
          }
        }
      }
      throw new Error("Invalid parameters given to playerObj teleportTo method!");
    }
    
    self.info=function(){
      // This returns whatever accurate info it can from the /player_info command.
      var returnObj={};
      var result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
      if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player exists
        if (!returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player online
          // These values can only be obtained when the player is online
          // returnObj["controlling"]=self.controlling(result); // self.controlling does not exist yet.
          returnObj["sector"]=self.sector(result);
          returnObj["spacialCoords"]=self.spacialCoords(result);
          returnObj["upgraded"]=self.upgraded(result);
          returnObj["smName"]=self.smName(result);
          returnObj["ip"]=self.ip(result);
        }
        // These are always accurate, even if a player is offline
        returnObj["personalTestSector"]=self.personalTestSector(result);
        returnObj["credits"]=self.credits("",result);
        returnObj["faction"]=self.faction(result);
        return returnObj;
      }
      return false; // There was an error with the command. This should never happen
    }
    self.sector=function(input){
      var returnVal;
      try {
        var result;
        if (input){
          result=input;
        } else {
          result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
        }
        // RETURN: [SERVER, [PL] CONTROLLING-POS: (0.0, 5.0, 0.0), 0]
        // RETURN: [SERVER, [PL] CONTROLLING: PlayerCharacter[(ENTITY_PLAYERCHARACTER_Benevolent27)(285)], 0]
        // RETURN: [SERVER, [PL] SECTOR: (1000, 1000, 1000), 0]

        // If offline or not spawned:
        // RETURN: [SERVER, [PL] CONTROLLING-POS: <not spawned>, 0]
        // RETURN: [SERVER, [PL] CONTROLLING: <not spawned>, 0]
        // RETURN: [SERVER, [PL] SECTOR: (2, 2, 2), 0]

        // If player does not exist:
        // RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player Benevolent27dsfsdf not online, and no offline save state found, 0]

        if (returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player offline
          return false;
        } else if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          return new SectorObj(returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] SECTOR: \(.*/,/^RETURN: \[SERVER, \[PL\] SECTOR: \(/,/\), 0]$/).split(", "));
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the sector for player: " + self.name);
        throw errorObj;
      }
    }
    self.personalTestSector=function(input){
      var returnVal;
      try {
        var result;
        if (input){
          result=input;
        } else {
          result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
        }
        if (returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player offline
          return false;
        } else if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          return new SectorObj(returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] PERSONAL-TEST-SECTOR: \(.*/,/^RETURN: \[SERVER, \[PL\] PERSONAL-TEST-SECTOR: \(/,/\), 0]$/).split(", "));
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the PERSONAL-TEST-SECTOR for player: " + self.name);
        throw errorObj;
      }
    }
    self.spacialCoords=function(input){
      var returnVal;
      try {
        var result;
        if (input){
          result=input;
        } else {
          result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
        }
        if (returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player offline
          return false;
        } else if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          return new CoordsObj(returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: \(.*/,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: \(/,/\), 0]$/).split(", "));
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the CONTROLLING-POS for player: " + self.name);
        throw errorObj;
      }
    }
    self.credits=function(options,input){
      // TODO:  the credits from /player_info actually appears to be accurate, even when a player is offline.  I should change the default behavior to return the credits, but give an option to only display credits if the player is offline.
      var returnVal;
      var onlyIfOnline=false;
      if (typeof options == "object"){
        if (options.hasOwnProperty("onlyIfOnline")){  // This can be used to perform an online check simultaneously and only return credit amount if the player is online.
          if (isTrue(options.onlyIfOnline)){
            onlyIfOnline=true;
          }
        }
      }
      try {
        var result;
        if (input){
          result=input;
        } else {
          result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
        }
        if (onlyIfOnline===true){
          if (returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player offline
            return false;
          }
        }
        if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          return Number(returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CREDITS: .*/,/^RETURN: \[SERVER, \[PL\] CREDITS: /,/, 0\]$/));
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the CREDITS for player: " + self.name);
        throw errorObj;
      }
    }
    self.upgraded=function(input){
      var returnVal;
      try {
        var result;
        if (input){
          result=input;
        } else {
          result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
        }
        if (returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player offline
          return false;
        } else if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          return trueOrFalse(returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] UPGRADED: .*/,/^RETURN: \[SERVER, \[PL\] UPGRADED: /,/, 0\]$/));
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the UPGRADED for player: " + self.name);
        throw errorObj;
      }
    }
    self.smName=function(input){
      var returnVal;
      try {
        var result;
        if (input){
          result=input;
        } else {
          result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
        }
        if (returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player offline
          return false;
        } else if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          return new SMNameObj(returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] SM-NAME: .*/,/^RETURN: \[SERVER, \[PL\] SM-NAME: /,/, 0\]$/));
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the sm-name for player: " + self.name);
        throw errorObj;
      }
    }
    self.ip=function(input){
      var returnVal;
      try {
        var result;
        if (input){
          result=input;
        } else {
          result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
        }
        if (returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player offline
          return false;
        } else if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          return new IPObj(returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] IP: \/.*/,/^RETURN: \[SERVER, \[PL\] IP: \//,/, 0\]$/));
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the ip for player: " + self.name);
        throw errorObj;
      }
    }
    self.faction=function(input){
      var returnVal;
      try {
        var result;
        if (input){
          result=input;
        } else {
          result=starNetHelper.starNetVerified("/player_info " + self.name); // This will throw an error if there is a connection issue.
        }
        if (returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)){ // Player offline
          return false;
        } else if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          var factionLine=returnLineMatch(result,/^RETURN: \[SERVER, \[PL\] FACTION: Faction \[.*/,/^RETURN: \[SERVER, \[PL\] FACTION: Faction \[/); // If the person is not in a faction, this will be undefined.
          // In a faction:  RETURN: [SERVER, [PL] FACTION: Faction [id=10002, name=myFaction, description=Faction name, size: 1; FP: 586], 0]
          // Not in a faction:  RETURN: [SERVER, [PL] FACTION: null, 0]
          if (factionLine){
            return new FactionObj(factionLine.match(/^id=[-]{0,1}[0-9]+/).toString().replace(/^id=/,""));
          }
          return factionLine; // Returns undefined if the person is not in a faction.
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the sm-name for player: " + self.name);
        throw errorObj;
      }
    }
    // TODO - create this: // self.controlling=function(input){ } // This is an alternative for currentEntity.  It cannot return the UID for asteroids or planets, but it will at least return SOMETHING.  currentEntity will return false if the player is in an asteroid.
    self.playerProtect=function (smName,options){ // Requires smName, which can be a string or a SMNameObj
      var smNameToUse=smName;
      if (typeof smName == "object"){
        if (smName instanceof SMNameObj){
          smNameToUse=smName.toString();
        }
      }
      if (typeof smNameToUse=="string"){
        return runSimpleCommand("/player_protect " + self.name + " " + smNameToUse,options);
      } else {
        throw new Error("Invalid smName given to playerProtect!");
      }
    }
    self.playerUnprotect=function (options){ // Removes registry account protection for the username
      return runSimpleCommand("/player_unprotect " + self.name,options);
    }

    self.currentEntity=function(input){
      // This uses the /entity_info_by_player_uid command instead of /player_info command, since that will not work with asteroids and planets.  This does not work with asteroids currently.

      // RETURN: [SERVER, Attached: [PlS[Benevolent27 ; id(612)(4)f(10001)]], 0]
      // RETURN: [SERVER, DockedUIDs: , 0]
      // RETURN: [SERVER, Blocks: 214395, 0]
      // RETURN: [SERVER, Mass: 0.0, 0]
      // RETURN: [SERVER, LastModified: ENTITY_PLAYERSTATE_Benevolent27, 0]
      // RETURN: [SERVER, Creator: , 0]
      // RETURN: [SERVER, Sector: 953 -> Sector[953](5, 1, 23), 0]
      // RETURN: [SERVER, Name: Planet, 0]
      // RETURN: [SERVER, UID: ENTITY_PLANET_5_1_23_10_1562917261498, 0]
      // RETURN: [SERVER, MinBB(chunks): (-3, 0, -3), 0]
      // RETURN: [SERVER, MaxBB(chunks): (3, 3, 3), 0]
      // RETURN: [SERVER, Local-Pos: (83.5057, -0.7602557, -41.887486), 0]
      // RETURN: [SERVER, Orientation: (0.1676793, 0.45718494, -0.6869378, 0.5394274), 0]
      // RETURN: [SERVER, Planet, 0]
      // RETURN: [SERVER, END; Admin command execution ended, 0]

      var returnVal;
      try {
        var result=starNetHelper.starNetVerified("/entity_info_by_player_uid " + self.name); // This will throw an error if there is a connection issue.
        if (!returnLineMatch(result,/^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)){ // Player does not exist
          var currentEntityResult=returnLineMatch(result,/^RETURN: \[SERVER, UID: .*/,/^RETURN: \[SERVER, UID: /,/, 0\]$/);
          // NOTE:  This is currently broken for asteroids.  There seems to be no way to get the entity UID if it is an asteroid, but this does work for planet plates.
          // TODO:  Bug Schema to fix this for asteroids.
          if (currentEntityResult){
            // TODO:  Determine if there really is a reason to have separte entity objects for planets and asteroids, otherwise the below will be fine.
            return new EntityObj(currentEntityResult);
          }
          return false;  // This will always return false if the player is in an asteroid.. so be careful with self.
        }
        return returnVal; // Returns undefined.  The player did not exist somehow.  This should never happen.
      } catch (error){
        var errorObj=new Error("StarNet command failed when attempting to get the currentEntity for player: " + this.name);
        throw errorObj;
      }
    }
    this.ips=function(options){ // Returns an array of IPObj of a user as returned by /player_info
    // Note:  By default it will only return unique IP's, but an option can be specified to return them all, which includes the timestamp of the login from the IP
      var unique=true;
      if (typeof options == "object"){
        if (options.hasOwnProperty("unique")){
          if (isFalse(options.unique)){
            unique=false;
          }
        }
      }
      try {
        var result=starNetHelper.starNetVerified("/player_info " + this.name); // This will throw an error if there is a connection issue.
        var resultArray=returnMatchingLinesAsArray(result,/^RETURN: \[SERVER, \[PL\] LOGIN: \[time=.*/);
        var outputArray=[];
        var ipTemp;
        var ipDateTemp;
        var ipDateObj={};
        var ipTrackerArray=[];
        for (var i=0;i<resultArray.length;i++){
          ipDateTemp=resultArray[i].match(/\[time=[^,]*/);
          if (ipDateTemp){
            ipDateTemp=ipDateTemp.toString().replace(/^\[time=/,"");
            ipDateObj=new Date(ipDateTemp); // This was tested to be working correctly
            ipTemp=resultArray[i].match(/ip=[^,]*/);
            if (ipTemp){
              ipTemp=ipTemp.toString().replace(/^ip=\//,"");
              // This does not filter based on unique IP's since there is a date associated with each IP login
              // TODO:  Make it so the default is to filter only unique IP's but give an option not to
              if (unique){ // If only pushing unique IP's
                if (!isInArray(ipTrackerArray,ipTemp)){
                  outputArray.push(new IPObj(ipTemp,ipDateObj));
                  ipTrackerArray.push(ipTemp); // Record the unique IP so it isn't added to the resultArray again
                }
              } else {
                outputArray.push(new IPObj(ipTemp,ipDateObj));
              }
            }
          }
        }
        return outputArray; // Array is empty if no results found
      } catch (error){
         var errorObj=new Error("StarNet command failed when attempting to get the ips for player: " + this.name);
         throw errorObj;
      }

    }
    self.inventory=function(options){ // Returns a player's inventory as an array of objects - Broken right now because it returns the currently open inventory, which could be the personal inventory, cargo, or creative
      // TODO:  Follow up with Schema about it using the personal inventory by default, and a second command '/player_get_current_inventory' being added.
      // TODO:  Add an option for the output to be a map object.
      // TODO:  Create a function that converts an item number to the item name.  This might be pretty complicated though, since it would require parsing the blockProperties.xml file, blockConfig.xml, and customBlockConfig.xml to accurately find the item number's name.
      // TODO:  Follow up with schema about multi-blocks being broken down into it's invidivdual block counts.  Right now, this is how a multi-block outputs:
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 27; MULTI: true; TYPE: -32768; META: -1; COUNT: 400, 0]
      // For built-in blocks, it could be possible to map every single multi-block type and then run individual "/player_get_block_amount" on those id's.. and then reformulate the output to include whichever ones are found.. but that would be very time-consuming, inefficient, and would not work for custom block groupings since I'd have no way of anticipating what those -234234 numbers would look like.
      var current=false;
      if (typeof options == "object"){
        if (options.hasOwnProperty("current")){
          if (isTrue(options.current)){
            current=true;
          }
        }
      }
      var commandToUse="/player_get_inventory ";
      if (current){
        commandToUse="/player_get_current_inventory "; // This command does not exist yet, so don't use this till it is.
      }
      var result=starNetHelper.starNetVerified(commandToUse + self.name); // This will throw an error if there is a connection issue, false if the command fails, likely due to the player being offline.
      // C:\coding\starmade.js\bin>node starNet.js "/player_get_inventory Benevolent27"
      // RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] Listing player Benevolent27 personal inventory START, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 0; MULTI: false; TYPE: 598; META: -1; COUNT: 595, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 1; MULTI: false; TYPE: 1010; META: -1; COUNT: 5, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 2; MULTI: false; TYPE: -11; META: 100892; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 3; MULTI: false; TYPE: -11; META: 100893; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 4; MULTI: false; TYPE: -11; META: 100894; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 5; MULTI: false; TYPE: 1; META: -1; COUNT: 7, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 6; MULTI: false; TYPE: 73; META: -1; COUNT: 17, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 7; MULTI: false; TYPE: 74; META: -1; COUNT: 4, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 11; MULTI: false; TYPE: -32; META: 100030; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 12; MULTI: false; TYPE: -32; META: 100031; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 13; MULTI: false; TYPE: -32; META: 100032; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 14; MULTI: false; TYPE: -32; META: 100033; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 15; MULTI: false; TYPE: -12; META: 100034; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 16; MULTI: false; TYPE: -14; META: 100035; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 17; MULTI: false; TYPE: -11; META: 100036; COUNT: 1, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 91; MULTI: false; TYPE: 4; META: -1; COUNT: 2, 0]
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 92; MULTI: false; TYPE: 24; META: -1; COUNT: 20, 0]
      // RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] Listing player Benevolent27 personal inventory END., 0]
      // RETURN: [SERVER, END; Admin command execution ended, 0]
      
      if (result){
        // console.log("Result found!"); // temp
        var outputArray=[];
        // Parse through the lines, creating new objects and outputting to the outputArray.
        var theArray=result.trim().split("\n");
        var theReg=new RegExp("^RETURN: \\[SERVER, \\[INVENTORY\\] Benevolent27: {2}SLOT: .*"); // The {2} here is just to denote 2 spaces.
        var match;
        var slot;
        var multi;
        var type;
        var meta;
        var count;
        var outputObj={};
        for (var i=0;i<theArray.length;i++){
          // console.log("Processing line: " + theArray[i]);  // temp
          match=theArray[i].match(theReg); // Returns void if not found
          if (match){
            // console.log("Match found!  Processing it..");
            match=match.toString();
            slot=match.match(/SLOT: [-]{0,1}[0-9]*/).toString().replace("SLOT: ",""); // This should never error out, but a more careful approach might be needed.
            multi=match.match(/MULTI: [a-zA-Z]*/).toString().replace("MULTI: ","");
            type=match.match(/TYPE: [-]{0,1}[0-9]*/).toString().replace("TYPE: ","");
            meta=match.match(/META: [-]{0,1}[0-9]*/).toString().replace("META: ","");
            count=match.match(/COUNT: [-]{0,1}[0-9]*/).toString().replace("COUNT: ","");
            outputObj={
              "slot":toNum(slot),
              "multi":trueOrFalse(multi),
              "type":toNum(type),
              "meta":toNum(meta),
              "count":toNum(count)
            }
            // console.log("Adding object to outputArray:");
            // console.dir(outputObj);
            outputArray.push(outputObj);
          }
        }
      }
      return outputArray; // If inventory is empty, will return an empty array.
    }
    self.blueprints = function (options){ // Returns an array of blueprint objects.
      var verbose=getOption(options,"verbose",false); // Not sure if I'll actually use this
      var result=starNetHelper.starNetVerified("/list_blueprints_by_owner " + self.name); // This will throw an error if there is a connection issue, false if the command fails, likely due to the player being offline.
      // RETURN: [SERVER, [CATALOG] START, 0]
      // RETURN: [SERVER, [CATALOG] INDEX 0: Another ship of mine with     spaces, 0]
      // RETURN: [SERVER, [CATALOG] INDEX 1: A catalogue test, 0]
      // RETURN: [SERVER, [CATALOG] END, 0]
      // RETURN: [SERVER, END; Admin command execution ended, 0]
      if (result){
        // console.log("Result found!"); // temp
        var outputArray=[];
        // Parse through the lines, creating new objects and outputting to the outputArray.
        var theArray=result.trim().split("\n");
        var theReg=new RegExp("^RETURN: \\[SERVER, \\[CATALOG\\] INDEX.*"); // This will only search for only the lines with catalogue names
        var theCatalogString;
        for (let i=0;i<theArray.length;i++){
          theCatalogString=theArray[i].match(theReg);
          if (theCatalogString){
            theCatalogString=theCatalogString.toString().replace(/^RETURN: \[SERVER, \[CATALOG\] INDEX [0-9]+: /,"").replace(/, 0\]$/,"");
            console.log("Pushing catalogue name to array: " + theCatalogString); // temp

            outputArray.push(new BluePrintObj(theCatalogString));
          }
        }
        if (outputArray.length > 0){
          return outputArray;
        }
        return false; // The player had no blueprints
      }
      return false; // This will only happen if there is an error with the command, but it was not a connection error.  This should not happen.
    }
    // blueprints()[1].blueprint_delete()
    // EXAMPLE: /blueprint_delete my_ship
    
    // blueprints()[1].blueprint_info()
    // EXAMPLE: /blueprint_info my_ship
    
    // server.blueprints[2].blueprint_set_owner(player) // include find functionality.



    // Phase 2 - Add methods that poll information from the server using StarNet.

    // Needs testing:
    // changeSectorCopy("[X],[Y],[Z]" -or- SectorObj -or- CoordsObj) - teleports the player to a specific sector, leaving behind a copy of whatever entity they were in, duplicating it
    // currentEntity() - Returns the EntityObj of the entity they are currently in or on.  Uses the /entity_info_by_player_uid command rather than the "CONTROLLING:" line from /player_info, since that doesn't work with planet plates or asteroids.  Though the /entity_info_by_player_uid command also does not work with asteroids, but does work for planet plates.
    // playerProtect(smName) - uses /player_protect to protect a smname to a username - Sets this current player name to be protected under a specific registry account
    // player_unprotect() - opposite of above - WARNING:  This will allow anyone to log in under this name in the future!

    // Phase 2 - Done
    // isAdmin() - uses /list_admins OR reads from the admins.txt file to determine is a player is an admin.  {"fast":true/false,"unrestricted":true/false}
    // botMsg("message")
    // inventory({options}) -- Working, but problematic.  See notes.
    // ips(options) - returns an array of IPObj's with all unique IP's, as returned by /player_info.  Also sets the "date" function for each one.  'options' can be an object with "unique" set to false if you want all ip's with their associated dates, otherwise the default is to return only unique ip's.
    // smName - returns a SmNameObj
    // ip - returns an IPObj with the player's last IP in it
    // personalTestSector - Returns the player's designated battlemode sector, which is unique to every player.  Returns a SectorObj.
    // upgraded - returns true or false if the whether the person has a purchased version of the game or not.  Only works when authentication is required for the server, otherwise always returns false.  Returns Boolean values.
    // credits - returns the amount of credits a player has on them as a number.
    // spacialCoords - Returns the spacial coordinates the player is in, in a CoordsObj.
    // faction - Returns the FactionObj of their faction or undefined if no faction found.
    // sector - Returns the player's current sector as a SectorObj
    // isOnline() - /player_list - Check to see if the player is online.  Useful for loops or delayed commands.
    // /player_get_spawn
    // /player_set_spawn_to Benevolent27 X Y Z spacialX spacialY spacialZ
    // changeSector(coords) - /change_sector_for Benevolent27 x y z
    // teleportTo(coords) - /teleport_to Benevolent27 x y z

    
    // Phase 1 - Add methods which send the command directly to the server.
    // banAccount - Bans the player by their registry account - this is a PERM ban
    // banAccountTemp(NumberInMinutes) - Bans the player by their registry account temporarily
    // banPlayerName - Bans the player by their playername - this is a PERM ban
    // banPlayerNameTemp(NumberInMinutes) - Bans the player by their playername temorarily
    // banIP - Bans the player by IP - PERM BAN - My Notes: Might use "/ban_ip_by_playername [PlayerName]" or "/ban_ip 1.1.1.1" if that is unreliable
    // banIPTemp(NumberInMinutes) - Bans player by IP - Temp - My Notes: Can use "/ban_ip_by_playername_temp [PlayerName] 1" or "/ban_ip_temp 1.1.1.1 1" if that is unreliable

    
    // addToFaction([FactionObj/FactionNum]) -- Switches the player to a specific faction



    // Phase 1 done - sending directly to console.  Phase 2 incomplete.
    // msg(MessageString,info/warning/error) - Sends a private message to this specific player.  If no method is specified "plain" is used, which shows up on the player's main chat.
    // creativeMode(true/false) - Turns creative mode on or off for the player "/creative_mode player true/false"
    // godMode(true/false) - Sets godmode to true or false for the player using /god_mode
    // invisibilityMode(true/false) - Sets invisibility to true or false for the player using /invisibility_mode
    // give(ElementNameString,Count) - Gives the player the number of blocks by element name - ONLY WORKS IF THE PLAYER IS ONLINE - Example: player.give("Power",10)
    // giveID(ElementIDNum,Count) - Gives the player the number of blocks by element ID number - ONLY WORKS IF THE PLAYER IS ONLINE- Example: player.giveID(2,10)
    // giveAllItems(Count) - Gives the player all blocks of a certain number
    // giveCategoryItems(Count,categoryNameString) - /give_category_items Gives the player all blocks of a certain number by category
    // giveCredits(Num) - Gives a certain number of credits to the player.  Will subtract if a negative number used.  Returns the new total credits the player has.
    // giveGrapple - Gives the player a grapple gun
    // giveGrappleOP - Gives the player an OP grapple gun
    // giveHealWeapon
    // giveLaserWeapon
    // giveLaserWeaponOP
    // giveMarkerWeapon
    // giveTransporterMarkerWeapon
    // givePowerSupplyWeapon
    // giveRocketLauncher
    // giveRocketLauncherOP
    // giveSniperWeapon
    // giveSniperWeaponOP
    // giveTorchWeapon
    // giveTorchWeaponOP
    // kill - kills the player using "/kill_character [Name]"
    // kick(reasonString) - kicks the player from the server using /kick or /kick_reason  ReasonString is optional.
    // setFactionRank - Sets the player's rank within their current faction if they are in one.  Example: /faction_mod_member schema 1
    // addAdmin - Adds this player as an admin to the server
    // removeAdmin - Removes this player as an admin to the server
    // addAdminDeniedCommand([One,or,more,commands]) - (example: /add_admin_denied_comand Benevolent27 ban) This can be an array or string.  If an array, it will cycle through the array, adding each denied command for the specific admin
    // removeAdminDeniedCommand([One,or,more,commands]) - (example: /remove_admin_denied_comand Benevolent27 ban) This can be an array or string.  If an array, it will cycle through the array, removing each denied command for the specific admin.  Uses: /remove_admin_denied_comand [PlayerName] [CommandToRemove]
    // ban(true/false,ReasonString,Time) - true/false is whether to kick.  Time is in minutes.
    // unban();
    // giveMetaItem(metaItem,number) - Gives the player a meta item based on it's name, such as recipe, log_book, helmet, build_prohibiter, etc.
    // factionPointProtect(true/false) - (Example: /faction_point_protect_player Benevolent27 true) - Protects a player from faction point loss on death (permanent)


    // TODO: Add Info methods:

    // playerInfo - uses /player_info to create an object with all the info available, putting the data into an object or perhaps a map.

    // other commands to utilize:
    // /player_put_into_entity_uid
    // /player_suspend_faction
    // /player_get_inventory
    // /player_get_block_amount
    // /list_blueprints_by_owner
    // kick_player_name_out_of_entity

    // /faction_set_id_member <-- this is buggy and might not be adviseable to utilize.
    // /faction_join_id Player FactionID
    // /faction_del_member Player FactionID
    // /list_blueprints_by_owner and/or /list_blueprints_by_owner_verbose
    // /list_whitelist_name - See if whitelisted.  Could be useful to do a check of online players to see if everyone is whitelisted.
    // /list_banned_name - See if banned.  Could be useful if banned but not kicked yet.

    // infiniteInventory(true/false) - /set_infinite_inventory_volume Player true/false

    // moveToSpacialCoords(x,y,z) /teleport_to Name X Y Z
    // /tint_name x x x x Name - This sets the color of an astronaut.  See the colors.sh file from LvD for some color examples.
    // /whitelist_name and /whitelist_name_temp
    
    // Action methods:
    // factionCreate(NewFactionNameString) - This creates a new faction and sets the player as the leader - I am unsure what the /faction_create command will do if a faction of the same name already exists, but I'm guessing it will just duplicate it. I also do not know what happens if the player is currently in a faction already.
    // factionCreateAs(NewFactionNameString,FactionNum) - This creates a new faction with a specific faction number and sets the player as the leader - I am unsure what the /faction_create_as command will do if the faction number already exists..
  } else {
    throw new Error("ERROR: No playername provided to playerObj constructor!");
  }
};
function SystemObj(x,y,z){
  this.coords=new CoordsObj(x,y,z);
  // TODO: Add Info methods:
  // center - returns the center set of coordinates as a SectorObj
  // type - returns the system type, so black hole, star, giant, double star, void

  // Action Methods:
  // load - Uses "/load_system x y z" to load the whole system.
  this.spawnNPCFaction=function(npcName,npcFactionName,npcDescription,initialGrowth,options){ // Normally options would never be given since who cares about making this fast?
    // DOES NOT GIVE AN ERROR IF THE NPC TYPE IS NOT CORRECT - NEED TO DO MY OWN CHECKING HERE TO SEE IF VALID.
    if (!testIfInput(npcName)){
      throw new Error("No NPC name given to SystemObj.spawnNPCFaction!"); // Input was either blank or a blank object or something.
    }
    var npcNameToUse=npcName.toString(); // If it's an object or something that can be converted to a string, we can use the string.  This will throw an error if it cannot be converted to a string.
    if (typeof npcNameToUse != "string"){
      throw new Error("Invalid NPC name given to SystemObj.spawnNPCFaction!");
    }
    if (!testIfInput(npcFactionName)){
      throw new Error("No NPC faction name given to SystemObj.spawnNPCFaction!"); // Input was either blank or a blank object or something.
    }
    var npcFactionNameToUse=npcFactionName.toString();
    if (typeof npcFactionNameToUse != "string"){
      throw new Error("Invalid NPC faction name given to SystemObj.spawnNPCFaction!");
    }

    // Description and initial growth can be blank, but throw error if invalid input given
    var npcDescriptionToUse="";
    if (testIfInput(npcDescription)){
      npcDescriptionToUse=npcDescription.toString();
    }
    var initialGrowthToUse=10;
    if (isNum(initialGrowth)){
      initialGrowthToUse=initialGrowth;
    }
    // /npc_spawn_faction_pos_fixed
    // DESCRIPTION: Spawns a faction on a fixed position
    // PARAMETERS: name(String), description(String), preset (npc faction config folder name)(String), Initial Growth(Integer), System X(Integer), System Y(Integer), System Z(Integer)
    // EXAMPLE: /npc_spawn_faction_pos_fixed "My NPC Faction" "My Faction's description" "Outcasts" 10 12 3 22
    return runSimpleCommand("/npc_spawn_faction_pos_fixed \"" + npcNameToUse + "\" \"" + npcFactionNameToUse + "\" \"" + npcDescriptionToUse + "\" " + initialGrowthToUse + " " + this.coords.toString(),options);
  }
  this.territoryMakeUnclaimable=function(options){
    return runSimpleCommand("/territory_make_unclaimable " + this.coords.toString(),options);
  }
  this.territoryReset=function(options){
    return runSimpleCommand("/territory_reset " + this.coords.toString(),options);
  }


  
  // /territory_make_unclaimable // This is broken and will probably not be fixed.
  // DESCRIPTION: makes a system unclaimable (use system coords, reset with /territory_reset)
  // PARAMETERS: SystemX(Integer), SystemY(Integer), SystemZ(Integer)
  // EXAMPLE: /territory_make_unclaimable 10 12 15
  
  // /territory_reset
  // DESCRIPTION: takes away claim of a system (use system coords)
  // PARAMETERS: SystemX(Integer), SystemY(Integer), SystemZ(Integer)
  // EXAMPLE: /territory_reset 10 12 15


  // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
  if (arguments.length > SystemObj.length){
    var extraInfoArray=[];
    for (let i=SystemObj.length-1;i<arguments.length;i++){
      extraInfoArray.push(arguments[i]);
    }
    this.extraInfo=extraInfoArray;
  }
};
function SpawnObj(playerName,date){ // date is optional.  Current time is used if not provided.
  var possibleDate;
  if (typeof date == "undefined"){ // We're using typeof because we don't want to do a truthy assessment
    possibleDate = new Date(Date.now())
  } else {
    possibleDate=createDateObjIfPossible(date);  // Returns false if no information given or invalid information.  Returns a date object if given a date object.
    if (!possibleDate){
      console.error("Unable to use date information given when creating new SpawnObj for player, " + playerName + "! Invalid date information: " + date);
    }
  }; // Creates a new date object with the current time.  Date.now() might not be necessary, since a plain "new Date()" seems to use current itme.
  if (possibleDate){ this.date = possibleDate } // If date information is given, but it is invalid, it will NOT be included in this object.
  this.player=new PlayerObj(playerName);
  // Right now there really are no console commands for spawn mechanics, but a separate object is used here in case there are in the future.
};
function BluePrintObj(bluePrintName){
  this.name=bluePrintName.toString(); // This will throw an error if anything given cannot be turned into a string.
  // Info Methods to add:
  // folder - Gets the path to the folder the blueprint is in

  // Action Methods:

  // spawn_entity
  // PARAMETERS: BlueprintName(String), ShipName(String), X(Integer), Y(Integer), Z(Integer), factionID(Integer), ActiveAI(True/False)
  // EXAMPLE: /spawn_entity mySavedShip shipName sectorX sectorY sectorZ -1 true
  
  // spawn_entity_pos
  // PARAMETERS: BlueprintName(String), ShipName(String), SecX(Integer), SecY(Integer), SecZ(Integer), PosX(Float), PosY(Float), PosZ(Float), factionID(Integer), ActiveAI(True/False)
  // EXAMPLE: /spawn_entity_pos mySavedShip shipName sectorX sectorY sectorZ local-X local-Y local-Z -1 true

  // blueprint_delete
  // DESCRIPTION: removes blueprint permanently (warning: cannot be undone)
  // PARAMETERS: blueprintname(String)
  // EXAMPLE: /blueprint_delete my_ship
  this.del=function(options){
    return runSimpleCommand("/blueprint_delete \"" + this.name + "\"",options);
    // c:\coding\starmade.js\bin>node starNet.js "/blueprint_delete \"A test blueprint\""
    // RETURN: [SERVER, [ADMIN COMMAND] [ERROR] blueprint not found (name is case sensitive): A test blueprint, 0]
    // RETURN: [SERVER, END; Admin command execution ended, 0]
    
    // c:\coding\starmade.js\bin>node starNet.js "/blueprint_delete \"this test blueprint has     spaces\""
    // RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] Removing blueprint: this test blueprint has     spaces, 0]
    // RETURN: [SERVER, END; Admin command execution ended, 0]

    // c:\coding\starmade.js\bin>node starNet.js "/blueprint_delete 'this is' bad"
    // RETURN: [SERVER, Admin command failed: Error packing parameters, 0]
    // RETURN: [SERVER, END; Admin command execution ended, 0]
  }
  this.delete=this.del;
  // blueprint_info
  // DESCRIPTION: blueprint information
  // PARAMETERS: blueprintname(String)
  // EXAMPLE: /blueprint_info my_ship
      // // SUCCESS:
      // RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] Blueprint info on: A catalogue test
      // UID: A catalogue test
      // Owner: Benevolent27
      // DateMS: 1563515221426
      // DateReadable: Fri Jul 19 01:47:01 EDT 2019
      // Description: no description given
      // Mass: 418.46503
      // SpawnCount: 0
      // Price: 687524
      // Rating: 0.0
      // Blocks: 2774
      // BlocksInclChilds: 2774
      // DockCountOnMother: 0
      // DimensionInclChilds: [ (-16.001, -7.0, -11.156709) | (17.001, 8.04331, 16.0) ]
      // PermissionMask: 16
      // PermissionFaction: false
      // PermissionHomeOnly: false
      // PermissionOthers: false
      // PermissionEnemyUsable: true
      // PermissionLocked: false
      // , 0]
      // RETURN: [SERVER, END; Admin command execution ended, 0]  

      // // Blueprint not found:
      // RETURN: [SERVER, [ADMIN COMMAND] [ERROR] blueprint not found (name is case sensitive): A catalogue testdfdf, 0]
      // RETURN: [SERVER, END; Admin command execution ended, 0]
  this.info = function(options){
    var output={};
    var result=starNetHelper.starNetVerified("/blueprint_info '" + this.name + "'"); // Throws an error if connection problem to the server
    if (result){
      output["UID"]=returnLineMatch(result,/^UID: .*/,/^UID: /);
      var theTest=returnLineMatch(result,/^Owner: .*/,/^Owner: /);
      console.log("### OWNED BY PLAYER: " + theTest);
      output["owner"]=new PlayerObj(returnLineMatch(result,/^Owner: .*/,/^Owner: /));
      output["date"]=new Date(toNumIfPossible(returnLineMatch(result,/^DateMS: .*/,/^DateMS: /)));
      output["description"]=returnLineMatch(result,/^Description: .*/,/^Description: /);
      output["mass"]=toNumIfPossible(returnLineMatch(result,/^Mass: .*/,/^Mass: /));
      output["spawnCount"]=toNumIfPossible(returnLineMatch(result,/^SpawnCount: .*/,/^SpawnCount: /));
      output["price"]=toNumIfPossible(returnLineMatch(result,/^Price: .*/,/^Price: /));
      output["rating"]=toNumIfPossible(returnLineMatch(result,/^Rating: .*/,/^Rating: /));
      output["blocks"]=toNumIfPossible(returnLineMatch(result,/^Blocks: .*/,/^Blocks: /));
      output["blocksInclChilds"]=toNumIfPossible(returnLineMatch(result,/^BlocksInclChilds: .*/,/^BlocksInclChilds: /));
      output["dockCountOnMother"]=toNumIfPossible(returnLineMatch(result,/^DockCountOnMother: .*/,/^DockCountOnMother: /));
      var DimensionInclChilds=returnLineMatch(result,/^DimensionInclChilds: .*/,/^DimensionInclChilds: /);
      DimensionInclChilds=DimensionInclChilds.replace("[","").replace("]","").replace(/\(/g,"").replace(/\)/g,"").split("|");
      for (let i=0;i<DimensionInclChilds.length;i++){
        DimensionInclChilds[i]=new CoordsObj(DimensionInclChilds[i].split(", "));
      }
      output["dimensionInclChilds"]=DimensionInclChilds; // This is an array with 2 CoordsObj in it
      output["permissionMask"]=toNumIfPossible(returnLineMatch(result,/^PermissionMask: .*/,/^PermissionMask: /));
      output["permissionFaction"]=trueOrFalse(returnLineMatch(result,/^PermissionFaction: .*/,/^PermissionFaction: /));
      output["permissionHomeOnly"]=trueOrFalse(returnLineMatch(result,/^PermissionHomeOnly: .*/,/^PermissionHomeOnly: /));
      output["permissionOthers"]=trueOrFalse(returnLineMatch(result,/^PermissionOthers: .*/,/^PermissionOthers: /));
      output["permissionEnemyUsable"]=trueOrFalse(returnLineMatch(result,/^PermissionEnemyUsable: .*/,/^PermissionEnemyUsable: /));
      output["permissionLocked"]=trueOrFalse(returnLineMatch(result,/^PermissionLocked: .*/,/^PermissionLocked: /));
      return output;
      // Output looks like this:
      // }
      //   "UID":string
      //   "owner":PlayerObj
      //   "date":Date Object
      //   "description":string,
      //   "mass":Number,
      //   "spawnCount":Number,
      //   "price":Number,
      //   "rating":Number,
      //   "blocks":Number,
      //   "blocksInclChilds":Number,
      //   "dockCountOnMother":Number,
      //   "dimensionInclChilds":Array containing 2 CoordsObj,
      //   "permissionMask":Number,
      //   "permissionFaction":true/false,
      //   "permissionHomeOnly":true/false,
      //   "permissionOthers":true/false,
      //   "permissionEnemyUsable":true/false,
      //   "permissionLocked":true/false
      // }
    }
    return false;
  }
  this.UID=function(){ return this.info().UID };
  this.owner=function(){ return this.info().owner };
  this.date=function(){ return this.info().date };
  this.description=function(){ return this.info().description };
  this.mass=function(){ return this.info().mass };
  this.spawnCount=function(){ return this.info().spawnCount };
  this.price=function(){ return this.info().price };
  this.rating=function(){ return this.info().rating };
  this.blocks=function(){ return this.info().blocks };
  this.blocksInclChilds=function(){ return this.info().blocksInclChilds };
  this.dockCountOnMother=function(){ return this.info().dockCountOnMother };
  this.dimensionInclChilds=function(){ return this.info().dimensionInclChilds };
  this.permissionMask=function(){ return this.info().permissionMask };
  this.permissionFaction=function(){ return this.info().permissionFaction };
  this.permissionHomeOnly=function(){ return this.info().permissionHomeOnly };
  this.permissionOthers=function(){ return this.info().permissionOthers };
  this.permissionEnemyUsable=function(){ return this.info().permissionEnemyUsable };
  this.permissionLocked=function(){ return this.info().permissionLocked };

  // blueprint_set_owner
  // DESCRIPTION: sets owner for a blueprint
  // PARAMETERS: blueprintname(String), playername(String)
  // EXAMPLE: /blueprint_set_owner my_ship schema

};
function FactionObj(factionNumber){
  this.number=factionNumber;


  this.delete=function(options){ // deletes the faction
    return runSimpleCommand("/faction_delete",options);
  }


  // TODO: Add Info methods:
  // name - Get the name of the faction, returned as string
  // description - Get the faction description.  This is harder than it sounds since the description gets all fubared in the return value since it can be multiple lines and it also might contain text that is a normal part of a response like { and } characters..  This is tricky.
  // members([Num,Num2]) - Get the members of the faction, returned as an array of playerObj's.  An array of num values in an array can be provided to return only members of specific ranks (1-5)
  // points - Get the faction points, returned as a number

  // Action methods:
  // setPoints - Set the faction points to a number and return the new points
  // addPoints - Add a value to the faction points and return the new total -  Can allow negative numbers to subtract - might have an option for "strict" not to allow negatives
  // subPoints - Remove a value of faction points and return the new total - Can allow negative numbers to add - might have an option for "strict" not to allow negatives

  // factionModRelation([FactionObj/FactionNum],"enemy/ally/neutral")
  // resetActivity - Resets activity flags for all members to inactive
  // addMember([playerObj/playerNameString],(RankNum)) - Adds a member to the faction.  Ranknum is optional, default is 1.
  // delMember([playerObj/playerNameString]) - Removes a player from the faction if they are in it.  Has to check the faction of the player.
  // delete - Deletes the faction entirely
  // edit([FactionName],[Description]) - Sets a new name and/or description for the faction.  If name or description are left blank, they are not changed.
  // setIDForMember([playerObj/playerNameString]) - Uses the debug function, "faction_set_id_member", to set a player to the faction - WARNING: CAN HAVE DISASTEROUS CONSEQUENCES BUT IT DOES MOVE THE PLAYER WITHOUT TERMINATING THEIR PREVIOUS FACTION IF LEFT EMPTY


  // For NPC factions ONLY:
  // removeNPCFaction - Removes a NPC faction IF it is a NPC faction.  Uses "/npc_remove_faction -98944984"

  //Optional:
  // duplicate(Num) - This will create duplicate new open factions with fake names as the leaders with the same name as this faction (uses /faction_create_amount [Name] [Number])
  // serverMessage(MessageString,info/warning/error) - Sends a message to all online players of this faction.  If no method is specified "plain" is used, which shows up on the player's main chat.
};
function LocationObj(sectorObj,coordsObj){ // This is to store an exact location, including system, sector, and spacial coordinates.
  // this.system=sectorObj.getSystem();
  if (sectorObj instanceof SectorObj){
    this.sector=sectorObj;
  } else if (sectorObj instanceof CoordsObj){
    this.sector=new SectorObj(sectorObj.x,sectorObj.y,sectorObj.z);
  } else {
    // Let's try to make it into a coords obj and convert to sectorobj
    var tryCoords=new CoordsObj(sectorObj); // This will throw an error if invalid input
    this.sector=new SectorObj(tryCoords.x,tryCoords.y,tryCoords.z);
  }
  if (coordsObj instanceof CoordsObj){
    this.spacial=coordsObj;
  } else {
    this.spacial=new CoordsObj(coordsObj); // This will throw an error if invalid input
  }
};
function SectorObj(xGiven,yGiven,zGiven){
  // TODO: Add Info methods:
  // getSystem - Returns a SystemObj

  // Add Action Methods:
  // despawn(PartOfShipNameString) - Uses the /despawn_sector command to despawn ships that start with the string provided
  // export(nameOfExportFileString) - This will send a /force_save command and then a /export_sector command of this sector.
  // populate - This will run the /populate_sector command on this sector (replenishes asteroids or planets I think?  Not sure.)
  // repair - This will run a /repair_sector command on the sector.  NOTE:  This OFTEN has unintended consequences, including atually corrupting a sector or duplicating entities within the sector!
  // # custom action methods
  // loadRange(radiusNum/X,Y,Z/SectorObj/CoordsObj) - Should allow easy loading of a range of sectors using this sector as the focal point, either using a radius OR a second coordinates point (either string, sectorObj or coordsObj)

  // spawnEntity(BlueprintString,NewShipNameString,FactionNumber/FactionObj,AIActiveBoolean,[spacialX,SpacialY,SpacialZ]/CoordsObj)
  // - Spawns an entity somewhere within this sector.  Spacial coordinates are optional.  If no faction number is provided, 0 is used.  If AI active true/false value not given, true is used.
  // - Uses: "/spawn_entity [BluePrintName] [NewShipName] X Y Z [FactionNumber] [AIActiveBoolean true/false]" OR "/spawn_entity_pos [BluePrintName] [NewShipName] X Y Z SpacialX SpacialY SpacialZ [FactionNumber] [AIActiveBoolean true/false]"
  // - Returns an EntityObj of the newly spawned entity if successful, otherwise returns false.

  // TODO: add alternative inputs, such as "x y z" or "[x,y,z]" or a coordinates object
  // TODO: test the UID list functions and the functions that return objects
  // TODO: add a way to filter entities by a certain regex pattern input, for things like destroying only specifically named ships/stations.
  // TODO: Map out the "creator" possibilities for /sector_info and enable filtering of lists by creator regex patterns


  // Needs testing:
  // clearMines()
  // clearOverheating()
  // despawn
  // isLoaded()
  // importSector
  // exportSector
  // populate
  // repair
  // spawnEntity


  var theCoordsObj=new CoordsObj(xGiven,yGiven,zGiven); // This will handle any conversions needed of various inputs, either strings of x y z, Array of coordinates, other sector or coords objects, etc.
  var x=theCoordsObj.x;
  var y=theCoordsObj.y;
  var z=theCoordsObj.z;
  // Only if this is valid should we proceed.
  if (typeof x == "number" && typeof y == "number" && typeof z == "number"){
    this.coords=theCoordsObj;
    this.clearMines=function(options){
      // RETURN: [SERVER, Mines cleared in 2, 2, 2!, 0]
      return runSimpleCommand("/clear_mines_sector " + this.coords.toString(),options);
    }
    this.clearOverheating=function(options){
      // Will error and return false if the sector is unloaded.
      return runSimpleCommand("/clear_overheating_sector " + this.coords.toString(),options);
    }
    this.despawn=function(partOfShipName,used,shipOnly,options){
      // /despawn_sector
      // EXAMPLE: /despawn_sector MOB_ unused true 2 2 2
      // Will error and return false if the sector is unloaded.
      var partOfShipNameToUse=toStringIfPossible(partOfShipName);
      if (typeof partOfShipNameToUse != "string"){
        throw new Error("Invalid input given to SectorObj.despawn!");
      }
      var usedToUse="all";
      var usedTest=toStringIfPossible(used);
      if (typeof usedTest == "string"){
        usedTest=usedTest.toLowerCase();
      }
      if (usedTest == "all" || usedTest == "used" || usedTest == "unused"){
        usedToUse=usedTest;
      }
      var shipOnlyToUse="false";
      if (isTrueOrFalse(shipOnly)){
        shipOnlyToUse=shipOnly;
      }
      return runSimpleCommand("/despawn_sector \"" + partOfShipNameToUse + "\" " + usedToUse + " " + shipOnlyToUse + " " + this.coords.toString(),options);
    }
    this.isLoaded=function(){
      // ^RETURN\: \[SERVER, LOADED SECTOR INFO\:
      // RETURN: [SERVER, LOADED SECTOR INFO: Sector[132](2, 2, 2); Permission[Peace,Protected,NoEnter,NoExit,NoIndication,NoFpLoss]: 000000; Seed: -4197430019395025102; Type: VOID;, 0]
      let result=starNetVerified("/sector_info " + this.coords.toString());
      let theReg=new RegExp("^RETURN: \\[SERVER, LOADED SECTOR INFO:.*");
      return starNetHelper.checkForLine(result,theReg);
    }
    this.importSector=function(sectorExport,options){
      // /import_sector
      // DESCRIPTION: make sure that the target sector is unloaded
      // PARAMETERS: toX(Integer), toY(Integer), toZ(Integer), name(String)
      // EXAMPLE: /import_sector 2 3 4 mySavedSector

      // No success message when successful
      // No error when file does not exist.

      // Only gives errors if parameters incorrect.  RETURN: [SERVER, Admin command failed: Error packing parameters, 0]

      // global.starMadeInstallFolder
      if (typeof sectorExport == "string"){
        var sectorExportFile=sectorExport;
        if (!(/\.smsec$/i).test(sectorExportFile)){
          sectorExportFile+=".smsec";
        }
        var exportFolder=path.join(global.starMadeInstallFolder,"sector-export/");
        var sectorExportFilePath=path.join(exportFolder,sectorExportFile);
        // StarMade seems to behave in a case insensitive way on windows, but case sensitive on linux and probably mac
        var theTest=false;
        if (process.platform=="win32"){
          theTest=miscHelpers.isFileInFolderCaseInsensitive(sectorExportFilePath); // This is literal for the path but not for the file.
        } else {
          theTest=miscHelpers.existsAndIsFile(sectorExportFilePath); // This does a literal check.
        }
        if (theTest){ // Does a lowercase test of the filename because I believe StarMade does not care.  This needs to be tested on linux.
          // File exists
          if (this.isLoaded()){
            return false;
          }
          // This will not return any errors unless the parameters are incorrect.
          return runSimpleCommand("/import_sector " + this.coords.toString() + " " + sectorExport,options);
        }
      }
      return false;
    }
    this.exportSector=function(sectorExport,options){
      // Will not give any error whether it did anything or not, unless parameters are incorrect
      var sectorExportToUse=toStringIfPossible(sectorExport);
      if (typeof sectorExportToUse == "string"){
        return runSimpleCommand("/export_sector " + this.coords.toString() + " " + sectorExport,options);
      }
      throw new Error("Invalid input given to SectorObj.exportSector as sectorExport!");
    }
    this.populate=function(options){
      // Will not give any error whether it did anything or not, unless parameters are incorrect
      // DESCRIPTION: WARNING: this will populate the sector. Use this as a reset after using /despawn_sector!
      return runSimpleCommand("/populate_sector " + this.coords.toString(),options);
    }
    this.repair=function(options){
      // WARNING - I think this is broken via StarNet.jar or through the console.  It ALWAYS gives the following error:
      // RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client, 0]
      // DESCRIPTION: attempts to correct the regitry of the sector
      return runSimpleCommand("/repair_sector " + this.coords.toString(),options);
    }
    this.spawnEntity=function(blueprintObj,shipName,factionNum,aiActiveBoolean,options){
      // factionNum and aiActive are optional
      // factionNum can be a faction object.

      var blueprintName=toStringIfPossible(blueprintObj);
      if (typeof blueprintName != "string"){
        throw new Error("Invalid input given to SectorObj.spawnEntity as blueprintObj!");
      }
      var shipNameToUse=toStringIfPossible(shipName);
      if (typeof shipNameToUse != "string"){
        throw new Error("Invalid input given to SectorObj.spawnEntity as shipName!");
      }

      var factionNumToUse=0;
      if (testIfInput(factionNum)){ // If no input given, that is ok, we'll just use 0.
        var factionNumTest=toStringIfPossible(factionNum); // This handles a factionObj
        if (isNum(factionNumTest)){ // Will be true if the string is a number.
          factionNumToUse=factionNumTest;
        } else { // Some invalid string or object was given
          throw new Error("Invalid input given to SectorObj.spawnEntity as factionNum!");
        }
      }
      var aiActiveBooleanToUse=false;
      if (testIfInput(aiActiveBoolean)){ // If no input, that is ok.  We'll just use false.
        if (isTrueOrFalse(aiActiveBoolean)){
          aiActiveBooleanToUse=aiActiveBoolean;
        } else {
          throw new Error("Invalid input given to SectorObj.spawnEntity as aiActiveBoolean!");
        }
      }
      return runSimpleCommand("/spawn_entity \"" + blueprintName + "\" \"" + shipNameToUse + "\" " + this.coords.toString() + " " + factionNumToUse + " " + aiActiveBooleanToUse,options);
      // /spawn_entity // Also in the BluePrintObj
      // DESCRIPTION: Spawns a ship in any sector with a faction tag and AI tag.
      // PARAMETERS: BlueprintName(String), ShipName(String), X(Integer), Y(Integer), Z(Integer), factionID(Integer), ActiveAI(True/False)
      // EXAMPLE: /spawn_entity mySavedShip shipName sectorX sectorY sectorZ -1 true
    }


    // Below needs to be brought up to the current standard of true=success,false=fail, throw error on connection problem.
    this.load=function(){
      // old method:
      // This returns "true" if the command ran, false for anything else, such as if the server was down.
      // let theResponse=starNetSync("/load_sector_range " + this.coords.toString() + " " + this.coords.toString());
      // return starNetHelper.detectRan(theResponse);
      return runSimpleCommand("/load_sector_range " + this.coords.toString() + " " + this.coords.toString());
    };
    this.setChmod=function(val,options){ // val should be a string
      // This will return true if it was a success, false otherwise.
      // Example vals:  "+ peace" or "- protected"
      return sectorSetChmod(this.coords,val,options);
    };
    this.getChmodArray=function(options){
      // This really should do a force save before pulling the values.. wish there was a way to do it silently..
      return decodeChmodNum(getChmodNum(this.coords,options));
    };
    this.getChmodNum=function(){
      // This really should do a force save before pulling the values.. wish there was a way to do it silently..
      return getChmodNum(this.coords);
    };
    this.setChmodNum=function(newNum,options){ // Only has 1 option, which is to do a forcesave and then intelligently add/remove chmod values rather than the default of bruteforcing adding all needed and removing all unneeded.
      var chmodResults=sectorSetChmodNum(this.coords,newNum,options);
      if (!objectHelper.isArrayAllEqualTo(chmodResults,true)){ // The return value should be an array of true/false values.  If any of them were not true (false), it means something failed.
        console.error("Error setting one of the chmod values for " + this.coords + " with values for chmod number, " + newNum + "!");
      }
      return chmodResults;
    };
    this.listEntityUIDs=function(filter,options){
      return returnEntityUIDList(this.coords.toString(),filter,options);
    };
    this.listShipUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"ENTITY_SHIP_");
    };
    this.listStationUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"ENTITY_SPACESTATION_");
    };
    this.listShopUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"ENTITY_SHOP_");
    };
    this.listCreatureUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"ENTITY_CREATURE_");
    };
    this.listAsteroidUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"(ENTITY_FLOATINGROCK_|ENTITY_FLOATINGROCKMANAGED_)");
    };
    this.listPlanetUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"(ENTITY_PLANET_|ENTITY_PLANETCORE_)");
    };
    this.listPlayerUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"(ENTITY_PLAYERCHARACTER_|ENTITY_PLAYERSTATE_)");
    };
    this.entities=function(filter,options){
      // "filter" is optional, it should look something like this "(ENTITY_SHIP_|ENTITY_CREATURE_)".  This will return all ships and creatures.
      // "options" are simply forwarded to the listEntityUIDs method and are also optional
      var returnArray=[];
      var uidArray=this.listEntityUIDs(filter,options);
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          // Set the correct type of object for each entity in the sector.  If new commands come out for planets or asteroids, we should prefer those types.
          if (uidArray[i].match(/^(ENTITY_SHIP_|ENTITY_SPACESTATION_|ENTITY_SHOP_|ENTITY_FLOATINGROCK_|ENTITY_FLOATINGROCKMANAGED_|ENTITY_PLANET_|ENTITY_PLANETCORE_)/)){
            returnArray.push(new EntityObj(uidArray[i]));
          } else if (uidArray[i].match(/^(ENTITY_PLAYERCHARACTER_|ENTITY_PLAYERSTATE_)/)){
            returnArray.push(new PlayerObj(uidArray[i]));
          } else if (uidArray[i].match(/^ENTITY_CREATURE_/)){
            returnArray.push(new CreatureObj(uidArray[i]));
          }
        }
      }
      return returnArray;
    };
    this.ships=function(){
      var returnArray=[];
      var uidArray=this.listShipUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    };
    this.stations=function(){
      var returnArray=[];
      var uidArray=this.listStationUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    };
    this.shops=function(){
      var returnArray=[];
      var uidArray=this.listShopUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    };
    this.creatures=function(){ // This includes NPC's, spiders, hoppies, or custom creations
      var returnArray=[];
      var uidArray=this.listCreatureUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new CreatureObj(uidArray[i]));
        }
      }
      return returnArray;
    };
    this.asteroids=function(){ // TODO: Consider creating an AsteroidObj as opposed to entity if there are commands that won't work correctly with them
      var returnArray=[];
      var uidArray=this.listAsteroidUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    };
    this.planets=function(){ // TODO: Consider creating an PlanetObj as opposed to entity if there are commands that won't work correctly with them
      var returnArray=[];
      var uidArray=this.listPlanetUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    };
    this.players=function(){ // I do not think this will actually work.
      var returnArray=[];
      var uidArray=this.listPlayerUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new PlayerObj(uidArray[i]));
        }
      }
      return returnArray;
    };
    // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
    if (arguments.length > SectorObj.length){
      var extraInfoArray=[];
      for (let i=SectorObj.length-1;i<arguments.length;i++){
        extraInfoArray.push(arguments[i]);
      }
      this.extraInfo=extraInfoArray;
    }
    // this.toString=function(){ return this.coords.toString() }; // We don't want to set this here because then it shows up as a key.  Instead we set up the prototype at the top of the script.
  } else {
    throw new Error("ERROR: Invalid values given to SectorObj constructor!");
  }
};

function CoordsObj(xInput,yInput,zInput){ // xInput can be a string or space or comma separated numbers, coordsObj, or a sectorObj
  // test to ensure string, array, CoordsObj, SectorObj, and regular numbers/strings(which are numbers) works.
  var x=objectHelper.toNumIfPossible(xInput);
  var y=objectHelper.toNumIfPossible(yInput);
  var z=objectHelper.toNumIfPossible(zInput);
  var xToUse;
  var yToUse;
  var zToUse;
  if (typeof x == "number" && typeof y == "number" && typeof z == "number"){
    xToUse=x;
    yToUse=y;
    zToUse=z;
  } else if (typeof xInput == "string" && typeof y == "undefined"){ // This handles coords with spaces or commas
    var tempArray=[];
    if (xInput.indexOf(",") > "-1"){ // comma separated values
      tempArray=xInput.split(",");
    } else if (xInput.indexOf(" ") > "-1") {
      tempArray=xInput.split(" "); // space separated values
    } else {
      throw new Error("Invalid string given as input to CoordsObj: " + x);
    }
    if (tempArray.length == 3){
      xToUse=objectHelper.toNumIfPossible(tempArray[0].trim());
      yToUse=objectHelper.toNumIfPossible(tempArray[1].trim());
      zToUse=objectHelper.toNumIfPossible(tempArray[2].trim());
    } else {
      console.error("Invalid amount of numbers given as string to CoordsObj. (" + tempArray.length + "): " + xInput);
      throw new Error("Invalid amount of numbers given as string to CoordsObj.");
    }
  } else if (typeof xInput=="object"){ // This handles arrays or other objects
    if (objectHelper.getObjType(xInput) == "Array"){
      if (xInput.length==3){
        if (typeof xInput[0] == "number"){ // This is necessary because .trim() will throw an error if attempted on a number
          xToUse=xInput[0];
        } else { 
          xToUse=objectHelper.toNumIfPossible(xInput[0].trim()); 
        }
        if (typeof xInput[1] == "number"){
          yToUse=xInput[1];
        } else { 
          yToUse=objectHelper.toNumIfPossible(xInput[1].trim()); 
        }
        if (typeof xInput[2] == "number"){
          zToUse=xInput[2];
        } else { 
          zToUse=objectHelper.toNumIfPossible(xInput[2].trim()); 
        }
      } else {
        var errMsgObj=new Error("Invalid number of values given in array to CoordsObj (" + x.length + "): " + x);
        throw errMsgObj;
      }
    } else if (objectHelper.getObjType(xInput) == "CoordsObj" || objectHelper.getObjType(xInput) == "SectorObj"){
      var coordArrayTemp=xInput.toArray();
      xToUse=coordArrayTemp[0];
      yToUse=coordArrayTemp[1];
      zToUse=coordArrayTemp[2];
    } else {
      throw new Error("Invalid object input given to CoordsObj: " + x);
    }
  }
  if (typeof xToUse != "number" || typeof yToUse != "number" || typeof zToUse != "number"){
    console.error("Invalid coords input given to new CoordsObj: " + xToUse + " " + yToUse + " " + zToUse);
    throw new Error("Invalid coords input given to new CoordsObj: " + xToUse + " " + yToUse + " " + zToUse);
  }
  this.x=xToUse;
  this.y=yToUse;
  this.z=zToUse;
  this.coords=function(){ return new CoordsObj(this.x,this.y,this.z) }; // This is to allow a sectorObj to gracefully morph into a CoordsObj and for a CoordsObj to be duplicated and then possibly modified.
  

  // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
  if (arguments.length > CoordsObj.length){ // the CoordsObj.length gets the number of expected input vars
    var extraInfoArray=[];
    for (let i=CoordsObj.length-1;i<arguments.length;i++){
      extraInfoArray.push(arguments[i]);
    }
    this.extraInfo=extraInfoArray;
  }
  // this.toString=function(){ return this.string };
};
function CreatureObj(fullUID){ // TODO: create creature object
  console.log("Complete me plz.");
  this["UID"]=stripFullUIDtoUID(fullUID);
  this["fullUID"]=fullUID;
};
function EntityObj(fullUID,shipName){ // takes EITHER the full UID or the ship name.  If a ship name is provided, it will look up the full UID via a StarNet.jar command.
  // This builds an entity object based on the full UID
  // This can be used for ships and stations.  // TODO: There will be PlanetObj for planets and AsteroidObj for asteroids if there are differences in what can or cannot be done to them.

  let fullUIDToUse=fullUID;
  if (shipName){
    fullUIDToUse=starNetHelper.getUIDfromName(shipName);
  }

  if (fullUIDToUse){
    this["UID"]=stripFullUIDtoUID(fullUIDToUse); // Returns the UID as used with SQL queries, without the "ENTITY_SHIP_" whatever stuff.
    this["fullUID"]=fullUIDToUse;

    // Needs testing below:
    this.decay=function(options){ // decays the ship
      return runSimpleCommand("/decay_uid " + this.fullUID,options);
    }
    this.setFaction=function(factionNumOrObj,options){ // Expects a faction number or FactionObj as input.
      let factionNum=toNumIfPossible(toStringIfPossible(factionNumOrObj)); // This converts FactionObj to a string and then back to a number.
      if (typeof factionNum == "number"){
        return runSimpleCommand("/faction_set_entity_uid " + this.fullUID + " " + factionNum,options);
      } else {
        throw new Error("Invalid input given to EntityObj.setFaction() for factionNumOrObj!");
      }
    }
    this.setFactionRank=function(rankNum,options){
      let theRankNum=toNumIfPossible(rankNum);
      if (typeof theRankNum == "number"){
        return runSimpleCommand("/faction_set_entity_rank_uid " + this.fullUID + " " + theRankNum,options);
      } else {
        throw new Error("Invalid input given to EntityObj.setFactionRank() for rankNum!");
      }
    }
    this.kickPlayersOut=function(options){ // decays the ship
      return runSimpleCommand("/kick_players_out_of_entity_uid " + this.fullUID,options);
    }
    this.kickPlayersOutDock=function(options){ // decays the ship
      return runSimpleCommand("/kick_players_out_of_entity_uid_dock \"" + this.fullUID + "\"",options);
    }
    this.putPlayerIntoThisEntity=function(thePlayer,options){ // player can be their name or a PlayerObj
      let thePlayerName=toStringIfPossible(thePlayer); // This converts PlayerObj to the name of the player as a string
      if (typeof thePlayerName == "string"){
        return runSimpleCommand("/player_put_into_entity_uid " + thePlayerName + " \"" + this.fullUID + "\"",options);
      } else {
        throw new Error("Invalid input given to EntityObj.putPlayerIntoThisEntity() for thePlayer!");
      }
    }
    this.saveAsBlueprint=function(blueprintName,options){ // Saves the ship as a blueprint with no owner.  Can accept a BlueprintObj as input
      // Note:  Returns a BlueprintObj if successful instead of true
      let theBlueprintName=toStringIfPossible(blueprintName); // This converts BlueprintObj a string
      if (typeof theBlueprintName == "string"){
        if(runSimpleCommand("/save_uid \"" + this.fullUID + "\" \"" + theBlueprintName + "\"",options)){
          return new BluePrintObj(theBlueprintName);
        } else {
          return false;
        }
      } else {
        throw new Error("Invalid input given to EntityObj.putPlayerIntoThisEntity() for thePlayer!");
      }
    }
    this.shopRestockFull=function(options){ // restocks a shop to full
      // WARNING: If a station has a shop on it, it will be restocked incorrectly to include even illegal items that should never be found in a shop, such as gold bars and green dirt.
      return runSimpleCommand("/shop_restock_full_uid \"" + this.fullUID + "\"",options);
    }
    this.shopRestock=function(options){ // restocks a shop
      // WARNING: If a station has a shop on it, it will be restocked incorrectly to include even illegal items that should never be found in a shop, such as gold bars and green dirt.
      return runSimpleCommand("/shop_restock_uid \"" + this.fullUID + "\"",options);
    }    
    this.softDespawn=function(options){ // despawns an entity as though it were destroyed, till the sector is reloaded.
      // WARNING: if an entity has docked entities on it and it is soft-despawns, I believe this causes them to undock.
      return runSimpleCommand("/soft_despawn \"" + this.fullUID + "\"",options);
    }    
    this.softDespawnDock=function(options){ // despawns an entity (and all docked entities) as though it were destroyed, till the sector is reloaded.
      return runSimpleCommand("/soft_despawn_dock \"" + this.fullUID + "\"",options);
    }    
    this.setMinable=function(trueOrFalse,options){ // Sets whether an entity should be minable by salvager beams
      let booleanToUse=trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      // Does not have success or fail messages
      if (isTrueOrFalse(booleanToUse)){
        return runSimpleCommand("/structure_set_minable_uid \"" + this.fullUID + "\" " + booleanToUse,options);
      } else {
        throw new Error("Invalid input given to EntityObj.setMinable() for trueOrFalse!");
      }
    }
    this.setVulnerable=function(trueOrFalse,options){ // Sets whether an entity is invincible
      let booleanToUse=trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      // Does not have success or fail messages
      if (isTrueOrFalse(booleanToUse)){
        return runSimpleCommand("/structure_set_vulnerable_uid \"" + this.fullUID + "\" " + booleanToUse,options);
      } else {
        throw new Error("Invalid input given to EntityObj.setVulnerable() for trueOrFalse!");
      }
    }
    this.changeSector=function(sector,options){ // sector can be a LocationObj, SectorObj, CoordsObj, or other input that can be translated to a CoordsObj.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      var sectorToUse;
      if (testIfInput(sector)){ // Non-object input given
        sectorToUse=toStringIfPossible(sector); // This converts any obj, including SectorObj, CoordsObj, and LocationObj to a string
        try { // Let's see if coordinates can be made from the input.  A String (separated by , or spaces) or an Array can be given as input.
          sectorToUse=new CoordsObj(sectorToUse).toString();
        } catch (error){ // Invalid input given.
          console.error("Invalid input given to EntityObj.changeSector as sector!");
          throw error; 
        }
      } else { // Invalid amount of arguments given
        throw new Error("No sector value given EntityObj.changeSector for sector!");
      }
      if (typeof sectorToUse=="string"){
        // We should be all set to send the command now.
        var fast=getOption(options,"fast",false);
        var changeSectorCommand="/change_sector_for_uid \"" + this.fullUID + "\" " + sectorToUse;
        if (fast){
          return sendDirectToServer(changeSectorCommand);         
        } else {
          var result2=starNetHelper.starNetVerified(changeSectorCommand); // This will throw an error if the connection to the server fails.
          // Success: RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] changed sector for Benevolent27 to (1000, 1000, 1000), 0]
          // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client Benevolent27, 0]
          var theReg3=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[SUCCESS\\]");
          if (starNetHelper.checkForLine(result2,theReg3)){ // The command succeeded.
            return true;
          } else { // The command failed.  Player either offline or does not exist for some reason.
            return false;
          }
        }
      }
      throw new Error("Invalid parameters given to EntityObj.changeSector!"); // This is redundant
    }
    // this.changeSectorCopy // There is no "/change_sector_for_uid_copy" command in-game right now.
    this.teleportTo=function(coords,options){ // Accepts CoordsObj or LocationObj or any set of input that will translate to a CoordsObj
      if (testIfInput(coords)){ // Input given
        var spacialCoordsToUse=toStringIfPossible(coords,{"type":"spacial"}); // This option will allow a LocationObj to have it's spacial coords converted to as tring.  Any other object, such as a CoordsObj will ignore the option.
        try { // Let's see if coordinates can be made from the input.  If a LocationObj was provided, the string returned will work.
          spacialCoordsToUse=new CoordsObj(coords).toString();
        } catch (error){ // Invalid input given.
          console.error("Invalid input given to EntityObj.teleportTo for coords!");
          throw error; 
        }
      }
      var fast=getOption(options,"fast",false);
      // I'm not using runSimpleCommand() since I know what the success message is for this, and this provides better accuracy on the success/fail result.
      if (typeof spacialCoordsToUse=="string" && testIfInput(coords)){ // This is a redundant check.
        var teleportToCommand="/teleport_uid_to \"" + this.fullUID + "\" " + spacialCoordsToUse;
        if (fast){
          return sendDirectToServer(teleportToCommand);         
        } else {
          var result2=starNetHelper.starNetVerified(teleportToCommand); // This will throw an error if the connection to the server fails.
          // Success: RETURN: [SERVER, [ADMIN COMMAND] teleported Benevolent27 to , 0]
          // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client, 0]
          var theReg3=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] teleported");
          if (starNetHelper.checkForLine(result2,theReg3)){ // The command succeeded.
            return true;
          } else { // The command failed.  Player either offline or does not exist for some reason.
            return false;
          }
        }
      }
      throw new Error("Invalid parameters given EntityObj.teleportTo for coords!"); // This is redundant and should never happen.
    }




    this["loaded"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"loaded") };
    // faction.number is WILDLY INACCURATE RIGHT NOW - WAITING ON FIX FROM SCHEMA - WILL NEED TO BE FIXED IN starNetHelper.js
    this["faction"]=function(){ return new FactionObj(starNetHelper.getEntityValue(this.fullUID,"faction")) };
    this["mass"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Mass") };
    // TODO: Change this to return an array of objects that are attached.  Players I think normally?  Are NPC's also possible though?
    this["attached"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Attached") };
    // TODO: Change this to "docked", which will return an array of EntityObjs
    this["dockedUIDs"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"DockedUIDs") };
    this["blocks"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Blocks") };
    // TODO: See what sorts of values might appear for lastModified and have it return the correct types of objects rather than a string value
    this["lastModified"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"LastModified") };
    // TODO: See what sorts of values might appear for creator and have it return the correct types of objects rather than a string value
    this["creator"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Creator") };
    this["sector"]=function(){ return new SectorObj(...starNetHelper.getEntityValue(this.fullUID,"Sector")) };
    this["name"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Name") };
    this["minBB"]=function(){ return new CoordsObj(...starNetHelper.getEntityValue(this.fullUID,"MinBB(chunks)")) };
    this["maxBB"]=function(){ return new CoordsObj(...starNetHelper.getEntityValue(this.fullUID,"MaxBB(chunks)")) };
    this["spacialCoords"]=function(){ return new CoordsObj(...starNetHelper.getEntityValue(this.fullUID,"Local-Pos")) };
    // TODO: Create an OrientationObj. Till then though, just return an array of values.
    this["orientation"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Orientation") };
    this["type"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"type") };
    // this["objType"]="EntityObj"; // Totally not necessary since we have objHelper.getObjType()

    this["dataMap"]=function(){ return new starNetHelper.ShipInfoUidObj(this.fullUID) }; // TODO:  This seems broken
    this["dataObj"]=function(){ return new starNetHelper.ShipInfoUidObj(this.fullUID,{"objType":"object"}) }; // TODO:  This seems broken


    this.load=function(){
      // This returns "true" if the command ran, false for anything else, such as if the server was down.
      return this.sector().load();
    };
    // this.toString=function(){ return this.fullUID.toString() }; // This is visible as an element, so really we should set the prototype outside of the constructor.

    // TODO: Add Info methods:
    // system - returns a SystemObj of the current system the entity is within
    // isClaimPoint - returns boolean true/false value if the entity is the claim point for the system it is within
    // attached - returns an array of attached PlayerObj's
    // dockedUIDs - returns an array of docked EntityObj's

    // Info methos using SQL queries:
    // typeNum - Returns the type number, as designated by SQL query
    // typeName - Returns the name for the type it is, such as "asteroid", "asteroidManaged", "planet", as per the SQL documentation project
    // dockedTo - Returns the EntityObj for the entity this entity is currently docked to
    // dockedToRoot - Returns the EntityObj for the root entity this entity is currently docked to

    // Action methods:
    // changeSector("[X],[Y],[Z]", SectorObj, or CoordsObj) - Teleports the entity (by UID) to a specific sector
    // destroy - Destroys the ship, leaving docked entities (using /destroy_uid)
    // destroyDocked - Destroys the ship and all docked entities (using /destroy_uid_docked)
    // saveBlueprint(BlueprintNameString) - Saves the current entity as a blueprint name, returning a BlueprintObj.  Note:  There is currently NO WAY to delete blueprints in-game!  Also the BlueprintObj will likely only be valid once the save actually completes.

    // shopRestock - Runs a /shop_restock_uid on the UID of the entity.  Only works if the entity IS a shop or has a shop module on it.  WARNING: It is recommended to ONLY use this on stick shops because base entities with shops on them get restocked with ALL items currently, including custom and depreciated blocks like gold bars and green dirt, etc.
    // shopRestockFull - Runs a /shop_restock_full_uid on the UID of the entity.  Only works if the entity IS a shop or has a shop module on it.  WARNING: It is recommended to ONLY use this on stick shops because base entities with shops on them get restocked with ALL items currently, including custom and depreciated blocks like gold bars and green dirt, etc.

    // Optional:
    // destroyOnlyDocked - Can use sql queries to individually destroy only entities that have this entity as the root docking point or down the chain from it - would take some work and might be unreliable since it requires using /sql_query which only updates on force-saves and auto-saves
    // serverMessage(MessageString,info/warning/error) - Sends a message to all online players that are currently attached to this entity.  If no method is specified "plain" is used, which shows up on the player's main chat.

  } else {
    throw new Error("ERROR: No UID provided to EntityObj constructor!");
  }
};
function RemoteServerObj(ip,domain,port){
  this.ip=new IPObj(ip);
  this.domain=domain;
  this.port=port;
};
function LockFileObj(pathToLockFile){
  // Example uses:
  // new LockFileObj("myNewLockFile.lck")
  // new LockFileObj("/full/path/to/lockFile.lck")
  // new LockFileObj(); // Loads the default lock file

  // This is used to help manage subprocesses, killing them when the main script exits and checking for them on next start if still alive
  // TODO: Add a function that spawns a process, records the PID to the lock file, and returns the process object.
  var theLockFile;
  if (pathToLockFile){
    if (isInvalidPath(pathToLockFile)){
      throw new Error("Unable to create LockFile object!  Invalid path to lock file provided: " + theLockFile);
    }
    theLockFile=path.resolve(mainFolder,pathToLockFile); // Resolve to use the main folder as the default path if a full path is not provided.
  } else { // if no lock file provided, use the default, which should be in the same folder as starmade.js
    theLockFile=lockFile;
  }

  var defaultData={
    "mainPID": process.pid,
    "subProcessPIDs": []
  };
  this.dirName=path.dirname(theLockFile);
  this.fileName=theLockFile;
  this.getData=function(){ // This will update the data property and return a new read
    if (fs.existsSync(theLockFile)){ // If it exists, return the data, otherwise return false.
      var readData=JSON.parse(fs.readFileSync(theLockFile));
      this.data=readData;
      return readData;
    } else { // Make no changes if it did not exist.
      return false;
    }
  }
  this.write=function(theDataToWrite){ // theDataToWrite is optional and replaces the data found from this.data.
    // This returns true or false depending on if the write succeeded
    miscHelpers.ensureFolderExists(this.dirName);
    try {
      if (theDataToWrite){
        fs.writeFileSync(this.fileName,JSON.stringify(theDataToWrite, null, 4));
      } else {
        fs.writeFileSync(this.fileName,JSON.stringify(this.data, null, 4));
      }
      return true;
    } catch (error){
      return error;
    }
  }
  // Set up the data and new property
  var grabData=this.getData();
  if (grabData == false){ // file didn't exist
    this.new=true;
    var writeResult=this.write(defaultData); // generate a new lock file with default data
    if (writeResult != true){  // If not a success, forward the error thrown by the write operation.
      console.error("Unable to write default data to new lock file!");
      throw writeResult;
    }
    this.data=defaultData;
  } else {
    this.new=false;
    // Should we verify that the imported data actually has appropriate or innappropriate values?
    this.data=grabData;
  }
  // Add functions to add and remove server pids
  this.addSubProcessPid=function(thePID){ // this updates the "data" property of this object and writes it to the file
    var thePIDtoUse=objectHelper.toNumIfPossible(thePID);
    var thePidsArray=this.data.subProcessPIDs;
    if (thePidsArray.indexOf(thePIDtoUse) == -1){ // The PID is not in the array
      this.data.subProcessPIDs.push(thePIDtoUse);
      let writeResult=this.write();
      if (writeResult != true){
        console.error("Unable to write to lock file when adding PID!");
        throw writeResult;
      }
      return true;
    }
    return false; // Could not add the PID because it already existed
  }
  this.delSubProcessPid=function(thePID){ // this updates the "data" property of this object and writes it to the file
    var thePIDtoUse=objectHelper.toNumIfPossible(thePID);
    var thePidsArray=this.data.subProcessPIDs;
    var thePIDIndex=thePidsArray.indexOf(thePIDtoUse);
    if (thePIDIndex != -1){ // The PID is in the array
      this.data.subProcessPIDs.splice(thePIDIndex,1);
      let writeResult=this.write();
      if (writeResult != true){
        console.error("Unable to write to lock file when deleting PID: " + thePIDtoUse);
        throw writeResult;
      }
      return true;
    }
    return false; // Could not add the PID because it already existed
  }
  this.deleteFile=function(){
    console.log("Deleting lock file!");
    try{
      fs.unlinkSync(this.fileName);
      console.log("Blamo!");
    } catch (err){
      throw new Error("Unable to delete lock file!  Please ensure you have access to delete it this file: " + this.fileName);
    }
  }
  this.countAlivePids = function(){
    // This should return true if any of the PIDs are alive, otherwise false.
    var count=0;
    if (this.data.hasOwnProperty("mainPID")){
      if (this.data["mainPID"]){
        if (miscHelpers.isPidAlive(this.data["mainPID"])) {
          count++
        }
      }
    }
    if (this.data.hasOwnProperty("subProcessPIDs")){
      var serverPIDs=this.data["subProcessPIDs"];
      for (let i=0;i<serverPIDs.length;i++){
        if (miscHelpers.isPidAlive(serverPIDs[i])){
          count++
        }
      }
    }
    return count;
  }
  this.getAlivePids=function(){
    // This should return true if any of the PIDs are alive, otherwise false.
    var returnArray=[];
    if (this.data.hasOwnProperty("mainPID")){
      if (this.data["mainPID"]){
        if (miscHelpers.isPidAlive(this.data["mainPID"])) {
          returnArray.push(this.data["mainPID"]);
        }
      }
    }
    if (this.data.hasOwnProperty("subProcessPIDs")){
      var subProcessPids=this.data["subProcessPIDs"];
      for (let i=0;i<subProcessPids.length;i++){
        if (miscHelpers.isPidAlive(subProcessPids[i])){
          returnArray.push(subProcessPids[i]);
        }
      }
    }
    return returnArray;
  }
  this.killAlivePidsExceptThisProcess=function(){ // We never want to send a kill command to our own process, that would just be dumb
    console.log("Checking if any PID's are alive and killing them..");
    var alivePidsArray=this.getAlivePids();
    var pidsKilledCount=0;
    if (alivePidsArray.length > 0){
      for (let i=0;i<alivePidsArray.length;i++){
        var pidToKill=toNumIfPossible(alivePidsArray[i]);
        if (pidToKill != process.pid){
          pidsKilledCount++;
          console.log("Killing PID: " + pidToKill);
          treeKill(pidToKill, 'SIGTERM');
          miscHelpers.waitAndThenKill(300000,pidToKill); // Gives up to 5 minutes before sending a kill signal
        }
      };
    }
    if (pidsKilledCount>0) {
      console.log("No pids (besides this one) were alive.  Nothing to do!");
    }
    return true; // Since we made it this far, we can return true.  No pids in the lock file should be alive now.
  }
  exitHook(() => { // This will handle sigint and sigterm exits.
    // Cleanup that needs to be done on the global scope should be done here.
    console.log("Cleaning up running pids tracked by this lock file..");
    // if (this.countAlivePids() > 0){
      console.log("Attempting to kill any alive processes..")
      var killResult=this.killAlivePidsExceptThisProcess();
      console.log("All pids dead?: " + killResult);
      if (killResult == true){
        console.log("All PID's should be dead, removing lock file..");
        this.deleteFile();
      }
  });
};


// Array generators
function getServerListArray(cb){ // This must be provided with a callback function that has standard error first handling.  Example:  cb(err,response)
  var fileURL="http://files-origin.star-made.org/serverlist"  // This is where the server list is currently.
  var rawData="";
  try {
    var request = http.get(fileURL, function(response) {
      // console.log("Status Code: " + response.statusCode);
      // When the file is downloaded with the "http.get" method, it returns an object from which you can get the HTTP status code.
      // 200 means it was successfully downloaded, anything else is a failure.  Such as 404.
      var error=null;
      var returnArray=[];
      if (response.statusCode != 200){
         error=new Error("Response from HTTP server: " + response.statusMessage);
      }
      response.on('data', function(chunk){ rawData+=chunk });
      response.on('end', function() {
        if (rawData){
          returnArray=rawData.trim().split("\n"); // Trim to remove any extra \n at the end so the last values won't be undefined.
          returnArray.forEach(function(val,index){
            returnArray[index]=returnArray[index].split(",");
          });
          returnArray.forEach(function(val,index){
            returnArray[index]=new RemoteServerObj(...returnArray[index]);
          });
        }
        cb(error,returnArray)
      });
    });
  } catch (err){ return cb(err,rawData) }
  return request;
};


// Support Functions

function ipBan(ipAddress,minutes,options){ // minutes are optional.  A perm ban is applied if none provided. options are optional
  if (ipAddress){
    var ipToUse=ipAddress.toString(); // This allows ipObj's to be fed in, and this should translate to an ip string.
    if (minutes){
      var minutesNum=toNumIfPossible(minutes);
      if (typeof minutesNum == "number"){
        console.log("Banning IP, '" + ipAddress + "' for " + minutesNum + " minutes.");
        return starNetHelper.detectSuccess2(starNetVerified("/ban_ip_temp " + ipToUse + " " + minutesNum));
      } else {
        // invalid minutes given
        throw new Error("Invalid minutes specified!");
      }
    } else {
      // no minutes provided, so perform a perm ban
      console.log("PERMANENT banning IP, '" + ipAddress + "'!");
      return starNetHelper.detectSuccess2(starNetVerified("/ban_ip " + ipToUse));
    }
  } else {
    throw new Error("No ipAddress given to function, 'ipBan'!");
  }
};
function ipUnBan(ipAddress,options){ // options are optional and should be an object.
  if (ipAddress){
    var ipToUse=ipAddress.toString(); // This allows ipObj's to be fed in, and this should translate to an ip string.
    console.log("Unbanning IP: " + ipAddress);
    return starNetHelper.detectSuccess2(starNetVerified("/unban_ip " + ipToUse,options)); // This will return false if the ip is not found in the blacklist
  } else {
    throw new Error("No ipAddress given to function, 'ipUnBan'!");
  }
};
function createDateObjIfPossible(input){ // Takes either a date string that "new Date" can turn into an object, passes along a Date object fed to it, or returns false if no new Date could be created.
  // This can be used to return a date object from some dates provided by StarMade directly, such as the ip dates returned by the /player_info command.
  if (typeof input != "undefined" && input != "" && getObjType(input) != "Null"){ // if an input is nulled out using null, it actually appears as an "object" to typeof
    if (getObjType(input) == "Date"){
      return input; // If the input was already a Date object, just return it
    } else {
      try{
        var dateTest=new Date(input);
        if (dateTest.toString() == "Invalid Date"){ // If invalid input is given, return false
          return false;
        }
        return dateTest;

      } catch(err) {
        return false;  // Returns false if creating the data object threw an error.
      }
    }
  }
  return false; // Returns false if no input given
};
function getChmodNum(sectorObjArrayOrString,options){
  // This performs a sql query and returns the protections number for a sector as a number
  // Input can be a SectorObj,CoordsObj, Array of 3 numbers, or a string with a space or comma separating each value.  The preferred type is a SectorObj
  // Example inputs:
  // mySectorObj
  // 2,2,2
  // 2 2 2
  // [2,2,2]
  var returnNum=0;
  var coordsToUse=[];
  // Preprocess the input since it can be 3 different types of values
  const trueType=getObjType(sectorObjArrayOrString);
  if (trueType=="SectorObj"){
    coordsToUse=sectorObjArrayOrString.coords.toArray();
  } else if (trueType=="CoordsObj"){
    coordsToUse=sectorObjArrayOrString.toArray();
  } else if (typeof sectorObjArrayOrString == "string") {
    if (sectorObjArrayOrString.indexOf(" ")){
      coordsToUse=sectorObjArrayOrString.trim().split(" ");
    } else if (sectorObjArrayOrString.indexOf(",")){
      coordsToUse=sectorObjArrayOrString.trim().split(",");
    } else {
      throw new Error("ERROR: Invalid string given to function, getChmodNum!");
    }
  } else if (trueType=="Array"){ // TODO: Test to ensure "Array" is returned and not "array"
    if (sectorObjArrayOrString.length == 3){
      coordsToUse=sectorObjArrayOrString;
      // I could keep checking each value in the array to ensure they are numbers and throw an error if not.. but meh.
    } else {
      throw new Error("ERROR: Invalid array given to getChmodNum function!  Expected an array of 3 numbers!");
    }
  } else {
    throw new Error("ERROR: Invalid input given to getChmodNum function!  Expected a SectorObj, coordinates string, or array of 3 numbers!");
  }
  // console.log("Using coords: " + coordsToUse);
  if (coordsToUse.length == 3){
    var theQuery="SELECT PROTECTION FROM PUBLIC.SECTORS WHERE X=" + coordsToUse[0] + " AND Y=" + coordsToUse[1] + " AND Z=" + coordsToUse[2] + ";";
    var theQueryResult=new SqlQueryObj(theQuery);
    // console.log("sqlquery result:");
    // console.dir(theQueryResult);
    if (theQueryResult["error"] == false){ // If there were no results, it means the sector is not in the HSQL database and should have a default protection value of 0
      if (theQueryResult["mapArray"][0].has("PROTECTION")){ // if there was an entry, there SHOULD be a PROTECTION value, but just in case, let's check for it.
        returnNum=theQueryResult["mapArray"][0].get("PROTECTION");
        // console.log("Number found: " + returnNum);
      }
    }
  } else {
    throw new Error("ERROR: Invalid number of coordinates given to function, getChmodNum! Coordinates given: " + coordsToUse.length);
  }
  return toNum(returnNum);
};
function decodeChmodNum(num){ // A number should be provided, but a number as a string should be coerced into a number.
  // This converts a chmod number value from a sql query to an array of strings, such as ["peace","protected","noindications"].  Values are always returned in an array, even if only a single protection is in the number.  A 0 number will return an empty array.
  var theNum=toNum(num);
  if (typeof theNum == "number"){
    var returnArray=[];
    var numberOfProtections=sectorProtectionsArray.length;
    var exponentValue=numberOfProtections - 1;
    var highestValue=Math.pow(2,exponentValue);  // The "highestValue" is what each potential value in the array represents, starting with the first value in the array
    var highestTotal=Math.pow(2,numberOfProtections);
    if (num <= highestTotal && num > 0){ // Valid numbers can only be lower/equal to the highest total or larger than 0
      for (let i=0;i<sectorProtectionsArray.length && theNum > 0;i++){
        if (theNum >= highestValue){
          returnArray.push(sectorProtectionsArray[i]);
          theNum -= highestValue
        }
        highestValue /= 2; // Halve it!
      }
    } else if (theNum > highestTotal){
      console.error("ERROR: Number given to decodeChmodNum function was too large!  It should be no more than " + highestTotal + "!")
    } else if (theNum < 0){
      console.error("ERROR: Number given to decodeChmodNum function was too small!  It should always be an integer larger than 0!");
    }
    return returnArray;
  } else {
    throw new Error("ERROR: Invalid input given to function, decodeChmodNum!  Expected a number!");
  }
};
function sectorSetChmod(coordsObj,stringOrArray,options){ // val can be a string or an array of strings
  // This can be used to set multiple chmod values at the same time
  // Simple example:  sectorSetChmod(mySectorObj,"+ protected"); // This sets the sector number from mySectorObj to add protected, returning true or false depending on the success.
  // Using Array: sectorSetChmod(mySectorObj,["+ protected","- peace","- noindications"]); // This will cycle through the array and set each chmod, and then will return an array of true/false values corresponding to each string given.
  // Note that when false values are given, it simply means the chmod failed, but does not give a reason why.  For example, if "+ nonsense" is given, it will return false.  If the server is down and StarNet.jar couldn't connect, it will also return false.
  // Handling false values is up to the script invoking this function.
  let theType=objectHelper.getObjType(stringOrArray);
  console.log("Setting chmod values for: " + stringOrArray);
  // console.log("sectorSetChmod running!");
  if (theType == "string"){
    // console.log("Setting " + val + " for sector: " + coordsObj.toString());
    let theValLower=stringOrArray.toLowerCase();
    let theCommand="/sector_chmod " + coordsObj.toString() + " " + theValLower;
    // This needs to be changed to throw an error if the connection fails.
    // return starNetHelper.detectSuccess(starNetSync(theCommand));
    let theResult=starNetVerified(theCommand,options);
    return starNetHelper.detectSuccess(theResult);
  } else if (theType == "Array"){
    var resultsArray=[];
    for (let i=0;i<stringOrArray.length;i++){
      let theSubType=objectHelper.getObjType(stringOrArray[i]);
      if (theSubType == "string"){
        let theValLower=stringOrArray[i].toLowerCase();
        resultsArray.push(starNetHelper.detectSuccess(starNetVerified("/sector_chmod " + coordsObj.toString() + " " + theValLower,options)));
      } else {
        resultsArray.push(false);
      }
    }
    return resultsArray;
  } else {
    return new Error("Invalid sector chmod value given!");
  }
};
function sectorSetChmodNum(coordsOrSectorObj,newChmodNum,options){ // Options are optional.
  // There are two strategies we can use here:
  // 1. We can do a force save, pulling the existing values for the sector and only add or remove the ones needed.  This way will display an annoying auto-save popup for everyone everytime it runs, but will be slightly faster.
  // 2. We can brute force things, adding and removing chmod values to match the exact ones it should have.  This is slower, but there is no annoying popup for everyone.  This is the default behavior.
  // Example to use force safe:  sectorSetChmodNum(coordsObj,25,{forcesave:true})
  var forceSave=false;
  if (typeof options == "object"){ // Parse the options
    if (options.hasOwnProperty("forcesave")){
      if (options["forcesave"] === true){ // We only want to enable it if it is exactly set to true, not a truthy value
        forceSave=true;
      }
    }
  }
  var theCoords=coordsOrSectorObj.toString();
  var arrayToUse=[];

  if (forceSave == true){
    // try {
      starNetVerified("/force_save");
      var currentChmodNum=getChmodNum(coordsOrSectorObj);
      arrayToUse=getProtectionsDifferentialString(currentChmodNum,newChmodNum);
    // } catch (error) {
    //   console.error("Unable to set chmod for sector, " + theCoords + ", to protection number, " + newChmodNum + "!");
    //   console.error("Error message: " + error.message);
    // }
  } else {
    // brute force it.  It's the only option that won't have globally annoying consequences, even if it is a bit slow.
    arrayToUse=getChmodArrayFromNum(newChmodNum);
  }
  if (arrayToUse.length > 0){ // If the array is empty, it means no changes were needed
    return sectorSetChmod(theCoords,arrayToUse); // This returns an array of true/false values, each determining the success or failure of a chmod
  } else {
    return [true]; // Since no changes were needed, we can just return an array with a single true value to indicate success
  }
};
function getChmodArrayFromNum(newChmodNum){ // This outputs the chmod values for a chmod number as an array, including values it should have and subtracting values it should NOT have
  // Example: [ "+ protected","+ peace","- nofploss","- noindications","- noexit","- noenter" ]
  // This kind of array can be fed directly to the sectorSetChmod function.
  var outputArray=[];
  var chmodValuesToGive=decodeChmodNum(newChmodNum);
  var chmodValuesToRemove=getInverseProtectionsArrayFromNum(newChmodNum);
  for (let i=0;i<chmodValuesToGive.length;i++){
    outputArray.push("+ " + chmodValuesToGive[i]);
  }
  for (let e=0;e<chmodValuesToRemove.length;e++){
    outputArray.push("- " + chmodValuesToRemove[e]);
  }
  return outputArray;
};
function getProtectionsDifferentialString(currentProtectNum,newProtectNum){ // The current sector protection number and what the new number should be
  // Returns an array of strings to set and remove needed chmod values based on what the end result should be.
  var currentProtection=decodeChmodNum(currentProtectNum);
  var whatItNeeds=decodeChmodNum(newProtectNum);
  var whatItDoesntNeed=getInverseProtectionsArrayFromArray(whatItNeeds); // These are all the values it should not have
  var whatItNeedsAdded=subArrayFromAnother(currentProtection,whatItNeeds); // This ensures we're only adding what it needs
  var whatItNeedsRemoved=findSameFromTwoArrays(currentProtection,whatItDoesntNeed); // This ensures we're only removing a chmod it already has
  var outputArray=[];
  for (let i=0;i<whatItNeedsAdded.length;i++){
    outputArray.push("+ " + whatItNeedsAdded[i]);
  }
  for (let i=0;i<whatItNeedsRemoved.length;i++){
    outputArray.push("- " + whatItNeedsRemoved[i]);
  }
  return outputArray; // An array of strings, ready for chmodding
};
function getInverseProtectionsArrayFromNum(num){
    var array=decodeChmodNum(num);
    return getInverseProtectionsArrayFromArray(array);
};
function getInverseProtectionsArrayFromArray(arrayToInvert,baseProtectionsArray){ // baseProtectionsArray is optional.  This is used to whittle down based on pre-existing protections, scheduling for removal.
  var arrayToUse=[];
  if (baseProtectionsArray){
    arrayToUse=copyArray(baseProtectionsArray);
  } else {
    arrayToUse=copyArray(regExpHelper.sectorProtections);
  }
  return subArrayFromAnother(arrayToInvert,arrayToUse);
};
function returnEntityUIDList(coordsString,beginFilter,options){
  // TODO: Test to ensure the options for filtering work
  // Example: returnEntityUIDList("2 2 2")
  // Example2: returnEntityUIDList("2 2 2","ENTITY_SHIP_");
  // Example3: returnEntityUIDList("2 2 2","ENTITY_SHIP_",{spawnerFilter:"Benevolent27",lastModifierFilter:"Benevolent27",uidFilter:"TheShip",nameFilter:"TheShipName",factionFilter:"10000",touchedFilter:true});

  var checkSpacialCoords=false;
  var checkIfTouched=false;
  var checkFaction=false;
  var checkSpawner=false;
  var checkLastModifier=false;
  var checkUID=false;
  var checkName=false;
  if (typeof options == "object"){
    if (!objectHelper.isObjEmpty(options)){ // the isObjEmpty EXPECTS an object, so we must first verify the options is an object
      if (options.hasOwnProperty("spawnerFilter")){
        checkSpawner=true;
        var spawnerRegExp=new RegExp("spawner=" + options["spawnerFilter"] + ","); // It MUST end in a , so the filter is looking at the spawner full spawner data.  Partial matches will not be included.
      }
      if (options.hasOwnProperty("lastModifierFilter")){
        checkLastModifier=true;
        var lastModifierRegExp=new RegExp("lastModifier=" + options["lastModifierFilter"] + ",");
      }
      if (options.hasOwnProperty("uidFilter")){
        checkUID=true;
        // TODO: Make it so the UID filter only looks at the name of the UID, not the FULL UID
        var uidRegExp=new RegExp("uid=" + options["uidFilter"] + ",");
      }
      if (options.hasOwnProperty("nameFilter")){
        checkName=true;
        var nameRegExp=new RegExp("realName=" + options["nameFilter"] + ",");
      }
      if (options.hasOwnProperty("factionFilter")){
        checkFaction=true;
        var factionRegExp=new RegExp("faction=" + options["factionFilter"] + ",");
      }
      if (options.hasOwnProperty("touchedFilter")){
        // options here are true/false, so it will only show entities that either were or were not touched
        checkIfTouched=true;
        var touchedRegExp=new RegExp("");
        if (options["touchedFilter"] == true){
          touchedRegExp=new RegExp("touched=true,");
        } else if (options["touchedFilter"] == false){
          touchedRegExp=new RegExp("touched=false,");
        }
      }
      if (options.hasOwnProperty("betweenSpacialCoordsFilter")){
        if (objectHelper.getObjType(options["betweenSpacialCoordsFilter"]) == "Array"){
          if (options["betweenSpacialCoordsFilter"].length == 2){
            checkSpacialCoords=true;
            var spacialCoordsFilterPointAObj=new CoordsObj(options["betweenSpacialCoordsFilter"][0]);
            var spacialCoordsFilterPointBObj=new CoordsObj(options["betweenSpacialCoordsFilter"][1]);
          } else {
            throw new Error("Invalid input given to betweenSpacialCoordsFilter!  Must be an array with two sets of coordinates!");
          }
        } else {
          throw new Error("Invalid input given to betweenSpacialCoordsFilter!  Must be an array!");
        }
      }
      // Note that there is no "type" filter because the "type" is given in two different ways depending on if the sector is loaded, either as a number OR as a name. Like "4" when unloaded and "ship" when loaded.  Instead the main filter is used for this looking at the first part of the UID.
    }
  }
  // TODO: Implement the option filtering.

  // Returns an array of strings of UID's.  Does NOT convert to objects!
  // Returns null if the command failed for some reason.
  // Examples:
  // returnEntityUIDList("2 2 2"); // Returns all entities in the sector
  // returnEntityUIDList("2 2 2","ENTITY_SHIP_"); // Returns only ships in the sector
  // returnEntityUIDList("2 2 2","ENTITY_SHIP_|ENTITY_SPACESTATION_"); // Returns ships and stations in the sector
  if (typeof coordsString == "string"){
    // This will return an array of entities within the sector
    // Todo: Add an option to convert from full UID to hsql uid
    var shipListResults="";
    if (starNetHelper.detectRan(starNetSync("/load_sector_range " + coordsString + " " + coordsString))){ // Load the sector first, otherwise some entities like creatures won't load
      shipListResults=starNetSync("/sector_info " + coordsString);
      if (starNetHelper.detectRan(shipListResults)){
        var resultsArray=shipListResults.split("\n");
        resultsArray.pop(); // Remove "command execution ended" line
        resultsArray.pop(); // Remove the sector info line
        var returnResults=[];
        var shipUID={};
        var theReg=new RegExp("");
        if (typeof beginFilter == "string"){
          theReg=new RegExp("uid=" + beginFilter + "[^,]*");
        } else {
          theReg=new RegExp("uid=[^,]*");
        }
        var proceed=true;
        for (let i=0;i<resultsArray.length;i++){ // If there were any results, cycle through them one by one
          // example: RETURN: [SERVER, DatabaseEntry [uid=ENTITY_SHIP_TopolM_1526337858159, sectorPos=(2, 2, 2), type=5, seed=0, lastModifier=ENTITY_PLAYERSTATE_TopolM, spawner=ENTITY_PLAYERSTATE_TopolM, realName=TopolM_1526337858159, touched=true, faction=0, pos=(121.83931, 271.8866, -1257.7705), minPos=(-2, -2, -2), maxPos=(2, 2, 2), creatorID=0], 0]
          shipUID=resultsArray[i].match(theReg);
          if (shipUID){ // will be null if no match found on this line
            proceed=true;
            if (checkSpawner){
              if (!resultsArray[i].match(spawnerRegExp)){
                proceed=false;
              }
            }
            if (checkLastModifier && proceed){
              if (!resultsArray[i].match(lastModifierRegExp)){
                proceed=false;
              }
            }
            if (checkUID && proceed){
              if (!resultsArray[i].match(uidRegExp)){
                proceed=false;
              }
            }
            if (checkName && proceed){
              if (!resultsArray[i].match(nameRegExp)){
                proceed=false;
              }
            }
            if (checkFaction && proceed){
              if (!resultsArray[i].match(factionRegExp)){
                proceed=false;
              }
            }
            if (checkIfTouched && proceed){
              if (!resultsArray[i].match(touchedRegExp)){
                proceed=false;
              }
            }
            if (checkSpacialCoords && proceed){
              // TODO: Create the function that can compare a set of floating point coordinates against a set
              // Example (loaded and unloaded):
              // pos=(121.83931, 271.8866, -1257.7705) // Can be an E type value, so make sure to convert during the check.
              var posResult=resultsArray[i].match(/pos=[(][0-9, .E-][)]/)
              if (posResult){ // This is redundant, there should ALWAYS be a match, but just in case..
                var posString=posResult[0].replace(/^pos=[(]/,"").replace(/[)]$/,"");
                var posCoordsObj=new CoordsObj(posString); // This converts any E numbers to floating point
                if (!miscHelpers.areCoordsBetween(posCoordsObj,spacialCoordsFilterPointAObj,spacialCoordsFilterPointBObj)){
                    proceed=false;
                }
              } else { // I guess the entity didn't have spacial coords somehow?
                proceed=false;
              }
            }
            if (proceed){
              // If all tests passed, then push the UID
              returnResults.push(shipUID[0].replace(/^uid=/,"")); // Grab the first value from the match object created to get the string. Don't use .toString() because this doesn't work right when using | either/or type regex patterns on the uid filter
            }
          }
        }
        return returnResults;
      } else { // Some kind of error occurred when attempting to get the sector info
        console.error("ERROR: Unable to run starnet command to grab the ship list!");
      }
    }
  }
  return null;
};
function isPlayerAdmin(name,options){
  let thisName=name.toString().toLowerCase();
  let adminList=getAdminsList(options);
  if (adminList){ // If the list was retrieved successfully and there were no admins, it will be an empty array, so this should still be truthy true
    for (let i=0;i<adminList.length;i++){
      if (thisName == adminList[i].toString()){
        return true;
      }
    }
    return false;
  }
  var theError=new Error("Connection failed when attempting to obtain admin list in isPlayerAdmin");
  theError.code=1;
  throw theError;
}

function isPlayerOnline(name,options){ // Expects a string or PlayerObj as input for name.  Returns true if the player is online, false if not.
  var theName=name.toString().toLowerCase();
  var results=getPlayerList(options); // This will be an array of player objects for all online players.  Will be empty if nobody online.
  if (results){ // This should spark even if the player list is empty
    for (var i=0;results.length>i;i++){
      if (results[i].name == theName){
        return true;
      }
    }
    return false;
  }
  // This only happens if there is a connection error when attempting to get the player list.  This is to conform with the standard used elsewhere.
  var theError=new Error("Connection failed when attempting to obtain player list in isPlayerOnline");
  theError.code=1;
  throw theError;
};
function getPlayerList(){ // Returns an array of player objects for all online players or false if the starNet command fails.
  // returns an array of all online players.  The array will be empty if nobody is online.
  try {
    var result=starNetHelper.starNetVerified("/player_list");
    var resultArray=result.trim().split("\n");
    var outputArray=[];
    // RETURN: [SERVER, [PL] Name: Benevolent27, 0]
    var theReg=new RegExp("^RETURN: \\[SERVER, \\[PL\\] Name: ");
    for (let i = 0;i < resultArray.length;i++) {
      if (theReg.test(resultArray[i])){
        outputArray.push(new PlayerObj(resultArray[i].replace(theReg,"").replace(/, 0]$/,"")));
      }
    }
    return outputArray;
  } catch (error){
    console.error("StarNet command failed when attempting to getPlayerList()!");
    return false;
  }
};
function isAccountWhitelisted(account){
  let whitelistedArray=getWhitelistedAccountsList();
  return isWhitelisted(whitelistedArray,account);
}
function isIPWhitelisted(ip){
  let whitelistedArray=getWhitelistedIPList();
  return isWhitelisted(whitelistedArray,ip);
}
function isNameWhitelisted(name){
  var whitelistedArray=getWhitelistedNameList();
  return isWhitelisted(whitelistedArray,name);
}
function isWhitelisted(inputArray,whatToLookFor){
  // accepts input from getWhitelistedAccountsList, getWhitelistedIPList, or getWhitelistedNameList
  var theCheck=whatToLookFor.toString().toLowerCase(); // Allows objects that can be turned into strings to be used as input
  for (let i=0;i<inputArray.length;i++){
    if (inputArray[i].toString() == theCheck){
      return true;
    }
  }
  return false;
}
function getWhitelistedAccountsList(options){ // Returns an array of SMNameObj
  // /list_whitelist_accounts
  // RETURN: [SERVER, Whitelisted: {three, two, one}, 0]
  // .match(/{[^}]*}/);
  try {
    var result=starNetHelper.starNetVerified("/list_whitelist_accounts",options);
    var theReg=new RegExp('^RETURN: \\[SERVER, Whitelisted: {.*');
    var theLine=returnLineMatch(result,theReg,/^RETURN: \[SERVER, Whitelisted: {/,/}, 0\]$/);
    var outputArray=[];
    
    if (theLine){ // this will be empty if there were no results
      var tempArray=theLine.split(", "); // If only 1 result, it will still be in an array
      for (let i=0;i<tempArray.length;i++){
        outputArray.push(new SMNameObj(tempArray[i]));
      }
    }
    return outputArray;
  } catch (error){
    var theError=new Error("StarNet command failed when attempting to getWhitelistedAccountsList()!");
    throw theError;
  }
}
function getWhitelistedIPList(options){
  // /list_whitelist_ip
  // RETURN: [SERVER, Whitelisted: {1.2.3.6, 1.2.3.5, 1.2.3.4}, 0]
  try {
    var result=starNetHelper.starNetVerified("/list_whitelist_ip",options);
    var theReg=new RegExp('^RETURN: \\[SERVER, Whitelisted: {.*');
    var theLine=returnLineMatch(result,theReg,/^RETURN: \[SERVER, Whitelisted: {/,/}, 0\]$/);
    var outputArray=[];
    
    if (theLine){ // this will be empty if there were no results
      var tempArray=theLine.split(", "); // If only 1 result, it will still be in an array
      for (let i=0;i<tempArray.length;i++){
        outputArray.push(new IPObj(tempArray[i]));
      }
    }
    return outputArray;
  } catch (error){
    var theError=new Error("StarNet command failed when attempting to getWhitelistedIPList()!");
    throw theError;
  }
}
function getWhitelistedNameList(options){
  // /list_whitelist_name
  // RETURN: [SERVER, Whitelisted: {six, four, five}, 0]
  try {
    var result=starNetHelper.starNetVerified("/list_whitelist_name",options);
    var theReg=new RegExp('^RETURN: \\[SERVER, Whitelisted: {.*');
    var theLine=returnLineMatch(result,theReg,/^RETURN: \[SERVER, Whitelisted: {/,/}, 0\]$/);
    var outputArray=[];
    
    if (theLine){ // this will be empty if there were no results
      var tempArray=theLine.split(", "); // If only 1 result, it will still be in an array
      for (let i=0;i<tempArray.length;i++){
        outputArray.push(new PlayerObj(tempArray[i]));
      }
    }
    return outputArray;
  } catch (error){
    var theError=new Error("StarNet command failed when attempting to getWhitelistedNameList()!");
    throw theError;
  }
}
function isAccountBanned(account){
  let bannedArray=getBannedAccountsList();
  return isBanned(bannedArray,account);
}
function isIPBanned(ip){
  let bannedArray=getBannedIPList();
  return isBanned(bannedArray,ip);
}
function isNameBanned(name,options,cb){ //cb is optional.  Runs Sync if not given.  Options will be added to allow a "fast" option, which will read from the blacklist.txt file.
  console.log("Running isNameBanned with: "); // temp
  console.log("name: " + name);
  console.log("options: " + options);
  console.log("cb: " + cb);

  if (typeof cb == "function"){ // Run in async mode
    return getBannedNameList(options,function(err,resultArray){
      if (err){
        return cb(err,null); // Could not get Banned name list, so pass on the error
      } else { 
        return cb(null,isBanned(resultArray,name)); // isBanned is a Sync function.
      }
    });
  } else { // run in Sync mode
    var bannedArray=getBannedNameList();
    return isBanned(bannedArray,name);
  }
}
function isBanned(inputArray,whatToLookFor){
  // accepts input from getBannedAccountsList, getBannedIPList, or getBannedNameList
  console.log("inputArray: " + inputArray); // temp
  console.log("whatToLookFor:" + whatToLookFor); // temp
  var theCheck=whatToLookFor.toString().toLowerCase(); // Allows objects that can be turned into strings to be used as input
  for (let i=0;i<inputArray.length;i++){
    console.log("Testing to see if '" + whatToLookFor + "' is equal to the banned name, '" + inputArray[i] +"'.");
    if (inputArray[i].toString() == theCheck){
      return true;
    }
  }
  return false;
}
function getBannedAccountsList(options){ // Returns an array of SMNameObj
  // /list_banned_accounts
  // RETURN: [SERVER, Banned: {three, two, one}, 0]
  // .match(/{[^}]*}/);
  try {
    var result=starNetHelper.starNetVerified("/list_banned_accounts");
    var theReg=new RegExp('^RETURN: \\[SERVER, Banned: {.*');
    var theLine=returnLineMatch(result,theReg,/^RETURN: \[SERVER, Banned: {/,/}, 0\]$/);
    var outputArray=[];
    
    if (theLine){ // this will be empty if there were no results
      var tempArray=theLine.split(", "); // If only 1 result, it will still be in an array
      for (let i=0;i<tempArray.length;i++){
        outputArray.push(new SMNameObj(tempArray[i]));
      }
    }
    return outputArray;
  } catch (error){
    var theError=new Error("StarNet command failed when attempting to getBannedAccountsList()!");
    theError.code=1;
    throw theError;
  }
}
function getBannedIPList(options){
  // /list_banned_ip
  // RETURN: [SERVER, Banned: {1.2.3.6, 1.2.3.5, 1.2.3.4}, 0]
  try {
    var result=starNetHelper.starNetVerified("/list_banned_ip");
    var theReg=new RegExp('^RETURN: \\[SERVER, Banned: {.*');
    var theLine=returnLineMatch(result,theReg,/^RETURN: \[SERVER, Banned: {/,/}, 0\]$/);
    var outputArray=[];
    
    if (theLine){ // this will be empty if there were no results
      var tempArray=theLine.split(", "); // If only 1 result, it will still be in an array
      for (let i=0;i<tempArray.length;i++){
        outputArray.push(new IPObj(tempArray[i]));
      }
    }
    return outputArray;
  } catch (error){
    var theError=new Error("StarNet command failed when attempting to getBannedIPList()!");
    theError.code=1;
    throw theError;
  }
}
function getBannedNameList(options,cb){
  // TODO:  Add {"fast":true} option to read directly from the blacklist.txt file.
  // /list_banned_name
  // RETURN: [SERVER, Banned: {six, four, five}, 0]
  var theReg=new RegExp('^RETURN: \\[SERVER, Banned: {.*');
  var theLine;
  var outputArray=[];
  var tempArray=[];
  if (typeof cb=="function"){
    return starNetVerifiedCB("/list_banned_name","",function(err,result){
      if (err){
        return cb(err,null);
      } else {
        theLine=returnLineMatch(result,theReg,/^RETURN: \[SERVER, Banned: {/,/}, 0\]$/);
        if (theLine){ // this will be empty if there were no results
          tempArray=theLine.split(", "); // If only 1 result, it will still be in an array
          for (let i=0;i<tempArray.length;i++){
            outputArray.push(new PlayerObj(tempArray[i]));
          }
        }
        return cb(null,outputArray); // Will be empty array if no results
      }
    });
  } else {
    try {
      var result=starNetVerified("/list_banned_name");
      theLine=returnLineMatch(result,theReg,/^RETURN: \[SERVER, Banned: {/,/}, 0\]$/);
      if (theLine){ // this will be empty if there were no results
        tempArray=theLine.split(", "); // If only 1 result, it will still be in an array
        for (let i=0;i<tempArray.length;i++){
          outputArray.push(new PlayerObj(tempArray[i]));
        }
      }
      return outputArray;
    } catch (error){
      // var theError=new Error("StarNet command failed when attempting to getBannedNameList()!");
      // theError.code=1;
      // throw theError;
      throw error;
    }
  }
}
function getAdminsList(options){ // Returns an array of PlayerObj, will be an empty array if no admins returned
  // Note: ALWAYS RETURNS NAMES IN LOWERCASE
  // example:
  // RETURN: [SERVER, Admins: {thrace_vega=>thrace_vega, andyp=>andyp, weedle=>weedle, modr4de=>modr4de, melvin=>melvin, build_lonebluewolf=>build_lonebluewolf, arkwulff=>arkwulff, dukeofrealms=>dukeofrealms, borednl=>borednl, mod_lonebluewolf=>mod_lonebluewolf, mod_caribe=>mod_caribe, benevolent27=>benevolent27, pezz=>pezz, lancake=>lancake, nikodaemos=>nikodaemos, char_aznable=>char_aznable, mod_flagitious=>mod_flagitious, arbiter=>arbiter, benevolent37=>benevolent37, nastral=>nastral, benevolent327=>benevolent327}, 0]
  // returns an array of admins.  The array will be empty if there are no admins.
  // options can be {"fast":true}, which will cause this scripting to read from the admins.txt file in the StarMade folder rather than run the command.
  // another option can be {"unrestricted":true}, which will only return admins that have no restrictions - note that this forces reading from the admins.txt file.
  let unrestricted=trueOrFalse(getOption(options,"unrestricted",false));
  let fast=trueOrFalse(getOption(options,"fast",false));
  if (unrestricted){
    fast=true;
  }

  var processArray=[];
  if (fast===true){ // TODO:  Test this
    let adminsTxtFile=path.join(global.starMadeInstallFolder,"admins.txt");
    let adminFileContents=fs.readFileSync(adminsTxtFile,"UTF-8").replace(/\r/g,"");
    var adminFileContentsArray=[];
    if (adminFileContents){
      adminFileContentsArray=adminFileContents.split("\n");
      for (let i=0;i<adminFileContentsArray.length;i++){
        if (adminFileContentsArray[i].trim()){ // Test to see if the line is blank or not.  Only process it if there is text.
          if (unrestricted){ // Only add the playerObj if it is an unrestricted admin
            if (!(/#.*$/).test(adminFileContentsArray[i])){
              processArray.push(new PlayerObj(adminFileContentsArray[i].replace(/#.*$/g,"").trim()));
            }
          } else {
            processArray.push(new PlayerObj(adminFileContentsArray[i].replace(/#.*$/g,"").trim()));
          }
        }
      }
    }
  } else {
    try {
      let result=starNetHelper.starNetVerified("/list_admins");
      // console.log("Results:" + result);
      let theReg=new RegExp("^RETURN: \\[SERVER, Admins: {.*");
      let processLine=returnLineMatch(result,theReg,/^RETURN: \[SERVER, Admins: {/,/}, 0\]$/);
      // console.log("processLine:" + processLine);
      processArray=processLine.split(", ");
      // console.log("### BEFORE");
      // console.dir(processArray);
      for (let i=0;i<processArray.length;i++){
        processArray[i]=new PlayerObj(processArray[i].split("=>")[0]);
      }
    } catch (error){
      throw new Error("StarNet command failed when attempting to getAdmins()!");
    }
    // console.log("### AFTER");
    // console.dir(processArray);
  }
  return processArray;
  // return false;
};

function sendDirectToServer(input,cb){ // if cb not given, functions as Sync. Expects a string input, returning "false" if the input wasn't valid.  This sends a command directly to the console with a return character.
  var theResult;
  var theErr=null;
  if (testIfInput(input)){
    // return global.serverSpawn.stdin.write(input + "\n");
    try {
      theResult=global.serverSpawn.stdin.write(input + "\n");
    } catch (err){
      theErr=err;
    }
    if (typeof cb=="function"){
      return cb(theErr,theResult);
    } else {
      return theResult;
    }
  }
  theErr=new Error("Invalid input given to sendDirectToServer function!");
  if (typeof cb=="function"){
    return cb(theErr,theResult);
  } else {
    return false;
  }
};
// TODO: Create a function that gives a specific protection a value based on the sectorProtections array.
// TODO: Create a function that converts an array of protection names to a total number
