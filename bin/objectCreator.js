
// This script assists with creating all custom object types used by the wrapper.

module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  init, // This is needed so objects can send text directly to the server
  ServerObj,
  // SqlQueryObj, // This cannot be defined here because it comes from a require.  It must be injected AFTER being required.
  EntityObj,
  SectorObj,
  CoordsObj,
  FactionObj,
  MessageObj,
  ChannelObj,
  IPObj,
  SMName,
  SystemObj,
  SpawnObj,
  BluePrintObj,
  RemoteServer: RemoteServerObj,
  LockFileObj,
  PlayerObj
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
module.exports.SqlQueryObj = sqlQuery.SqlQueryObj; // Module injections should occur as quickly as possible to allow circular dependencies to function properly
const starNet              = requireBin("starNet.js");
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
const colorize              = objectHelper["colorize"];
const stripFullUIDtoUID     = regExpHelper["stripFullUIDtoUID"]; // Function that removes text like ENTITY_SHIP_ and ENTITY_PLANET_ from the beginning of a full UID so it can be used to perform SQL queries on UID
const getObjType            = objectHelper.getObjType; // Gets the prototype name of an object, so instead of using "typeof", which returns "object" for things like arrays and SectorObj's, etc, this will return their object name instead.
const SqlQueryObj           = sqlQuery.SqlQueryObj;
const toNum                 = objectHelper.toNumIfPossible;
var sectorProtectionsArray  = regExpHelper.sectorProtections; // This should include all the possible protections a sector can have.
const verifyStarNetResponse = starNetHelper.verifyResponse; // This can be used to perform a verification on a StarMade response without consuming the response
const starNetVerified       = starNetHelper.starNetVerified; // If the response does not verify, this consumes the response and throws an error instead
const copyArray             = objectHelper.copyArray;
const toNumIfPossible       = objectHelper.toNumIfPossible;
const subArrayFromAnother   = objectHelper.subArrayFromAnother;
const findSameFromTwoArrays = objectHelper.findSameFromTwoArrays;

const {testIfInput,trueOrFalse,isTrueOrFalse} = objectHelper;

// Set up prototypes for constructors, such as replacing .toString() functionality with a default value.  Prototypes will not appear as a regular key.
SectorObj.prototype.toString = function(){ return this.coords.toString() };
CoordsObj.prototype.toString = function(){ return this.x.toString() + " " + this.y.toString() + " " + this.z.toString() };
EntityObj.prototype.toString = function(){ return this.fullUID.toString() };
IPObj.prototype.toString = function(){ return this.address };
IPObj.prototype.toArray = function(){ return this.address.split(".") };

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
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- protected");
  console.log("-Protected Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ peace");
  console.log("Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ protected");
  console.log("Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ nofploss");
  console.log("+ nofploss Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noindications");
  console.log("+ noindications Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noexit");
  console.log("+ noexit Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noenter");
  console.log("+ noenter Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noexit");
  console.log("- noexit Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noindications");
  console.log("- noindications Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noenter");
  console.log("- noenter Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- nofploss");
  console.log("- nofploss Result: " + chmodResults);
  starNet("/force_save");
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
  starNet("/load_sector_range 2 2 2 2 2 2");
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
  // starNet("/force_save");
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
var server;  // This is needed so objects can send text to the server directly.  I may add the global object to this as well.
function init(theServer) {
  server=theServer;
}

function ServerObj(configurationName,lockFileObj){
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

}

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
    this.receiver=receiver; // This is only temporary till receiverTypes are broken down
    this.type=receiverType;
    console.error("ERROR: Unknown Receiever type for message! Set receiver and type as string! " + receiverType);
  }
  this.text=message;
}
function ChannelObj(channelName){
  var factionTest=new RegExp("^Faction-{0,1}[0-9]+");
  if (channelName == "all"){
    this.type="global";
  } else if (factionTest.test(channelName)){
    var getFactionNumber=new RegExp("-{0,1}[0-9]+$");

    this.type="faction";
    this.factionNumber=toNumIfPossible(channelName.match(getFactionNumber).toString());
    this.faction=new FactionObj(this.factionNumber);
  } else {
    this.type="named";
  }
  this.name=channelName;
}

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
  this.ban=function(minutes){ return ipBan(this.address,minutes,options) };
  this.unban=function(){ return ipUnBan(this.address,options) };
  // TODO: Add Info Methods:
  // date - This will only be set if the IP is attached to a date somehow, such as when listing all the IP's for a player

  // Action Methods:
  // ban(time) - PERM BAN if no time given, otherwise a temp ban

  // Optional:
  // crawl(Num) - reveals all players who share the same IP.  If a Num is provided, then will crawl that level deep, gathering more IP's and ipcrawling those.
}
function SMName(smName){
  this.name=smName;
  // TODO: Add Info methods:

  // Action methods:
  // ban
  // banTemp(Minutes)

  // Using SQL queries:
  // getNames - Returns an array of PlayerObj's for all the usernames associated with this registry account name
}


function PlayerObj(player){ // "Player" must be a string and can be just the player's nickname or their full UID
  if (player){
    // var playerName=player.replace(/^ENTITY_PLAYERCHARACTER_/,"").replace(/^ENTITY_PLAYERSTATE_/,""); // strip the UID
    this.name=player.replace(/^ENTITY_PLAYERCHARACTER_/,"").replace(/^ENTITY_PLAYERSTATE_/,""); // strip the UID

    this.msg=function (message){
      return sendDirectToServer("/server_message_to plain " + this.name + "'" + message.toString().trim() + "'");
    }
    this.creativeMode=function (input){ // expects true or false as either boolean or string
      if (isTrueOrFalse(input)){
        return sendDirectToServer("/creative_mode " + this.name + input);
      }
      return false;
    }
    this.godMode=function (input){ // expects true or false as either boolean or string
      if (isTrueOrFalse(input)){
        return sendDirectToServer("/god_mode " + this.name + input);
      }
      return false;
    }
    this.invisibilityMode=function (input){ // expects true or false as either boolean or string
      if (isTrueOrFalse(input)){
        return sendDirectToServer("/invisibility_mode " + this.name + input);
      }
      return false;
    }

    // Phase 1 - Add methods which send the command directly to the server.
    // give(ElementNameString,Count) - Gives the player the number of blocks by element name - ONLY WORKS IF THE PLAYER IS ONLINE - Example: player.give("Power",10)
    // giveID(ElementIDNum,Count) - Gives the player the number of blocks by element ID number - ONLY WORKS IF THE PLAYER IS ONLINE- Example: player.giveID(2,10)
    // giveAllItems(Count) - Gives the player all blocks of a certain number
    // giveCategoryItems(Count,categoryNameString) - Gives the player all blocks of a certain number by category
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


    // Phase 1 done - sending directly to console.  Phase 2 incomplete.
    // creativeMode(true/false) - Turns creative mode on or off for the player "/creative_mode player true/false"
    // godMode(true/false) - Sets godmode to true or false for the player using /god_mode
    // invisibilityMode(true/false) - Sets invisibility to true or false for the player using /invisibility_mode


    // TODO: Add Info methods:

    // Example from "/player_info Benevolent27":
    // RETURN: [SERVER, [PL] LOGIN: [time=Thu Apr 26 21:28:51 EDT 2018, ip=/127.0.0.1, starmadeName=], 0] // var myDate=new Date("Thu Apr 26 21:28:51 EDT 2018");   Then to display in local time:  myDate.toLocaleString())  or to grab epoch:  myDate.getTime()
    // RETURN: [SERVER, [PL] LOGIN: [time=Thu Apr 26 21:34:10 EDT 2018, ip=/127.0.0.1, starmadeName=], 0]
    // RETURN: [SERVER, [PL] LOGIN: [time=Thu Apr 26 21:36:20 EDT 2018, ip=/127.0.0.1, starmadeName=], 0]
    // RETURN: [SERVER, [PL] LOGIN: [time=Thu Apr 26 23:18:35 EDT 2018, ip=/127.0.0.1, starmadeName=], 0]
    // RETURN: [SERVER, [PL] LOGIN: [time=Sun Apr 29 00:27:53 EDT 2018, ip=/127.0.0.1, starmadeName=], 0]
    // RETURN: [SERVER, [PL] LOGIN: [time=Thu May 03 04:07:48 EDT 2018, ip=/127.0.0.1, starmadeName=], 0]
    // RETURN: [SERVER, [PL] PERSONAL-TEST-SECTOR: (2147483615, 16, 2147483615), 0]
    // RETURN: [SERVER, [PL] PERSONAL-BATTLE_MODE-SECTOR: (2147483615, 16, 2147483615), 0]
    // RETURN: [SERVER, [PL] CONTROLLING-POS: <not spawned>, 0]
    // RETURN: [SERVER, [PL] CONTROLLING: <not spawned>, 0]
    // RETURN: [SERVER, [PL] SECTOR: (2, 2, 2), 0]
    // RETURN: [SERVER, [PL] FACTION: null, 0]
    // RETURN: [SERVER, [PL] CREDITS: 50000, 0]
    // RETURN: [SERVER, [PL] UPGRADED: false, 0]
    // RETURN: [SERVER, [PL] SM-NAME: null, 0]
    // RETURN: [SERVER, [PL] IP: null, 0]
    // RETURN: [SERVER, [PL] Name: Benevolent27, 0]
    // RETURN: [SERVER, END; Admin command execution ended, 0]

    // smName - returns a SmNameObj
    // ip - returns an IPObj with the player's last IP in it
    // ips - returns an array of IPObj's with all unique IP's.  Also sets the "date" function for each one.
    // faction - Returns the FactionObj of their faction
    // currentEntity - Returns the EntityObj of the entity they are currently in
    // battleModeSector - Returns the player's designated battlemode sector, which is unique to every player

    // Action methods:
    // kill - kills the player using "/kill_character [Name]"
    // kick(reasonString) - kicks the player from the server using /kick or /kick_reason  ReasonString is optional.
    // setFactionRank - Sets the player's rank within their current faction if they are in one.  Example: /faction_mod_member schema 1
    // addAdmin - Adds this player as an admin to the server
    // removeAdmin - Removes this player as an admin to the server
    // addAdminDeniedCommand([One,or,more,commands]) - This can be an array or string.  If an array, it will cycle through the array, adding each denied command for the specific admin
    // removeAdminDeniedCommand([One,or,more,commands]) - This can be an array or string.  If an array, it will cycle through the array, removing each denied command for the specific admin.  Uses: /remove_admin_denied_comand [PlayerName] [CommandToRemove]
    // addToFaction([FactionObj/FactionNum]) -- Switches the player to a specific faction

    // ban(true/false,ReasonString,Time) - true/false is whether to kick.  Time is in minutes.
    // banAccount - Bans the player by their registry account - this is a PERM ban
    // banAccountTemp(NumberInMinutes) - Bans the player by their registry account temporarily
    // banPlayerName - Bans the player by their playername - this is a PERM ban
    // banPlayerNameTemp(NumberInMinutes) - Bans the player by their playername temorarily
    // banIP - Bans the player by IP - PERM BAN - My Notes: Might use "/ban_ip_by_playername [PlayerName]" or "/ban_ip 1.1.1.1" if that is unreliable
    // banIPTemp(NumberInMinutes) - Bans player by IP - Temp - My Notes: Can use "/ban_ip_by_playername_temp [PlayerName] 1" or "/ban_ip_temp 1.1.1.1 1" if that is unreliable

    // changeSector("[X],[Y],[Z]", SectorObj, or CoordsObj) - teleports the player to a specific sector
    // changeSectorCopy("[X],[Y],[Z]", SectorObj, or CoordsObj) - teleports the player to a specific sector, leaving behind a copy of whatever entity they were in, duplicating it

    // factionCreate(NewFactionNameString) - This creates a new faction and sets the player as the leader - I am unsure what the /faction_create command will do if a faction of the same name already exists, but I'm guessing it will just duplicate it.
    // factionCreateAs(NewFactionNameString,FactionNum) - This creates a new faction with a specific faction number and sets the player as the leader - I am unsure what the /faction_create_as command will do if the faction number already exists..


    // giveLook(Count) - Gives the player a number of whatever block they are currently looking at
    // giveSlot(Count) - Gives the player a number of whatever block they have selected on their hotbar
    // giveMetaItem(String) - Gives the player a meta item based on it's name, such as recipe, log_book, helmet, build_prohibiter, etc.

    // protect(smNameString/SMNameObj) - Sets this current player name to be protected under a specific registry account
    // unprotect - This unsets registry protection for this player name - WARNING:  This will allow anyone to log in under this name in the future!

    // serverMessage(MessageString,info/warning/error) - Sends a private message to this specific player.  If no method is specified "plain" is used, which shows up on the player's main chat.

  } else {
    throw new Error("ERROR: No playername provided to playerObj constructor!");
  }
}
function SystemObj(x,y,z){
  this.coords=new CoordsObj(x,y,z);
  // TODO: Add Info methods:
  // center - returns the center set of coordinates as a SectorObj
  // type - returns the system type, so black hole, star, giant, double star, void

  // Action Methods:
  // load - Uses "/load_system x y z" to load the whole system.

  // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
  if (arguments.length > SystemObj.length){
    var extraInfoArray=[];
    for (let i=SystemObj.length-1;i<arguments.length;i++){
      extraInfoArray.push(arguments[i]);
    }
    this.extraInfo=extraInfoArray;
  }
}
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
}
function BluePrintObj(bluePrintName){
  this.name=bluePrintName;
  // Info Methods to add:
  // folder - Gets the path to the folder the blueprint is in

  // Action Methods:
  //
}
function FactionObj(factionNumber){
  this.number=factionNumber;
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
}
function SectorObj(x,y,z){
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

  if (typeof x == "number" && typeof y == "number" && typeof z == "number"){
    this.coords=new CoordsObj(x,y,z);
    this.toArray=function(){ this.coords.toArray() };
    this.load=function(){
      // This returns "true" if the command ran, false for anything else, such as if the server was down.
      let theResponse=starNet("/load_sector_range " + this.coords.toString() + " " + this.coords.toString());
      return starNetHelper.detectRan(theResponse);
    };
    this.setChmod=function(val){ // val should be a string
      // This will return true if it was a success, false otherwise.
      // Example vals:  "+ peace" or "- protected"
      return sectorSetChmod(this.coords,val)
    };
    this.getChmodArray=function(){
      // This really should do a force save before pulling the values.. wish there was a way to do it silently..
      return decodeChmodNum(getChmodNum(this.coords))
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
    }
    this.listEntityUIDs=function(filter,options){
      return returnEntityUIDList(this.coords.toString(),filter,options);
    }
    this.listShipUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"ENTITY_SHIP_");
    }
    this.listStationUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"ENTITY_SPACESTATION_");
    }
    this.listShopUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"ENTITY_SHOP_");
    }
    this.listCreatureUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"ENTITY_CREATURE_");
    }
    this.listAsteroidUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"(ENTITY_FLOATINGROCK_|ENTITY_FLOATINGROCKMANAGED_)");
    }
    this.listPlanetUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"(ENTITY_PLANET_|ENTITY_PLANETCORE_)");
    }
    this.listPlayerUIDs=function(){
      return returnEntityUIDList(this.coords.toString(),"(ENTITY_PLAYERCHARACTER_|ENTITY_PLAYERSTATE_)");
    }
    this.entities=function(filter,options){
      // "filter" is optional, it should look something like this "(ENTITY_SHIP_|ENTITY_CREATURE_)".  This will return all ships and creatures.
      // "options" are simply forwarded to the listEntityUIDs method and are also optional
      var returnArray=[];
      var uidArray=this.listEntityUIDs(filter,options);
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          // Set the correct type of object for each entity in the sector
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
    }
    this.ships=function(){
      var returnArray=[];
      var uidArray=this.listShipUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    }
    this.stations=function(){
      var returnArray=[];
      var uidArray=this.listStationUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    }
    this.shops=function(){
      var returnArray=[];
      var uidArray=this.listShopUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    }
    this.creatures=function(){ // This includes NPC's, spiders, hoppies, or custom creations
      var returnArray=[];
      var uidArray=this.listCreatureUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new CreatureObj(uidArray[i]));
        }
      }
      return returnArray;
    }
    this.asteroids=function(){ // TODO: Consider creating an AsteroidObj as opposed to entity if there are commands that won't work correctly with them
      var returnArray=[];
      var uidArray=this.listAsteroidUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    }
    this.planets=function(){ // TODO: Consider creating an PlanetObj as opposed to entity if there are commands that won't work correctly with them
      var returnArray=[];
      var uidArray=this.listPlanetUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new EntityObj(uidArray[i]));
        }
      }
      return returnArray;
    }
    this.players=function(){
      var returnArray=[];
      var uidArray=this.listPlayerUIDs();
      if (uidArray){ // Will be Null if the StarNet command fails for some reason
        for (let i=0;i<uidArray.length;i++){
          returnArray.push(new PlayerObj(uidArray[i]));
        }
      }
      return returnArray;
    }


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
}
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
      throw new Error("Invalid amount of numbers given as string to CoordsObj(" + tempArray.length + "): " + x);
    }
  } else if (typeof xInput=="object"){ // This handles arrays or other objects
    if (objectHelper.getObjType(xInput) == "Array"){
      if (xInput.length==3){
        xToUse=objectHelper.toNumIfPossible(xInput[0].trim());
        yToUse=objectHelper.toNumIfPossible(xInput[1].trim());
        zToUse=objectHelper.toNumIfPossible(xInput[2].trim());
      } else {
        throw new Error("Invalid number of values given in array to CoordsObj (" + x.length + "): " + x)
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
  this.toArray=function(){ return [this.x, this.y, this.z]; }

  // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
  if (arguments.length > CoordsObj.length){ // the CoordsObj.length gets the number of expected input vars
    var extraInfoArray=[];
    for (let i=CoordsObj.length-1;i<arguments.length;i++){
      extraInfoArray.push(arguments[i]);
    }
    this.extraInfo=extraInfoArray;
  }
  // this.toString=function(){ return this.string };
}

function CreatureObj(fullUID){ // TODO: create creature object
  console.log("Complete me plz.");
  this["UID"]=stripFullUIDtoUID(fullUID);
  this["fullUID"]=fullUID;
}


function EntityObj(fullUID,shipName){
  // This builds an entity object based on the full UID
  // This can be used for ships and stations.  Please use PlanetObj for planets and AsteroidObj for asteroids.

  // the ship name can be used alternatively, but will require a lookup of the UID to then create the object
  let fullUIDToUse=fullUID;
  if (shipName){
    fullUIDToUse=starNetHelper.getUIDfromName(shipName);
  }

  if (fullUIDToUse){
    this["UID"]=stripFullUIDtoUID(fullUIDToUse); // Returns the UID as used with SQL queries, without the "ENTITY_SHIP_" whatever stuff.
    this["fullUID"]=fullUIDToUse;
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

    this["dataMap"]=function(){ return new starNetHelper.ShipInfoUidObj(this.fullUID) };
    this["dataObj"]=function(){ return new starNetHelper.ShipInfoUidObj(this.fullUID,{"objType":"object"}) };


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
}

function RemoteServerObj(ip,domain,port){
  this.ip=new IPObj(ip);
  this.domain=domain;
  this.port=port;
}

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
}

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
}



// Support Functions

function ipBan(ipAddress,minutes){ // minutes are optional.  A perm ban is applied if none provided.
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
}
function ipUnBan(ipAddress,options){ // options are optional and should be an object.
  if (ipAddress){
    var ipToUse=ipAddress.toString(); // This allows ipObj's to be fed in, and this should translate to an ip string.
    console.log("Unbanning IP: " + ipAddress);
    return starNetHelper.detectSuccess2(starNetVerified("/unban_ip " + ipToUse,options)); // This will return false if the ip is not found in the blacklist
  } else {
    throw new Error("No ipAddress given to function, 'ipUnBan'!");
  }
}
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
}
function getChmodNum(sectorObjArrayOrString){
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
}
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
}
function sectorSetChmod(coordsObj,stringOrArray){ // val can be a string or an array of strings
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
    return starNetHelper.detectSuccess(starNet(theCommand));
  } else if (theType == "Array"){
    var resultsArray=[];
    for (let i=0;i<stringOrArray.length;i++){
      let theSubType=objectHelper.getObjType(stringOrArray[i]);
      if (theSubType == "string"){
        let theValLower=stringOrArray[i].toLowerCase();
        resultsArray.push(starNetHelper.detectSuccess(starNet("/sector_chmod " + coordsObj.toString() + " " + theValLower)));
      } else {
        resultsArray.push(false);
      }
    }
    return resultsArray;
  } else {
    return new Error("Invalid sector chmod value given!");
  }
}
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
}
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
}
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
}
function getInverseProtectionsArrayFromNum(num){
    var array=decodeChmodNum(num);
    return getInverseProtectionsArrayFromArray(array);
}
function getInverseProtectionsArrayFromArray(arrayToInvert,baseProtectionsArray){ // baseProtectionsArray is optional.  This is used to whittle down based on pre-existing protections, scheduling for removal.
  var arrayToUse=[];
  if (baseProtectionsArray){
    arrayToUse=copyArray(baseProtectionsArray);
  } else {
    arrayToUse=copyArray(regExpHelper.sectorProtections);
  }
  return subArrayFromAnother(arrayToInvert,arrayToUse);
}

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
    if (starNetHelper.detectRan(starNet("/load_sector_range " + coordsString + " " + coordsString))){ // Load the sector first, otherwise some entities like creatures won't load
      shipListResults=starNet("/sector_info " + coordsString);
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
}

function sendDirectToServer(input){ // Expects a string input, returning "false" if the input wasn't valid.  This sends a command directly to the console with a return character.
  if (testIfInput(input)){
    return server.stdin.write(input + "\n");
  }
  return false;
}
// TODO: Create a function that gives a specific protection a value based on the sectorProtections array.
// TODO: Create a function that converts an array of protection names to a total number
