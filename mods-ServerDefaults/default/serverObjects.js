// TODO:  Refactor this to initialize the bin scripts correctly

// #########################
// ####  SERVER OBJECTS ####
// #########################

// This script assists with creating all custom object types used by the server.

// TODO: Look into how a mod might extend the object types here, for use with squish/unsquish
// TODO: Make "MineObj"
// TODO: Make "FleetObj"

// Some reading:
// Callback standard used:  http://fredkschott.com/post/2014/03/understanding-error-first-callbacks-in-node-js/

if (__filename == require.main.filename) {
  console.log("This script should not be ran by itself!  Exiting..");
  process.exit();
}

module.exports = { // Always put module.exports at the top so circular dependencies work correctly.
  // init, // This is needed so objects can send text directly to the server
  BlueprintObj,
  BotObj,
  ChannelObj,
  CoordsObj,
  EntityObj,
  FactionObj,
  IPObj,
  LocationObj,
  MessageObj,
  PlayerObj,
  SectorObj,
  SMNameObj,
  SystemObj,
  decodeChmodNum,
  isPlayerOnline,
  getPlayerList,
  getAdminsList,
  getProtectionsDifferentialString,
  getChmodArrayFromNum,
  squish,
  unSquish,
  isSquishable
}

// Requires
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
class Event extends EventEmitter {};
const prompt = global["prompt"]; // This creates sync prompts and can have auto-complete capabilties.
// const events               = require('events');
const mainFolder = path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself for testing purposes.
const binFolder = path.join(mainFolder, "bin");
const spawn = require('child_process').spawn;
const http = require('http');
const miscHelpers = require(path.join(binFolder, "miscHelpers.js"));
const {requireBin} = miscHelpers;
const sqlQueryJs = requireBin("sqlQuery.js");
// SqlQueryObj is not in the module.exports above because it cannot be defined till after sqlQuery.js is required.
module.exports.SqlQueryObj = sqlQueryJs.SqlQueryObj; // Module injections should occur as quickly as possible to allow circular dependencies to function properly
const objectHelper = requireBin("objectHelper.js");
const regExpHelper = requireBin("regExpHelper.js");
const ini = requireBin("iniHelper.js");
var setSettings = requireBin("setSettings.js"); // This will confirm the settings.json file is created and the install folder is set up.
const installAndRequire = requireBin("installAndRequire.js");
const sleep = requireBin("mySleep.js").softSleep;
const sleepSync = global["sleepSync"];
const sleepPromise = requireBin("mySleep.js").sleepPromise;

const modBinFolder = path.join(__dirname, "bin");
// TODO: Fix below, since these require being loaded with a server object.
const starNet = require(path.join(modBinFolder, "starNet.js")); // This self-initializes now

// NPM installable requires
const treeKill = installAndRequire('tree-kill', '^1.2.1'); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes
const isInvalidPath = installAndRequire("is-invalid-path", '^1.0.2'); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
const exitHook = installAndRequire('exit-hook', '2.2.0'); // https://github.com/sindresorhus/exit-hook Handles normal shutdowns, sigterm, sigint, and a "message=shutdown" event.  Good for ensuring the server gets shutdown.
const fsExtra = installAndRequire("fs-extra", "^8.1.0");

// Aliases for requires - These are set up for readability
const stripFullUIDtoUID = regExpHelper["stripFullUIDtoUID"]; // Function that removes text like ENTITY_SHIP_ and ENTITY_PLANET_ from the beginning of a full UID so it can be used to perform SQL queries on UID
var sectorProtectionsArray = regExpHelper.sectorProtections; // This should include all the possible protections a sector can have.
// const verifyStarNetResponse = starNet.verifyResponse; // This can be used to perform a verification on a StarNet response without consuming the response
// const starNetVerified       = starNetVerified; // If the response does not verify, this consumes the response and throws an error instead
const {
  sqlQuery,
  SqlQueryObj,
  simpleSqlQuery
} = sqlQueryJs;
const {
  verifyStarNetResponse,
  starNetVerified,
  starNetVerifiedCB,
  returnMatchingLinesAsArray,
  checkForLine,
  mapifyShipInfoUIDString
} = starNet;
const {
  copyArray,
  toNumIfPossible,
  toStringIfPossible,
  subArrayFromAnother,
  findSameFromTwoArrays,
  isInArray
} = objectHelper;
const {
  testIfInput,
  trueOrFalse,
  isTrueOrFalse,
  isNum,
  colorize,
  getObjType,
  returnLineMatch,
  applyFunctionToArray,
  simplePromisifyIt,
  toTrueOrFalseIfPossible
} = objectHelper;
const {
  isTrue,
  isFalse,
  getOption,
  addOption,
  getParamNames,
  getRandomAlphaNumericString,
  arrayMinus,
  addUniqueToArray
} = objectHelper;
const toNum = objectHelper.toNumIfPossible;
const {
  areCoordsBetween,
  isPidAlive,
  ensureFolderExists,
  existsAndIsDirectory,
  existsAndIsFile,
  isSeen,
  writeJSONFileSync
} = miscHelpers;
const smInstallHelpers = requireBin("smInstallHelpers.js");

// Set up prototypes
BlueprintObj.prototype.toString = function () {
  return this.name
};
BotObj.prototype.toString = function () {
  return this.name
};
ChannelObj.prototype.toString = function () {
  return this.name
};
CoordsObj.prototype.toString = function () {
  return this.x.toString() + " " + this.y.toString() + " " + this.z.toString()
};
CoordsObj.prototype.toArray = function () {
  return [this.x, this.y, this.z];
}
CreatureObj.prototype.toString = function () {
  return this.fullUID.toString()
};
EntityObj.prototype.toString = function () {
  return this.fullUID.toString()
};
FactionObj.prototype.toString = function () {
  return toStringIfPossible(this.number)
};
IPObj.prototype.toString = function () {
  return this.address
};
IPObj.prototype.toArray = function () {
  return this.address.split(".")
};
LocationObj.prototype.toString = function (options) {
  // default is to return the sector.toString(), spacial can be given instead by specifying options as {"type":"spacial"}
  let valToReturnType = getOption(options, "type", "sector").toLowerCase();
  if (valToReturnType == "sector") {
    return this.sector.toString();
  } else if (valToReturnType == "spacial") {
    return this.spacial.toString();
  }
  throw new Error("Invalid option given to LocationObj.toString()!");
};
LocationObj.prototype.toArray = function (options) {
  // default is to return an array of objects, but an array of strings is an option with {"type":"string"}
  let valToReturnType = getOption(options, "type", "objects").toLowerCase();
  if (valToReturnType == "objects") {
    return [this.sector, this.spacial];
  } else if (valToReturnType == "string") {
    return [this.sector.toString(), this.spacial.toString()];
  }
  throw new Error("Invalid option given to LocationObj.toArray()!");
};
MessageObj.prototype.toString = function () {
  return this.text
};
PlayerObj.prototype.toString = function () {
  return this.name
}; // This allows inputs for functions to use a playerObj or string easily.  Example:  playerObj.toString() works the same as playerString.toString(), resulting in a string of the player's name.
SectorObj.prototype.toString = function () {
  return this.coords.toString()
};
SectorObj.prototype.toArray = function () {
  return this.coords.toArray()
};
SMNameObj.prototype.toString = function () {
  return this.name
};
SystemObj.prototype.toString = function () {
  return this.coords.toString()
};

// ###############
// #### START ####
// ###############
var installObj=global.getInstallObj(__dirname);
var {event,settings,console,log,installPath}=installObj;
var serverObj = {};
event.on("start", function (theServerObj) { // This event only happens AFTER the serverObj has been created
  serverObj=theServerObj; // Get the serverObj up and running
  // if (serverObj !== null) { // Only do stuff IF there is a server object, otherwise do nothing.
  //   // Set up prototypes for constructors, such as replacing .toString() functionality with a default value.  Prototypes will not appear as a regular key.

  //   // Actually, I don't see any reason to register the constructors this way.  They are needed by the ServerObj, so I'll just load em in there.
  //   // Register the constructors
  //   // serverObj.regConstructor(SquishedObj);
  //   // serverObj.regConstructor(BotObj);
  //   // serverObj.regConstructor(MessageObj);
  //   // serverObj.regConstructor(ChannelObj);
  //   // serverObj.regConstructor(IPObj);
  //   // serverObj.regConstructor(SMNameObj);
  //   // serverObj.regConstructor(PlayerObj);
  //   // serverObj.regConstructor(SystemObj);
  //   // serverObj.regConstructor(BlueprintObj);
  //   // serverObj.regConstructor(FactionObj);
  //   // serverObj.regConstructor(LocationObj);
  //   // serverObj.regConstructor(SectorObj);
  //   // serverObj.regConstructor(CoordsObj);
  //   // serverObj.regConstructor(CreatureObj);
  //   // serverObj.regConstructor(EntityObj);
  //   }
});


function showResponseCallback(error, output) { // This is a helper function for testing purposes.  It shows any error or output when it's used as a callback function.
  if (error) {
    console.error("Error: " + error.toString());
  }
  if (output) {
    console.log("output: ");
    console.dir(output);
  }
}

//  #################
//  ###  SQUISH  ####
//  #################
//  This allows "squishing" an object into a smaller object, JSON.stringifying it, 
//  storing it to the hard drive, retrieving it, and then recreating the original object.
//  It will preserve any additional elements added.
//  It requires strict adherence to recreation of the object.  The parameters needed
//  should be stored into the object as they are given, or the values must be able to be converted
//  back to acceptable input by running a function on the value.  
//  TODO:  Convert objects to be compatible with squish


// Squishy code start
SquishedObj.prototype.unSquish = function (options) { // options are optional
  return unSquish(this, options);
}

function squishyElemIsAnythingBut(input) {
  var objTypeName = "squishedFromObjectType";
  var objCreationArrayName = "theSquishObjCreationArray";
  if (input != objTypeName && input != objCreationArrayName) {
    return true;
  }
  return false;
}

function isSquishable(inputObj) {
  if (typeof inputObj == "object") {
    var inputObjName = inputObj.constructor.name;
    // console.log("inputObjName: " + inputObjName);
    // console.log("typeof inputObjName: " + typeof inputObjName);
    if (typeof inputObjName == "string" && inputObjName !== "") {
      // console.log("Seeing if module.exports.hasOwnProperty(" + inputObjName + ")");
      if (module.exports.hasOwnProperty(inputObjName)) {
        if (inputObjName[0].match(/^[A-Z]+/)) { // Must have a capitalized letter as the first letter.
          // It is a registered object type, but can it be successfully squished and unsquished?
          try {
            var squishedObj = squish(inputObj);
          } catch (err) {
            // console.log("Could not squish!",err);
            return false;
          }
          try {
            var unSquishedObj = unSquish(squishedObj);
          } catch (err) {
            // console.log("Could not unsquish!",err);
            return false;
          }
          // console.log("Made it to checking of objects are equivalent..");
          return objectHelper.areObjsEquivalent(inputObj, unSquishedObj); // Does the squished/unsquished object equal the original?
        }
      }
    }
  }
  return false;
}

function squish(inputObj, options) { // The purpose of this is to minify an object to be recreated back later
  // TODO:  Make this recursive so it will support nested objects, such as with MessageObj nesting PlayerObj as sender, etc.
  console.log("Squishing object..");
  // Get the parameters needed to create the function:

  var objType = inputObj.constructor.name;
  // var objType=inputObj.name;

  // var objCreationString=inputObj.toString();
  console.log("Object type: " + objType);
  // var theConstructor=eval(inputObj.constructor.name); // temp.  Works fine with natively registered constructors from this script but not from registered.
  // Cannot use "new", must instead use the module.exports[objType]

  if (module.exports.hasOwnProperty(objType)) {
    var theConstructor = module.exports[objType];
    var paramsNameArray = getParamNames(theConstructor);
    console.log("Parameters: " + paramsNameArray);

    // Instead of using the input parameters to look up values from the object,
    // we can specify which ones to use, but the results MUST be able to be used
    // as parameters to create the object.
    // For example:  MyObj(first,second,third,fourth);
    // If the object created by this Constructor has a "1st" value, we can provide
    // that as the map.
    // example:  squish(myObj,{"elements":["1st","2nd","3rd","4th"]})
    // This then looks up myObj["1st"] to use later as input to "first"
    // Even if a parameter will be empty, it must be provided.

    var iterableParams = getOption(options, "elements", paramsNameArray);
    var iterableFuncs = getOption(options, "preProcess", []); // This is used to process any value retrieved to a value that can then be used to recreate the object
    console.log("Using iterable params: " + iterableParams);
    if (Array.isArray(iterableParams)) {
      if (iterableParams.length == paramsNameArray.length) {
        var theArgArray = [];
        var paramName;
        for (let i = 0;i < paramsNameArray.length;i++) {
          paramName = iterableParams[i];
          if (typeof iterableFuncs[i] == "function") {
            theArgArray.push(iterableFuncs[i](inputObj[paramName]));
          } else {
            theArgArray.push(inputObj[paramName]);
          }

        }
        console.log("Returning squished object..");
        return new SquishedObj(inputObj, objType, theArgArray);
      } else {
        throw new Error("ERROR: elements array MUST be the same length as the input parameters required by the input Constructor!");
      }
    } else {
      throw new Error("Invalid input given as 'elements' option!  Expects an array!");
    }
  } else {
    throw new Error("Invalid object type given to squish!  Please register the constructor for that object type!");
  }

};

function unSquish(squishedObj, options) {
  // console.log("Unsquishing object..");
  var squishedFromObjectType = squishedObj["squishedFromObjectType"];
  // console.log("squishedFromObjectType: " + squishedFromObjectType); // temp
  var theSquishObjCreationArray = squishedObj["theSquishObjCreationArray"];
  var iterableFuncs = getOption(options, "preProcess", []); // This is used to process any value retrieved to a value that can then be used to recreate the object
  for (let i = 0;i < iterableFuncs.length;i++) {
    if (typeof iterableFuncs[i] == "function") {
      // if it's a function, run the function on the value from the array to transform it and replace it.
      theSquishObjCreationArray[i] = iterableFuncs[i](theSquishObjCreationArray[i]);
    }
  }
  // var outputObj=Reflect.construct(eval(squishedFromObjectType),theSquishObjCreationArray);
  var outputObj = new module.exports[squishedFromObjectType](...theSquishObjCreationArray);
  for (var property in squishedObj) { // recreate any non-prototypes
    if (squishedObj.hasOwnProperty(property)) {
      if (squishyElemIsAnythingBut(property)) {
        outputObj[property] = squishedObj[property];
      }
    }
  }
  return outputObj;
};

function SquishedObj(inputObj, objType, objCreationArray) { // Change this to take an array of strings
  var self = this;
  this["squishedFromObjectType"] = objType;
  self["theSquishObjCreationArray"] = objCreationArray;
  if (typeof inputObj == "object" && typeof objType == "string" && Array.isArray(objCreationArray)) {
    // var compareToObj=Reflect.construct(eval(objType),objCreationArray);
    // Rather than constructing using reflect, we can simply call the function and look at the output
    // console.log("objType: " + objType);
    // console.log("objCreationArray:");
    // console.dir(objCreationArray);

    var compareToObj = new module.exports[objType](...objCreationArray);
    // console.log("compareToObj:"); // temp
    // console.dir(compareToObj); // temp

    for (var property in inputObj) {
      if (inputObj.hasOwnProperty(property)) { // I don't want to save prototypes
        if (!compareToObj.hasOwnProperty(property)) {
          // The element is something not present in the default object type, so let's store it
          self[property] = inputObj[property];
        }
      }
    }
    // Object should now be squished!
  } else {
    throw new Error("Invalid input given to SquishedObj!");
  }
}


async function getSuperAdminPassword(starMadeFolder) { // This will grab the superadmin password, setting it up and enabling it if not already.
  // TODO: Offload this to a require
  // Load the server.cfg from install path
  var serverCfgFile = path.join(starMadeFolder, "StarMade", "server.cfg");
  var serverCfgObj = ini.getFileAsObj(serverCfgFile);
  var superAdminPassword = ini.getVal(serverCfgObj, "SUPER_ADMIN_PASSWORD");
  var superAdminPasswordEnabled = ini.getVal(serverCfgObj, "SUPER_ADMIN_PASSWORD_USE");
  if (typeof superAdminPasswordEnabled == "string") { // Only perform .toLowerCase() if the value exists to avoid crashing the script.
    superAdminPasswordEnabled = superAdminPasswordEnabled.toLowerCase();
  }
  if (superAdminPassword == "mypassword" || !superAdminPassword) { // "mypassword" is the default value upon install.  We do not want to keep this since it'd be a major security vulnerability.
    console.log("\nThe 'SuperAdminPassword' has not been set up yet!  This is needed for StarNet.jar to connect to the server.");
    console.log("You can set a custom alphanumeric password OR just press [ENTER] to have a long, randomized one set for you. (Recommended)")
    let newSuperAdminPassword = "";
    do {
      newSuperAdminPassword = prompt("New SuperAdminPassword: ");
    }
    while (!(newSuperAdminPassword === null || newSuperAdminPassword == "" || regExpHelper.isAlphaNumeric(newSuperAdminPassword))) // If a person puts invalid characters in, it'll just keep repeating the prompt.
    if (newSuperAdminPassword === null || newSuperAdminPassword == "") {
      console.log("Excellent choice!  I have set a LONG and nearly impossible to crack SuperAdminPassword for you! :D");
      newSuperAdminPassword = getRandomAlphaNumericString(32);
    } else {
      console.log("Alrighty then.  I'll just use what you provided!")
    };
    // await sleepSync(2000); // I don't know why a pause is needed here
    ini.setVal(serverCfgObj, "SUPER_ADMIN_PASSWORD", newSuperAdminPassword);
    if (superAdminPasswordEnabled == "false") {
      console.log("Super Admin Password was disabled, enabling!");
      // serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"],"true");
      ini.setVal(serverCfgObj, "SUPER_ADMIN_PASSWORD_USE", "true");
    }
    ini.writeObjToFile(serverCfgObj, serverCfgFile);
  } else if (superAdminPasswordEnabled != "true") { // Enable super admin password if it was disabled for some reason.
    console.log("Super Admin Password was disabled, enabling!");
    // serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"],"true");
    ini.setVal(serverCfgObj, "SUPER_ADMIN_PASSWORD_USE", "true");
    ini.writeObjToFile(serverCfgObj, serverCfgFile);
  }
  return ini.getVal(serverCfgObj, "SUPER_ADMIN_PASSWORD");
}

function BotObj(name) { // cb/promises/squishy compliant 
  var self = this;
  this.name = toStringIfPossible(name); // This is to allow other objects that can be converted to a string to be used, such as mimicking a player's name, but will return an error if it cannot be turned into a string.
  if (typeof self.name != "string") {
    throw new Error("Invalid botName given to new BotObj!");
  }
  this.starMadeFolder = serverObj.starMadeFolder; // This is needed to recreate the server object if needed after squishing the object

  this.msg = function (player, msgString, options, cb) { // This expects a player object OR a string with a player's name, then the message to send, either as a string or an object that can be converted to a string with .toString()
    if (typeof cb == "function") {
      var theMessage = toStringIfPossible(msgString); // This allows certain objects that can be converted to strings to be used, such as matches or other objects
      if (typeof theMessage == "string") {
        try {
          var thePlayer = new PlayerObj(player); // This creates a new playerObj with the playername string or PlayerObj
        } catch (err) {
          console.log("ERROR:  Invalid input given to BotObj as 'player'!");
          return cb(err, null);
        }
        return thePlayer.msg("[" + this.name + "]: " + theMessage, options, cb); // Any options PlayerObj.msg can take will be forwarded to it.
      } else {
        return cb(new Error("Error with BotObj.msg command.  Invalid input given to message player with!"), null); // Could not send message, so both error and false.
      }
    } else {
      return simplePromisifyIt(self.msg, options, player, msgString);
    }
  }
  this.serverMsg = function (msgString, options, cb) { // This expects the message to send either as a string or an object that can be converted to a string
    if (typeof cb == "function") {
      var theMessage = toStringIfPossible(msgString); // This allows certain objects that can be converted to strings to be used, such as matches or other objects
      if (typeof theMessage == "string") {
        return serverObj.msg("[" + this.name + "]: " + theMessage, options, cb); // options are forwarded to server.msg
      } else {
        return cb(new Error("Invalid message given to BotObj.serverMsg as 'msgString'!"), null);
      }
    } else {
      return simplePromisifyIt(self.serverMsg, options, msgString);
    }
  }
};

function MessageObj(senderString, receiverString, receiverTypeString, text) { // cb/promises compliant, not squishy compliant because of nested objects.  Squishy must be recursive first.
  // Takes string values and converts to strings or objects of the correct types
  this.senderString = senderString;
  this.receiverString = receiverString;
  this.receiverTypeString = receiverTypeString;
  this.text = text;

  this.sender = new PlayerObj(senderString); // This should ALWAYS be a player sending a message
  if (receiverTypeString == "DIRECT") { // This is a private message sent from one player to another
    this.type = "private";
    this.receiver = new PlayerObj(receiverString);
  } else if (receiverTypeString == "CHANNEL") {
    this.type = "channel";
    this.receiver = new ChannelObj(receiverString);
  } else { // This should never happen, but hey maybe in the future they'll expand on the receiverTypes
    this.receiver = receiverString; // This is a string, which is no bueno, and is only temporary till receiverTypes are broken down
    this.type = receiverTypeString;
    console.error("ERROR: Unknown Receiever type for message! Set receiver and type as string! " + receiverTypeString);
  }
};

function ChannelObj(name) { // cb/promises/squishy compliant
  this.name = name;
  var factionTest = new RegExp("^Faction-{0,1}[0-9]+");
  if (name == "all") {
    this.type = "global";
  } else if (factionTest.test(name)) {
    var getFactionNumberReg = new RegExp("-{0,1}[0-9]+$");
    this.type = "faction";
    var factionNumber = toNumIfPossible(name.match(getFactionNumberReg));
    if (testIfInput(factionNumber)) {
      this.factionNumber = factionNumber.toString();
    }
    if (testIfInput(this.factionNumber)) {
      this.faction = new FactionObj(this.factionNumber);
    }
  } else {
    this.type = "named";
  }
};

function IPObj(address, date) { // cb/promises/squish compliant
  // Example:  var myIPObj = new IpObj("192.0.0.100",Date.now());
  // ipAddressString should look something like "7.7.7.7"
  // date can be a string that "new Date()" can turn into an object or can be a Date object.  It's easier to debug if you create the date object yourself and then pass it here, so if there are any issues, the stack trace will point to the place where the bad string is attempted to be converted to a Date object.
  // Options is optional and should be an object, which is passed to subcommands.  Right now only {debug:true} is supported.
  var self = this;
  this.address = address;
  if (typeof date != "undefined") { // We're using typeof because we don't want to do a truthy assessment
    var possibleDate = createDateObjIfPossible(date); // Returns false if no information given or invalid information.  Returns a date object if given a date object.
    if (possibleDate instanceof Date) {
      self.date = possibleDate;
    } else {
      console.error("Unable to use date information given when creating new IpObj for IP, " + address + "! Invalid date information: " + date);
    }
  }
  // TODO:  Redo this section to standardize with the same options given as the PlayerObj
  this.ban = function (minutes, options, cb) {
    if (typeof cb == "function") {
      return ipBan(self.address, minutes, options, cb);
    } else {
      return simplePromisifyIt(self.ban, options, minutes);
    }
  };
  this.unban = function (options, cb) {
    if (typeof cb == "function") {
      return ipUnBan(self.address, options, cb)
    } else {
      return simplePromisifyIt(self.unban, options);
    }
  };

  this.isBanned = function (options, cb) {
    if (typeof cb == "function") {
      return isIPBanned(self.address, options, cb);
    } else {
      return simplePromisifyIt(self.isBanned, options);
    }
  }
  this.ipWhitelist = function (minutes, options, cb) { // minutes is optional.  Permanent whitelist if not specified.
    if (typeof cb == "function") {
      return ipWhitelist(self.address, minutes, options, cb);
    } else {
      return simplePromisifyIt(self.ipWhitelist, options, minutes);
    }
  };
  this.isWhitelisted = function (options, cb) {
    if (typeof cb == "function") {
      return isIPWhitelisted(self.address, options, cb);
    } else {
      return simplePromisifyIt(self.isWhitelisted, options);
    }
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

function SMNameObj(name) { // cb/promises/squish compliant
  var self = this;
  this.name = name;
  // TODO:

  // TO TEST:
  // ban(time,options) // /ban_account Benevolent27
  // isBanned()
  // isWhitelisted()

  // DONE:
  // getNames - Returns an array of PlayerObj's for all the usernames associated with this registry account name
  this.isBanned = function (options, cb) { // Returns true or false depending on whether it is banned or not
    if (typeof cb == "function") {
      return isAccountBanned(self.name, options, cb);
    } else {
      return simplePromisifyIt(self.isBanned, options);
    }
  }
  this.isWhitelisted = function (options, cb) {
    if (typeof cb == "function") {
      return isAccountWhitelisted(self.name, options, cb);
    } else {
      return simplePromisifyIt(self.isWhitelisted, options);
    }
  }
  this.ban = function (timeToBan, options, cb) { // timeToBan is optional.  If no number given, it will be a perm ban.  Options can be {"fast":true}
    if (typeof cb == "function") {
      var theTimeToUse = toNumIfPossible(timeToBan);
      if (typeof theTimeToUse == "number") { // temp ban
        console.log("Banning player account, '" + self.name + "', for " + theTimeToUse + " minutes.");
        return runSimpleCommand("/ban_account_temp " + self.name, options + " " + theTimeToUse, cb);
      } else if (testIfInput(timeToBan)) {
        return cb(new Error("Invalid input given to SMNameObj.ban as 'timeToBan'!"), null);
      } else { // permban
        console.log("Banning player account: " + self.name);
        return runSimpleCommand("/ban_account " + self.name, options, cb);
      }
    } else {
      return simplePromisifyIt(self.ban, options, timeToBan);
    }
  }
  this.whitelist = function (timeToWhitelist, options, cb) { // timeToWhitelist is optional.  If no number given, it will be a perm whitelist.  Options can be {"fast":true}
    if (typeof cb == "function") {
      var theTimeToUse = toNumIfPossible(timeToWhitelist);
      if (typeof theTimeToUse == "number") { // temp whitelist
        console.log("Whitelisting player account, '" + self.name + "', for " + theTimeToUse + " minutes.");
        return runSimpleCommand("/whitelist_account_temp " + self.name, options + " " + theTimeToUse, cb);
      } else if (testIfInput(timeToWhitelist)) {
        return cb(new Error("Invalid input given to SMNameObj.whitelist as 'timeToWhitelist'!"), null);
      } else { // permban
        console.log("Whitelisting player account: " + self.name);
        return runSimpleCommand("/whitelist_account " + self.name, options, cb);
      }
    } else {
      return simplePromisifyIt(self.whitelist, options, timeToWhitelist);
    }
  }
  this.getNames = function (options, cb) { // Returns an array of PlayerObj's for all the usernames associated with this registry account name
    if (typeof cb == "function") {
      var theSmNameToUse = self.name; // The sql db is actually case sensitive.

      return sqlQuery("SELECT NAME FROM PUBLIC.PLAYERS WHERE STARMADE_NAME='" + theSmNameToUse + "'", options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        console.dir(result); // Temp
        var outputArray = [];
        if (!result.error) { // This will be false if there was no error
          for (let i = 0;i < result.objArray.length;i++) {
            outputArray.push(new PlayerObj(result.objArray[i].NAME));
          }
        }
        return cb(null, outputArray);
      });
    } else {
      return simplePromisifyIt(self.getNames, options);
    }
  }
};


function PlayerObj(name) { // cb/promises/squish compliant // "Player" must be a string and can be just the player's nickname or their full UID
  var thePlayer = toStringIfPossible(name); // This allows other PlayerObj to be used as input.
  if (typeof thePlayer == "string") {
    var self = this; // this is needed to reference the "this" of functions in other contexts, particularly for creating promises via the outside function.  If "this" is used, the promisify function will not work correctly.
    var playerName = thePlayer.trim();
    // var playerName=player.replace(/^ENTITY_PLAYERCHARACTER_/,"").replace(/^ENTITY_PLAYERSTATE_/,""); // strip the UID
    this.name = playerName.replace(/^ENTITY_PLAYERCHARACTER_/, "").replace(/^ENTITY_PLAYERSTATE_/, ""); // strip the UID
    this.msg = function (message, options, cb) {
      // Sends a message to the player.  "plain" type by default.  {"type":info/warn/error/plain} <-pick one.
      // if no cb is given, this will return a promise.
      // The return result will be true or false depending on success or failure.
      // An error is thrown if failed connection. 
      if (typeof cb == "function") {
        var msgType = getOption(options, "type", "plain").toLowerCase(); // This does not throw an error if invalid options are specified.
        var msgToUse = toStringIfPossible(message);
        if (typeof msgToUse == "string") {
          return runSimpleCommand("/server_message_to " + msgType + " " + self.name + "'" + message.toString().trim() + "'", options, cb);
        } else {
          return cb(new Error("Invalid message given to PlayerObj.msg!"), Boolean(false));
        }
      } else {
        return simplePromisifyIt(self.msg, options, message);
      }
    }
    this.botMsg = function (message, options, cb) { // cb is optional, runs as Sync if not given.  Sends a plain message to the player with the bot's name.
      if (typeof cb == "function") {
        var messageToSend = toStringIfPossible(message);
        if (!testIfInput(messageToSend) || messageToSend == "" || typeof messageToSend == "undefined") {
          messageToSend = " "; // If empty, let's assume they meant to send an empty line.
        }
        if (typeof messageToSend != "string") { // Some kind of object that could not convert to a string was provided
          return cb(new Error("Invalid input given to PlayerObj.botMsg!"), null);
        }
        return serverObj.bot.msg(self.name, messageToSend, options, cb); // This should throw an error if there is a problem connecting to the server
      } else {
        return simplePromisifyIt(self.botMsg, options, message);
      }
    }
    this.creativeMode = function (input, options, cb) { // expects true or false as either boolean or string
      if (typeof cb == "function") {
        if (isTrueOrFalse(input)) {
          return runSimpleCommand("/creative_mode " + self.name + " " + input, options, cb);
        }
        return cb(new Error("Invalid input given to PlayerObj.creativeMode!  Expects true or false!"), null);
      } else {
        return simplePromisifyIt(self.creativeMode, options, input);
      }
    }
    this.godMode = function (input, options, cb) { // expects true or false as either boolean or string
      if (typeof cb == "function") {
        if (isTrueOrFalse(input)) {
          return runSimpleCommand("/god_mode " + self.name + " " + input, options, cb);
        }
        return cb(new Error("Invalid input given to PlayerObj.godMode!  Expects true or false!"), null);
      }
      return simplePromisifyIt(self.godMode, options, input);
    }
    this.invisibilityMode = function (input, options, cb) { // expects true or false as either boolean or string
      if (typeof cb == "function") {
        if (isTrueOrFalse(input)) {
          return runSimpleCommand("/invisibility_mode " + self.name + " " + input, options, cb);
        }
        return cb(new Error("Invalid input given to PlayerObj.invisibilityMode! Expects true or false!"), null);
      }
      return simplePromisifyIt(self.invisibilityMode, options, input);
    }
    self.setInfiniteInventoryVolume = function (input, options, cb) { // expects true or false as either boolean or string
      if (typeof cb == "function") {
        if (isTrueOrFalse(input)) {
          return runSimpleCommand("/set_infinite_inventory_volume " + self.name + " " + input, options, cb);
        }
        return cb(new Error("Invalid input given to PlayerObj.setInfiniteInventoryVolume! Expects true or false!"), null);
      }
      return simplePromisifyIt(self.setInfiniteInventoryVolume, options, input);
    }
    this.isBanned = function (options, cb) {
      if (typeof cb == "function") {
        return isNameBanned(self.name, options, cb);
      }
      return simplePromisifyIt(self.isBanned, options);
    }
    self.isWhitelisted = function (options) {
      if (typeof cb == "function") {
        return isNameWhitelisted(self.name, options);
      }
      return simplePromisifyIt(self.isWhitelisted, options);
    }
    self.factionPointProtect = function (input, options, cb) { // expects true or false as either boolean or string
      if (typeof cb == "function") {
        return runSimpleCommand("/faction_point_protect_player " + self.name + " " + input, options, cb);
      }
      return simplePromisifyIt(self.factionPointProtect, options, input);
    }
    self.give = function (input, number, options, cb) { // expects an element name and number of items to give
      if (typeof cb == "function") {
        return runSimpleCommand("/give " + self.name + " " + input + " " + number, options, cb);
      }
      return simplePromisifyIt(self.give, options, input, number);
    }
    self.giveId = function (inputNumber, number, options, cb) { // expects an element id and number of items to give
      if (typeof cb == "function") {
        return runSimpleCommand("/giveid " + self.name + " " + inputNumber + " " + number, options, cb);
      }
      return simplePromisifyIt(self.giveId, options, inputNumber, number);
    }
    self.giveAllItems = function (number, options, cb) { // expects an element name and number of items to give
      if (typeof cb == "function") {
        return runSimpleCommand("/give_all_items " + self.name + " " + number, options, cb);
      }
      return simplePromisifyIt(self.giveAllItems, options, number);
    }
    self.giveCategoryItems = function (category, number, options, cb) { // expects a category such as terrain/ship/station and number of items to give
      if (typeof cb == "function") {
        return runSimpleCommand("/give_category_items " + self.name + " " + number + " " + category, options, cb);
      }
      return simplePromisifyIt(self.giveCategoryItems, options, category, number);
    }
    self.giveCredits = function (number, options, cb) { // expects a number of credits to give.  If this value is negative, it will subtract credits.
      if (typeof cb == "function") {
        return runSimpleCommand("/give_credits " + self.name + " " + number, options, cb);
      }
      return simplePromisifyIt(self.giveCredits, options, number);
    }
    self.giveGrapple = function (options, cb) { // number is optional.  If more than 1, then it will loop through giving 1 at a time.  Be careful with this since these items do not stack.
      // Unfortunately, with using callback functions, it's just not a good idea to allow more than 1 to be given.  Each command needs to have it's own error handling.
      // var theNum=toNumIfPossible(number);
      // var countTo=1; // The default times to run the command is 1
      // var result;
      // if (typeof theNum == "number"){ // Only use the input given if it is a number, otherwise ignore it.
      //   if (number>1){ countTo=theNum; }
      // }
      // for (var i=0;countTo>i;i++){
      //   result=runSimpleCommand("/give_grapple_item " + self.name,options,cb);
      // }
      // return result;
      if (typeof cb == "function") {
        return runSimpleCommand("/give_grapple_item " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveGrapple, options);
    }
    self.giveGrappleOP = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_grapple_item_op " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveGrappleOP, options);
    }
    self.giveHealWeapon = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_heal_weapon " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveHealWeapon, options);
    }
    self.giveLaserWeapon = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_laser_weapon " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveLaserWeapon, options);
    }
    self.giveLaserWeaponOP = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_laser_weapon_op " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveLaserWeaponOP, options);
    }
    self.giveMarkerWeapon = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_marker_weapon " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveMarkerWeapon, options);
    }
    self.giveTransporterMarkerWeapon = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_transporter_marker_weapon " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveTransporterMarkerWeapon, options);
    }
    self.givePowerSupplyWeapon = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_power_supply_weapon " + self.name, options, cb);
      }
      return simplePromisifyIt(self.givePowerSupplyWeapon, options);
    }
    self.giveRocketLauncher = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_rocket_launcher_weapon " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveRocketLauncher, options);
    }
    self.giveRocketLauncherOP = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_rocket_launcher_op " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveRocketLauncherOP, options);
    }
    self.giveSniperWeapon = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_sniper_weapon " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveSniperWeapon, options);
    }
    self.giveSniperWeaponOP = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_sniper_weapon_op " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveSniperWeaponOP, options);
    }
    self.giveTorchWeapon = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_torch_weapon " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveTorchWeapon, options);
    }
    self.giveTorchWeaponOP = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/give_torch_weapon_op " + self.name, options, cb);
      }
      return simplePromisifyIt(self.giveTorchWeaponOP, options);
    }
    self.kill = function (options, cb) { // kills the player
      if (typeof cb == "function") {
        return runSimpleCommand("/kill_character " + self.name, options, cb);
      }
      return simplePromisifyIt(self.kill, options);
    }
    self.kick = function (reason, options, cb) { // Reason is optional.  Note that since reason is optional, this will always return true.
      if (typeof cb == "function") {
        if (testIfInput(reason)) {
          // return sendDirectToServer("/kick_reason " + self.name + "'" + reason.toString().trim() + "'");
          return runSimpleCommand("/kick_reason " + self.name + "'" + reason.toString().trim() + "'", options, cb);
        } else {
          // return sendDirectToServer("/kick " + self.name);
          return runSimpleCommand("/kick " + self.name, options, cb);
        }
      }
      return simplePromisifyIt(self.kick, options, reason);
    }
    self.setFactionRank = function (number, options, cb) { // expects a number 1-5.  5 is founder, 1 is lowest rank.
      if (typeof cb == "function") {
        if (isNum(number)) {
          if (number >= 1 && number <= 5) {
            return runSimpleCommand("/faction_mod_member " + self.name + " " + number, options, cb);
          }
          return cb(new Error("Invalid number given to PlayerObj.setFactionRank as number!  Needs to be between 1 and 5!"), null);
        }
        return cb(new Error("Invalid value given to PlayerObj.setFactionRank as number!"), null);
      }
      return simplePromisifyIt(self.setFactionRank, options, number);
    }
    self.deleteFromFaction = function (options, cb) {
      // WARNING: Will leave an empty faction behind if no members left!
      // This might be what you want if you plan on adding them later, but if not, then you'll want to
      // check their prior faction member count and delete it if empty.
      if (typeof cb == "function") {
        console.debug("Looking up faction..");
        return self.faction(options, function (err, result) {
          if (err) {
            return cb(err, null);
          }
          var theFactionString = toStringIfPossible(result);
          var theFactionNum = toNumIfPossible(theFactionString);
          console.debug("faction number found: " + theFactionNum);
          if (typeof theFactionNum == "number" && theFactionNum) { // If faction number is 0, this will be falsey
            console.debug("Sending the del command..");
            return runSimpleCommand("/faction_del_member " + self.name + " " + theFactionNum, options, function (err, result) {
              if (err) {
                console.debug("Encountered an error sending the command!");
                return cb(err, result);
              }
              console.debug("looks like the command succeeded!");
              return cb(null, result); // should be true if the command succeeded.  False if they are not in a faction.
            });
          } else {
            // the player does not appear to be in a faction, so why bother trying?
            return cb(null, false); // this is to indicate the command failed.
          }
        });
      }
      return simplePromisifyIt(self.deleteFromFaction, options);
    }
    self.joinFaction = function (theFaction, options, cb) { // Allows FactionObj or number as input
      // WARNING: Might leave an empty faction behind if no members left!
      // This might be what you want if you plan on adding them later, but if not, then you'll want to
      // check their prior faction member count and delete it if empty.
      if (typeof cb == "function") {
        var theFactionString = toStringIfPossible(theFaction);
        var theFactionNum = toNumIfPossible(theFactionString);
        if (typeof theFactionNum == "number") { // Any number is valid, even 0, though that will do nothing.
          return runSimpleCommand("/faction_join_id " + self.name + " " + theFactionNum, options, function (err, result) {
            if (err) {
              return cb(err, result);
            }
            if (result) {
              // IMPORTANT:  The faction MUST exist before joining the player to it, otherwise the command will fail.
              // However, even if the command fails, there is no error message, so it will appear to have succeeded.
              // An ".exists()" command should be ran on the FactionObj returned before acting on it!
              return cb(null, new FactionObj(theFactionNum));
            } else {
              return cb(null, Boolean(false)); // join failed for some reason.
            }

          });
        } else { // invalid input given as theFactionNum
          return cb(new Error("Invalid input given to PlayerObj.joinFaction as theFaction!"), null);
        }
      }
      return simplePromisifyIt(self.joinFaction, options, theFaction);
    }

    self.suspendFromFaction = function (options, cb) { // Temporarily removes the player from their faction
      if (typeof cb == "function") {
        return runSimpleCommand("/player_suspend_faction " + self.name, options, cb);
      }
      return simplePromisifyIt(self.suspendFromFaction, options);
    }
    self.unsuspendFromFaction = function (options, cb) { // Returns the player to their prior faction
      if (typeof cb == "function") {
        return runSimpleCommand("/player_unsuspend_faction " + self.name, options, cb);
      }
      return simplePromisifyIt(self.unsuspendFromFaction, options);
    }

    self.kickPlayerOutOfEntity = function (options, cb) { // Kicks a player out of the entity they are currently in
      if (typeof cb == "function") {
        return runSimpleCommand("/kick_player_name_out_of_entity " + self.name, options, cb);
      }
      return simplePromisifyIt(self.kickPlayerOutOfEntity, options);
    }

    self.putPlayerIntoEntity = function (entity, options, cb) { // Returns the EntityObj if successful, otherwise false.
      if (typeof cb == "function") {
        var theEntityString = toStringIfPossible(entity);
        if (typeof theFactionNum == "string") { // Any number is valid, even 0, though that will do nothing.
          return runSimpleCommand("/player_put_into_entity_uid " + self.name + " '" + theEntityString + "'", options, function (err, result) {
            if (err) {
              return cb(err, result);
            }
            if (result) { // Returns an EntityObj of the entity the player was put into
              return cb(null, new EntityObj(theEntityString));
            } else {
              return cb(null, Boolean(false)); // failed
            }

          });
        } else { // invalid input given as theFactionNum
          return cb(new Error("Invalid input given to PlayerObj.joinFaction as theFaction!"), null);
        }
      }
      return simplePromisifyIt(self.putPlayerIntoEntity, options, entity);
    }

    self.tint = function (red, green, blue, alpha, options, cb) { // expects float values to denote percentages
      if (typeof cb == "function") {
        var theRed = toNumIfPossible(red);
        var theGreen = toNumIfPossible(green);
        var theBlue = toNumIfPossible(blue);
        var theAlpha = toNumIfPossible(alpha);
        if (typeof theRed == "number" && typeof theGreen == "number" && typeof theBlue == "number" && typeof theAlpha == "number") {
          return runSimpleCommand("/tint_name " + theRed + " " + theGreen + " " + theBlue + " " + theAlpha + " " + self.name, options, cb);
        }
        return cb(new Error("Invalid input given to PlayerObj.tint! Expects red, green, blue, and alpha as float numbers!"), null);
      }
      return simplePromisifyIt(self.tint, options, red, green, blue, alpha);
    }


    self.addAdmin = function (options, cb) { // Adds the player as an admin
      // this gives a warning if player does not exist on the server, so runSimpleCommand will not work
      // TODO: I need separate text processing for this:
      // RETURN: [SERVER, [ADMIN COMMAND] [WARNING] 'sdflkjdsf' is NOT online. Please make sure you have the correct name. Name was still added to admin list, 0]
      // When successful, no specific message returned.
      // return sendDirectToServer("/add_admin " + self.name);
      if (typeof cb == "function") {
        return runSimpleCommand("/add_admin " + self.name, options, cb);
        // Since this will add a player that is even offline, there is no check to ensure the name is a valid one and so this will not return false if the player is offline either.
      }
      return simplePromisifyIt(self.addAdmin, options);
    }
    self.removeAdmin = function (options, cb) { // Removes the player as an admin
      if (typeof cb == "function") {
        return runSimpleCommand("/remove_admin " + self.name, options, cb);
      }
      return simplePromisifyIt(self.removeAdmin, options);
    }
    self.addAdminDeniedCommand = function (command, options, cb) { // Adds denied commands for an admin, input can be an array of commands to deny.  It will cycle through them all.
      if (typeof cb == "function") {
        // I need to disable the multi-functionality to separate out potential errors

        // // Note:  This does not check to ensure the command actually exists.
        // var returnVal=true;
        // var result;
        // if (typeof commandOrCommands == "object"){ // An array is an object typeof
        //   if (commandOrCommands instanceof Array){ // This is how you figure out it is an array.  We cannot do this directly, because if it is not an object, this will throw an error.
        //     if (commandOrCommands.length){ // This is to make sure it isn't an empty array
        //       for (var i=0;i<commandOrCommands.length;i++){
        //         // result=sendDirectToServer("/add_admin_denied_comand " + self.name + " " + commandOrCommands[i]);
        //         result=runSimpleCommand("/add_admin_denied_comand " + self.name + " " + commandOrCommands[i],options,cb);
        //         if (result===false){ returnVal=false; } // This works as a latch, so that if ANY of the commands fail, it returns false
        //       }
        //       return returnVal; // This will return false if ANY of the inputs failed.
        //     } else {
        //       return false;
        //     }
        //   }
        //   return false; // This handles if an object of another type was given, which would be invalid.
        // } else if (testIfInput(commandOrCommands)){ // This would trigger for strings or numbers.
        //   // return sendDirectToServer("/add_admin_denied_comand " + self.name + " " + commandOrCommands);
        return runSimpleCommand("/add_admin_denied_comand " + self.name + " " + command, options, cb);
        // }
        // return false; // This should never happen.
      }
      return simplePromisifyIt(self.addAdminDeniedCommand, options, command);
    }
    self.removeAdminDeniedCommand = function (command, options, cb) { // Adds denied commands for an admin, input can be an array of commands to deny.  It will cycle through them all.
      if (typeof cb == "function") {
        // Note:  This cannot check to ensure the command being denied actually exists.
        return runSimpleCommand("/remove_admin_denied_comand " + self.name + " " + command, options, cb);
      }
      return simplePromisifyIt(self.removeAdminDeniedCommand, options, command);
    }
    this.listAdminDeniedCommands = function (options, cb) { // Returns an array of all forbidden commands for the admin
      if (typeof cb == "function") {
        console.log("Unfinished.");
        return starNetVerified("/list_admin_denied_commands " + self.name, options, function (err, result) {
          if (err) {
            return cb(err, null);
          }
          // RETURN: [SERVER, Denied Commands for weedle:, 0]
          // RETURN: [SERVER, ban, 0]
          // RETURN: [SERVER, END; Admin command execution ended, 0]

          // RETURN: [SERVER, Player benevolent27 has no denied commands, 0]
          // RETURN: [SERVER, END; Admin command execution ended, 0]
          var outputArray = [];
          if (checkForLine(result, /^RETURN: \[SERVER, Denied Commands.*/)) {
            var theArray = result.trim().split("\n");
            var theMatch;
            for (let i = 1;i < theArray.length - 1;i++) { // Skip the first and last line
              theMatch = theArray[i].match(/(?<=^RETURN: \[SERVER, )[^,]+/);
              if (theMatch) {
                outputArray.push(theMatch.toString());
              }
            }
          }
          return cb(null, outputArray); // If no denied commands, this will be an empty array
        });
      }
      return simplePromisifyIt(self.listAdminDeniedCommands, options);
    }
    self.unban = function (options, cb) {
      if (typeof cb == "function") {
        return runSimpleCommand("/unban_name " + self.name, options, cb);
        // Note that this does not unban their ip or smname
      }
      return simplePromisifyIt(self.unban, options);
    }
    self.ban = function (toKick, reason, time, options, cb) { // No value is mandatory, but toKick will be true by default if not specified.  toKick should be true/false. Time is in minutes.
      // Note that a player MUST BE ONLINE in order for the kick to work.
      // Note that no reason is given to the player if they are not kicked.
      // Also note that this ban does not apear to actually work.  It will kick the player, but then they can just rejoin.  An IP ban or ban via SMNameObj will actually be effective.
      // If options are specified, the other values can be ""
      if (typeof cb == "function") {
        console.log("Banning player: " + self.name);
        // return sendDirectToServer("/ban " + self.name + " " + toKick + " '" + reason.toString().trim() + "' " + time);
        var banArray = [];
        banArray.push("/ban");
        banArray.push(self.name);
        if (isTrueOrFalse(toKick)) {
          banArray.push(toKick);
        } else {
          banArray.push(true); // By default the command will kick the player. But this will lead to "false" being returned if they are offline
        }
        if (testIfInput(reason)) {
          banArray.push("'" + reason + "'");
        } else {
          banArray.push("''");
        }
        if (isNum(time)) {
          banArray.push(time);
        }
        var banString = banArray.join(" ");
        console.log("Banning player with string: " + banString);
        return runSimpleCommand(banString, options, cb);
      }
      return simplePromisifyIt(self.ban, options, toKick, reason, time);
    }
    self.whitelist = function (timeToWhitelist, options, cb) { // timeToWhitelist is optional.  If no number given, it will be a perm whitelist.  Options can be {"fast":true}
      if (typeof cb == "function") {
        var theTimeToUse = toNumIfPossible(timeToWhitelist);
        if (typeof theTimeToUse == "number") { // temp whitelist
          return runSimpleCommand("/whitelist_name_temp " + self.name, options + " " + theTimeToUse, cb);
        } else if (testIfInput(timeToWhitelist)) {
          return cb(new Error("Invalid input given to PlayerObj.whitelist as 'timeToWhitelist'!"), null);
        } else { // permawhitelist
          return runSimpleCommand("/whitelist_name " + self.name, options, cb);
        }
      } else {
        return simplePromisifyIt(self.whitelist, options, timeToWhitelist);
      }
    }
    self.giveMetaItem = function (metaItem, options, cb) {
      // EXAMPLE: /give_metaitem schema blueprint, recipe, log_book, helmet, build_prohibiter, flash_light, virtual_blueprint, block_storage, laser, heal, power_supply, marker, rocket_launcher, sniper_rifle, grapple, torch, transporter_marker
      // Note:  The primary usage for this is for log_book, helmet, and build_prohibiter
      if (typeof cb == "function") {
        return runSimpleCommand("/give_metaitem " + self.name + " " + metaItem.toString().trim(), options, cb);
      }
      return simplePromisifyIt(self.giveMetaItem, options, metaItem);
    }
    self.isOnline = function (options, cb) {
      if (typeof cb == "function") {
        return isPlayerOnline(self.name, options, cb);
      }; // Conforms to the standard of throwing an error on connection error, but gives false if player is offline.  There is no error for a failure of command since this should never happen.
      return simplePromisifyIt(self.isOnline, options);
    }
    self.isAdmin = function (options, cb) {
      if (typeof cb == "function") {
        return isPlayerAdmin(self.name, options, cb);
      }
      return simplePromisifyIt(self.isAdmin, options);
    }
    self.spawnLocation = function (options, cb) { // Returns a LocationObj of the player's spawn coordinates, but can only be successful if the player is online.  Will return false if offline.
      if (typeof cb == "function") {
        return getPlayerSpawnLocation(self.name, options, cb);
      }
      return simplePromisifyIt(self.spawnLocation, options);
    }
    self.setSpawnLocation = function (location, coordsObj, options, cb) { // Needs sector and spacial coords.  coordsObj is needed if a SectorObj is given as first parameter.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      if (typeof cb == "function") {
        var sectorToUse = location;
        var spacialToUse = coordsObj;
        if (typeof location == "object") {
          if (location instanceof LocationObj) {
            if (location.hasOwnProperty("spacial") && location.hasOwnProperty("sector")) { // This handles LocationObj types given.  This will lead to the coordsObj being ignored if given.
              spacialToUse = location.spacial.toString();
              sectorToUse = location.sector.toString();
            } else {
              return cb(new Error("Invalid LocationObj given to setSpawnLocation!"), null); // This is redundant and should never happen.
            }
          } else if ((location instanceof SectorObj || location instanceof CoordsObj) && (coordsObj instanceof CoordsObj)) {
            sectorToUse = location.toString();
            spacialToUse = coordsObj.toString();
          } else { // Invalid objects or objects given as input.
            return cb(new Error("Invalid object types given to setSpawnLocation!"), null);
          }
        }
        if (testIfInput(sectorToUse) && testIfInput(spacialToUse)) { // Two inputs given
          // Let's see if coordinates can be made from the input.  String, Array, or object can be given with coordinates.
          try {
            sectorToUse = new CoordsObj(location).toString();
            spacialToUse = new CoordsObj(coordsObj).toString();
          } catch (error) { // Invalid input given.
            return cb(new Error("Invalid input given to PlayerObj.setSpawnLocation!"), null);
          }
        } else { // Invalid amount of arguments given
          return cb(new Error("Invalid number of parameters given to setSpawnLocation!"), null);
        }
        if (typeof spacialToUse == "string" && typeof sectorToUse == "string") { // This is redundant, an error should have been thrown by now if there was a problem.
          // We should be all set to send the command now.
          var fast = getOption(options, "fast", false);
          var setSpawnLocationCommand = "/player_set_spawn_to " + self.name + " " + sectorToUse + " " + spacialToUse;
          if (fast) {
            return sendDirectToServer(setSpawnLocationCommand, cb);
          } else {
            return starNetVerified(setSpawnLocationCommand, options, function (err, result) { // TODO: Check if I should be returning starNetVerified or not.
              console.log("using starnet verified to set the spawn location.  In objectCreator.js");
              if (err) {
                return cb(err, result);
              } else {
                // Success: RETURN: [SERVER, [ADMINCOMMAND][SPAWN][SUCCESS] set spawn of player PlS[Benevolent27 ; id(2)(1)f(10002)] to sector (1000, 1000, 1000); local position: (0.0, 0.0, 0.0), 0]
                // Fail: RETURN: [SERVER, [ADMINCOMMAND][SPAWN] Player not found, 0]
                let theReg = new RegExp("^RETURN: \\[SERVER, \\[ADMINCOMMAND\\]\\[SPAWN\\]\\[SUCCESS\\]");
                return cb(null, checkForLine(result, theReg));
              }
            });
          }
        }
        return cb(new Error("Invalid parameters given to playerObj setSpawnLocation method!"), null);
      } else {
        return simplePromisifyIt(self.setSpawnLocation, options, location, coordsObj);
      }
    }
    self.changeSector = function (sector, options, cb) { // sector can be a LocationObj, SectorObj, CoordsObj, or other input that can be translated to a CoordsObj.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      if (typeof cb == "function") {
        try {
          var sectorToUse = new CoordsObj(sector).toString();
        } catch (error) { // Invalid input given.
          console.error("ERROR: Invalid input given to PlayerObj.changeSector!");
          return cb(error, null);
        }
        if (typeof sectorToUse == "string") {
          var fast = getOption(options, "fast", false);
          var changeSectorCommand = "/change_sector_for " + self.name + " " + sectorToUse;
          if (fast) {
            return sendDirectToServer(changeSectorCommand, cb);
          } else {
            return starNetVerified(serverObj, changeSectorCommand, options, function (err, result) { // TODO: Test this.  I don't know if I should be returning this or just running it?
              if (err) {
                return cb(err, result);
              } else {
                // Success: RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] changed sector for Benevolent27 to (1000, 1000, 1000), 0]
                // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client Benevolent27, 0]
                let theReg = new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[SUCCESS\\]");
                return cb(null, checkForLine(result, theReg)); // returns true or false
              }
            });
          }
        }
        return cb(new Error("Invalid parameters given to playerObj changeSector method!"), null);
      } else {
        return simplePromisifyIt(self.changeSector, options, sector);
      }
    }
    self.changeSectorCopy = function (sector, options, cb) { // sector can be a LocationObj, SectorObj, CoordsObj, or other input that can be translated to a CoordsObj.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      if (typeof cb == "function") {
        try {
          var sectorToUse = new CoordsObj(sector).toString();
        } catch (error) { // Invalid input given.
          console.error("ERROR: Invalid input given to PlayerObj.changeSectorCopy!");
          return cb(error, null);
        }
        if (typeof sectorToUse == "string") {
          // We should be all set to send the command now.
          var fast = getOption(options, "fast", false);
          var changeSectorCommand = "/change_sector_for_copy " + self.name + " " + sectorToUse;
          if (fast) {
            return sendDirectToServer(changeSectorCommand, cb);
          } else {
            return starNetVerified(serverObj, changeSectorCommand, options, function (err, result) { // TODO: Test this.  I don't know if I should be returning this or just running it?
              if (err) {
                return cb(err, result);
              } else {
                // Success: RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] changed sector for Benevolent27 to (1000, 1000, 1000), 0]
                // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client Benevolent27, 0]
                let theReg = new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[SUCCESS\\]");
                return cb(null, checkForLine(result, theReg)); // returns true or false
              }
            });
          }
        }
        return cb(new Error("Invalid parameters given to playerObj changeSector method!"), null);
      } else {
        return simplePromisifyIt(self.changeSectorCopy, options, sector);
      }
    }
    self.teleportTo = function (coords, options, cb) { // Needs sector and spacial coords.  coordsObj is needed if a SectorObj is given as first parameter.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      if (typeof cb == "function") {
        var spacialCoordsToUse = coords;
        if (typeof coords == "object") {
          if (coords instanceof LocationObj) {
            if (coords.hasOwnProperty("spacial")) { // This handles LocationObj objects
              spacialCoordsToUse = coords.spacial;
            } else {
              return cb(new Error("Invalid LocationObj given to teleportTo!"), null);
            }
          } else if (coords instanceof CoordsObj) {
            spacialCoordsToUse = coords.toString();
          } else { // Invalid objects or objects given as input.
            return cb(new Error("Invalid object type given to teleportTo!"), null);
          }
        } else if (testIfInput(coords)) { // Input given
          // Let's see if coordinates can be made from the input.  A String (separated by , or spaces) or an Array can be given as input.
          try {
            spacialCoordsToUse = new CoordsObj(coords).toString();
          } catch (error) { // Invalid input given.
            console.error("Invalid input given to teleportTo!");
            return cb(error, null);
          }
        } else { // Invalid amount of arguments given
          return cb(new Error("No spacial coords given teleportTo!"), null);
        }
        if (typeof spacialCoordsToUse == "string") {
          // We should be all set to send the command now.
          var fast = getOption(options, "fast", false);
          var teleportToCommand = "/teleport_to " + self.name + " " + spacialCoordsToUse;
          if (fast) {
            return sendDirectToServer(teleportToCommand, cb);
          } else {
            return starNetVerified(serverObj, teleportToCommand, options, function (err, result) {
              if (err) {
                return cb(err, result);
              } else {
                // Success: RETURN: [SERVER, [ADMIN COMMAND] teleported Benevolent27 to , 0]
                // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client, 0]
                let theReg = new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] teleported");
                return cb(null, checkForLine(result, theReg));
              }
            });
          }
        }
        return cb(new Error("Invalid parameters given to playerObj teleportTo method!"), null);
      } else {
        return simplePromisifyIt(self.teleportTo, options, coords);
      }
    }
    self.info = function (options, cb) {
      // This returns whatever accurate info it can from the /player_info command.
      // It does not currently return the entity the player is in, because the /player_info command does not give the UID of asteroids nor planet planets  TODO:  Change this behavior if/when Schema implements
      if (typeof cb == "function") {
        var returnObj = {};
        return starNetVerified(serverObj, "/player_info " + self.name, options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          if (!returnLineMatch(result, /^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)) { // Player exists
            if (!returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: <not spawned>/)) { // Player online
              // These values can only be obtained when the player is online
              // returnObj["controlling"]=self.controlling(result); // self.controlling does not exist yet.
              returnObj["sector"] = new SectorObj(returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] SECTOR: \(.*/, /^RETURN: \[SERVER, \[PL\] SECTOR: \(/, /\), 0]$/).split(", "));
              returnObj["spacialCoords"] = new CoordsObj(returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: \(.*/, /^RETURN: \[SERVER, \[PL\] CONTROLLING-POS: \(/, /\), 0]$/).split(", "));
              returnObj["upgraded"] = trueOrFalse(returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] UPGRADED: .*/, /^RETURN: \[SERVER, \[PL\] UPGRADED: /, /, 0\]$/));
              returnObj["smName"] = new SMNameObj(returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] SM-NAME: .*/, /^RETURN: \[SERVER, \[PL\] SM-NAME: /, /, 0\]$/));
              returnObj["ip"] = new IPObj(returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] IP: \/.*/, /^RETURN: \[SERVER, \[PL\] IP: \//, /, 0\]$/));
            }
            // These are always accurate, even if a player is offline
            returnObj["personalTestSector"] = new SectorObj(returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] PERSONAL-TEST-SECTOR: \(.*/, /^RETURN: \[SERVER, \[PL\] PERSONAL-TEST-SECTOR: \(/, /\), 0]$/).split(", "));
            returnObj["credits"] = Number(returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] CREDITS: .*/, /^RETURN: \[SERVER, \[PL\] CREDITS: /, /, 0\]$/));
            var factionLine = returnLineMatch(result, /^RETURN: \[SERVER, \[PL\] FACTION: Faction \[.*/, /^RETURN: \[SERVER, \[PL\] FACTION: Faction \[/); // If the person is not in a faction, this will be undefined.
            // TODO:  Test below.  If the person is not in a faction, will it be undefined?  Or throw an error?
            // This needs to return undefined if not in a faction
            if (factionLine) {
              returnObj["faction"] = new FactionObj(factionLine.match(/^id=[-]{0,1}[0-9]+/).toString().replace(/^id=/, ""));
            } else {
              returnObj["faction"] = null; // Player was not in a faction
            }
            return cb(null, returnObj);
          }
          return cb(null, false); // Even if the player is offline, this should not happen.
        });
      } else {
        return simplePromisifyIt(self.info, options);
      }
    }
    self.sector = function (options, cb) { // Returns a player's sector if online, false if offline.
      var valToLookFor = "sector";
      if (typeof cb == "function") {
        return returnValFromPlayerInfo(self.info, valToLookFor, options, cb);
        // return self.info(options,function(err,result) {
        //   if (err){
        //     return cb(err,null)
        //   }
        //   if (result.hasOwnProperty(valToLookFor)){
        //     return cb(null,result[valToLookFor]);
        //   }
        //   return cb(null,Boolean(false));
        // })
      } else {
        return simplePromisifyIt(self[valToLookFor], options);
      }
    }
    self.system = function (options, cb) {
      if (typeof cb == "function") {
        return self.sector(options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          return cb(null, result.system);
        });
      }
      return simplePromisifyIt(self.system, options);
    }
    self.spacialCoords = function (options, cb) { // Returns a player's personal sector, whether online or offline.
      var valToLookFor = "spacialCoords";
      if (typeof cb == "function") {
        return returnValFromPlayerInfo(self.info, valToLookFor, options, cb);
      } else {
        return simplePromisifyIt(self[valToLookFor], options);
      }
    }
    self.upgraded = function (options, cb) { // Returns a whether a player's registry account was purchased or not.  Returns false if the player is offline.
      var valToLookFor = "upgraded";
      if (typeof cb == "function") {
        return returnValFromPlayerInfo(self.info, valToLookFor, options, cb);
      } else {
        return simplePromisifyIt(self[valToLookFor], options);
      }
    }
    self.smName = function (options, cb) { // Returns a player's registry account if online, false if offline.
      var valToLookFor = "smName";
      if (typeof cb == "function") {
        return returnValFromPlayerInfo(self.info, valToLookFor, options, cb);
      } else {
        return simplePromisifyIt(self[valToLookFor], options);
      }
    }
    self.ip = function (options, cb) { // Returns a player's ip, but only if online.  Returns false if offline.
      var valToLookFor = "ip";
      if (typeof cb == "function") {
        return returnValFromPlayerInfo(self.info, valToLookFor, options, cb);
      } else {
        return simplePromisifyIt(self[valToLookFor], options);
      }
    }
    self.personalTestSector = function (options, cb) { // Returns a player's personal sector, whether online or offline.
      var valToLookFor = "personalTestSector";
      if (typeof cb == "function") {
        return returnValFromPlayerInfo(self.info, valToLookFor, options, cb);
      } else {
        return simplePromisifyIt(self[valToLookFor], options);
      }
    }
    this.exists = function (options, cb) {
      if (typeof cb == "function") {
        return self.personalTestSector(options, function (err, result) { // All players have a personal test sector
          if (err) {
            return cb(err, result);
          }
          if (testIfInput(result)) {
            return cb(null, true);
          }
          return cb(null, false);
        });
      }
      return simplePromisifyIt(self.exists, options);
    }
    self.credits = function (options, cb) { // Returns a player's credits held, whether online or offline.
      var valToLookFor = "credits";
      if (typeof cb == "function") {
        return returnValFromPlayerInfo(self.info, valToLookFor, options, cb);
      } else {
        return simplePromisifyIt(self[valToLookFor], options);
      }
    }
    self.faction = function (options, cb) { // Returns a player's credits held, whether online or offline.
      var valToLookFor = "faction";
      if (typeof cb == "function") {
        return returnValFromPlayerInfo(self.info, valToLookFor, options, cb);
      } else {
        return simplePromisifyIt(self[valToLookFor], options);
      }
    }
    // TODO - create this: // self.controlling=function(input){ } // This is an alternative for currentEntity.  It cannot return the UID for asteroids or planets, but it will at least return SOMETHING.  currentEntity will return false if the player is in an asteroid.
    self.playerProtect = function (smName, options, cb) { // Requires smName, which can be a string or a SMNameObj
      if (typeof cb == "function") {
        var smNameToUse = toStringIfPossible(smName);
        if (typeof smNameToUse == "string") {
          return runSimpleCommand("/player_protect " + self.name + " " + smNameToUse, options, cb);
        } else {
          return cb(new Error("Invalid smName given to playerProtect!"), null);
        }
      }
      return simplePromisifyIt(self.playerProtect, options);
    }
    self.playerUnprotect = function (options, cb) { // Removes registry account protection for the username
      if (typeof cb == "function") {
        return runSimpleCommand("/player_unprotect " + self.name, options, cb);
      }
      return simplePromisifyIt(self.playerUnprotect, options);
    }
    self.currentEntity = function (options, cb) {
      // This uses the /entity_info_by_player_uid command instead of /player_info command, since that will not work with asteroids nor planets.
      // IMPORTANT NOTE:  This does not work with asteroids currently!

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
      if (typeof cb == "function") {
        return starNetVerified(serverObj, "/entity_info_by_player_uid " + self.name, options, function (err, result) {
          if (err) {
            console.error("PlayerObj.currentEntity encountered a StarNet problem.  On Player: " + self.name, err);
            return cb(new Error(err), null);
          }
          if (!returnLineMatch(result, /^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\]/)) {
            var currentEntityResult = returnLineMatch(result, /^RETURN: \[SERVER, UID: .*/, /^RETURN: \[SERVER, UID: /, /, 0\]$/);
            // NOTE:  This is currently broken for asteroids.  There seems to be no way to get the entity UID if it is an asteroid, but this does work for planet plates.
            // TODO:  Bug Schema to fix this for asteroids.
            if (currentEntityResult) {
              // TODO:  Determine if there really is a reason to have separte entity objects for planets and asteroids, otherwise the below will be fine.
              return cb(null, new EntityObj(currentEntityResult));
            }
          }
          return cb(null, Boolean(false)); // Player does not exist or is offline
          // NOTE: This will always return false if the player is in an asteroid.. so be careful with self.
        });
      } else {
        return simplePromisifyIt(self.currentEntity, options);
      }
    }
    self.ips = function (options, cb) { // Returns an array of IPObj of a user as returned by /player_info
      // Note:  By default it will only return unique IP's, but an option can be specified to return them all, which includes the timestamp of the login from the IP
      if (typeof cb == "function") {
        var unique = getOption(options, "unique", true); // By default only return unique IP's
        return starNetVerified(serverObj, "/player_info " + this.name, options, function (err, result) {
          if (err) {
            console.error("StarNet command failed when attempting to get the ips for player: " + self.name);
            return cb(err, result);
          }
          var resultArray = returnMatchingLinesAsArray(result, /^RETURN: \[SERVER, \[PL\] LOGIN: \[time=.*/);
          var outputArray = [];
          var ipTemp;
          var ipDateTemp;
          var ipDateObj = {};
          var ipTrackerArray = [];
          for (var i = 0;i < resultArray.length;i++) {
            ipDateTemp = resultArray[i].match(/\[time=[^,]*/);
            if (ipDateTemp) {
              ipDateTemp = ipDateTemp.toString().replace(/^\[time=/, "");
              ipDateObj = new Date(ipDateTemp); // This was tested to be working correctly
              ipTemp = resultArray[i].match(/ip=[^,]*/);
              if (ipTemp) {
                ipTemp = ipTemp.toString().replace(/^ip=\//, "");
                // This does not filter based on unique IP's since there is a date associated with each IP login
                // TODO:  Make it so the default is to filter only unique IP's but give an option not to
                if (unique) { // If only pushing unique IP's
                  if (!isInArray(ipTrackerArray, ipTemp)) {
                    outputArray.push(new IPObj(ipTemp, ipDateObj));
                    ipTrackerArray.push(ipTemp); // Record the unique IP so it isn't added to the resultArray again
                  }
                } else {
                  outputArray.push(new IPObj(ipTemp, ipDateObj));
                }
              }
            }
          }
          return cb(null, outputArray); // Array is empty if no results found
        });
      } else {
        return simplePromisifyIt(self.ips, options);
      }
    }
    self.inventory = function (options, cb) { // Returns a player's inventory as an array of objects - Broken right now because it returns the currently open inventory, which could be the personal inventory, cargo, or creative
      // TODO:  Follow up with Schema about it using the personal inventory by default, and a second command '/player_get_current_inventory' being added.
      // TODO:  Add an option for the output to be a map object.
      // TODO:  Create a function that converts an item number to the item name.  This might be pretty complicated though, since it would require parsing the blockProperties.xml file, blockConfig.xml, and customBlockConfig.xml to accurately find the item number's name.
      // TODO:  Follow up with schema about multi-blocks being broken down into it's invidivdual block counts.  Right now, this is how a multi-block outputs:
      // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 27; MULTI: true; TYPE: -32768; META: -1; COUNT: 400, 0]
      // For built-in blocks, it could be possible to map every single multi-block type and then run individual "/player_get_block_amount" on those id's.. and then reformulate the output to include whichever ones are found.. but that would be very time-consuming, inefficient, and would not work for custom block groupings since I'd have no way of anticipating what those -234234 numbers would look like.
      if (typeof cb == "function") {
        var current = false;
        // var current=getOption(options,"current",false); // This does not work currently
        var commandToUse = "/player_get_inventory ";
        if (current) {
          commandToUse = "/player_get_current_inventory "; // This command does not exist yet, so don't use this till it is.
        }
        return starNetVerified(serverObj, commandToUse + self.name, options, function (err, result) {
          if (err) {
            console.error("PlayerObj.inventory StarNet command failed for player: " + self.name);
            return cb(err, result);
          }
          // C:\coding\starmade.js\bin>node starNet.js "/player_get_inventory Benevolent27"
          // RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] Listing player Benevolent27 personal inventory START, 0]
          // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 0; MULTI: false; TYPE: 598; META: -1; COUNT: 595, 0]
          // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 1; MULTI: false; TYPE: 1010; META: -1; COUNT: 5, 0]
          // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 2; MULTI: false; TYPE: -11; META: 100892; COUNT: 1, 0]
          // RETURN: [SERVER, [INVENTORY] Benevolent27:  SLOT: 3; MULTI: false; TYPE: -11; META: 100893; COUNT: 1, 0]
          // RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] Listing player Benevolent27 personal inventory END., 0]
          // RETURN: [SERVER, END; Admin command execution ended, 0]

          // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player Benevolent27 not online, 0]
          if (!returnLineMatch(result, /^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\].*/)) {
            // console.log("Result found!"); // temp
            var outputArray = [];
            // Parse through the lines, creating new objects and outputting to the outputArray.
            var theArray = result.trim().split("\n");
            var theReg = new RegExp("^RETURN: \\[SERVER, \\[INVENTORY\\] Benevolent27: {2}SLOT: .*"); // The {2} here is just to denote 2 spaces.
            var match;
            var slot;
            var multi;
            var type;
            var meta;
            var count;
            var outputObj = {};
            for (var i = 0;i < theArray.length;i++) {
              // console.log("Processing line: " + theArray[i]);  // temp
              match = theArray[i].match(theReg); // Returns void if not found
              if (match) {
                // console.log("Match found!  Processing it..");
                match = match.toString();
                slot = match.match(/SLOT: [-]{0,1}[0-9]*/).toString().replace("SLOT: ", ""); // This should never error out, but a more careful approach might be needed.
                multi = match.match(/MULTI: [a-zA-Z]*/).toString().replace("MULTI: ", "");
                type = match.match(/TYPE: [-]{0,1}[0-9]*/).toString().replace("TYPE: ", "");
                meta = match.match(/META: [-]{0,1}[0-9]*/).toString().replace("META: ", "");
                count = match.match(/COUNT: [-]{0,1}[0-9]*/).toString().replace("COUNT: ", "");
                outputObj = {
                  "slot": toNum(slot),
                  "multi": trueOrFalse(multi),
                  "type": toNum(type),
                  "meta": toNum(meta),
                  "count": toNum(count)
                }
                // console.log("Adding object to outputArray:");
                // console.dir(outputObj);
                outputArray.push(outputObj);
              }
            }
            return cb(null, outputArray); // If inventory is empty, will return an empty array.
          }
          return cb(null, Boolean(false)); // Player was offline or did not exist

        }); // This will throw an error if there is a connection issue, false if the command fails, likely due to the player being offline.
      } else {
        return simplePromisifyIt(self.inventory, options);
      }
    }
    self.blueprints = function (options, cb) { // Returns an array of blueprint objects.
      if (typeof cb == "function") {
        var verbose = getOption(options, "verbose", false); // Not sure if I'll actually use this
        return starNetVerified(serverObj, "/list_blueprints_by_owner " + self.name, options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          // RETURN: [SERVER, [CATALOG] START, 0]
          // RETURN: [SERVER, [CATALOG] INDEX 0: Another ship of mine with     spaces, 0]
          // RETURN: [SERVER, [CATALOG] INDEX 1: A catalogue test, 0]
          // RETURN: [SERVER, [CATALOG] END, 0]
          // RETURN: [SERVER, END; Admin command execution ended, 0]
          if (!returnLineMatch(result, /^RETURN: \[SERVER, \[ADMIN COMMAND\] \[ERROR\].*/)) { // This should normally not happen.
            var outputArray = [];
            // Parse through the lines, creating new objects and outputting to the outputArray.
            var theArray = result.trim().split("\n");
            var theReg = new RegExp("^RETURN: \\[SERVER, \\[CATALOG\\] INDEX.*"); // This will only search for only the lines with catalogue names
            var theCatalogString;
            for (let i = 0;i < theArray.length;i++) {
              theCatalogString = theArray[i].match(theReg); // is undefined if no match
              if (theCatalogString) {
                theCatalogString = theCatalogString.toString().replace(/^RETURN: \[SERVER, \[CATALOG\] INDEX [0-9]+: /, "").replace(/, 0\]$/, "");
                outputArray.push(new BlueprintObj(theCatalogString));
              }
            }
            return cb(null, outputArray); // outputs an empty array if the player had no blueprints
          }
          return cb(null, Boolean(false)); // This will only happen if there is an error with the command, but it was not a connection error.  This should not happen.
        });
      } else {
        return simplePromisifyIt(self.blueprints, options);
      }
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

function returnValFromPlayerInfo(selfInfoFunc, valToGet, options, cb) {
  // Assists with returning individual values from a PlayerObj.info() result.
  let theFunc = selfInfoFunc;
  return theFunc(options, function (err, result) {
    if (err) {
      return cb(err, null)
    }
    if (result.hasOwnProperty(valToGet)) {
      return cb(null, result[valToGet]);
    }
    return cb(null, Boolean(false));
  })
};

function SystemObj(x, y, z) { // cb/promises/squish compliant
  var self = this;
  this.coords = new CoordsObj(x, y, z);
  this.x = self.coords.x;
  this.y = self.coords.y;
  this.z = self.coords.z;
  // TODO: Add Info methods:
  // center - returns the center set of coordinates as a SectorObj
  // type - returns the system type, so black hole, star, giant, double star, void

  // Action Methods:
  // load - Uses "/load_system x y z" to load the whole system.
  this.typeNumber = function (options, cb) {
    if (typeof cb == "function") {
      return simpleSqlQuery(serverObj, `SELECT TYPE FROM PUBLIC.SYSTEMS WHERE X=${self.x} AND Y=${self.y} AND Z=${self.z};`, options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        if (result.length > 0) {
          return cb(null, Number(result[0]["TYPE"])); // There should only ever be 1 result, if the system is claimed.
          // Returns a number, representing the type of system
          // 4: Regular Star (any color)
          // 5: Black Hole
          // 6: Void
          // 8: Supernova
          // 9: Double Star
        } else {
          return cb(null, null); // If no result, the system is not claimed.
        }
      });
    }
    return simplePromisifyIt(self.type, options);
  }
  this.claimEntity = function (options, cb) {
    if (typeof cb == "function") {
      return simpleSqlQuery(serverObj, `SELECT OWNER_UID FROM PUBLIC.SYSTEMS WHERE X=${self.x} AND Y=${self.y} AND Z=${self.z};`, options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        if (result.length > 0) {
          return cb(null, new EntityObj(result[0].OWNER_UID)); // There should only ever be 1 result, if the system is claimed.
        } else {
          return cb(null, null); // If no result, the system is not claimed.
        }
      });
    }
    return simplePromisifyIt(self.claimEntity, options);
  }
  this.claimSector = function (options, cb) {
    if (typeof cb == "function") {
      return simpleSqlQuery(serverObj, `SELECT OWNER_X,OWNER_Y,OWNER_Z FROM PUBLIC.SYSTEMS WHERE X=${self.x} AND Y=${self.y} AND Z=${self.z};`, options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        if (result.length > 0) {
          return cb(null, new SectorObj(result[0]["OWNER_X"], result[0]["OWNER_Y"], result[0]["OWNER_Z"])); // There should only ever be 1 result, if the system is claimed.
        } else {
          return cb(null, null); // If no result, the system is not claimed.
        }
      });
    }
    return simplePromisifyIt(self.claimSector, options);
  }

  this.claimFaction = function (options, cb) {
    if (typeof cb == "function") {
      return simpleSqlQuery(serverObj, `SELECT OWNER_FACTION FROM PUBLIC.SYSTEMS WHERE X=${self.x} AND Y=${self.y} AND Z=${self.z};`, options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        if (result.length > 0) {
          if (result[0] != 0) {
            return cb(null, new FactionObj(result[0]["OWNER_FACTION"])); // There should only ever be 1 result, if the system is claimed.
          }
          return cb(null, null);

        } else {
          return cb(null, null); // If no result, the system is not claimed.
        }
      });
    }
    return simplePromisifyIt(self.claimFaction, options);
  }

  this.spawnNPCFaction = function (npcName, npcFactionName, npcDescription, initialGrowth, options, cb) { // Normally options would never be given since who cares about making this fast?
    // DOES NOT GIVE AN ERROR IF THE NPC TYPE IS NOT CORRECT - NEED TO DO MY OWN CHECKING HERE TO SEE IF VALID.
    if (typeof cb == "function") {
      if (!testIfInput(npcName)) {
        throw new Error("No NPC name given to SystemObj.spawnNPCFaction!"); // Input was either blank or a blank object or something.
      }
      var npcNameToUse = npcName.toString(); // If it's an object or something that can be converted to a string, we can use the string.  This will throw an error if it cannot be converted to a string.
      if (typeof npcNameToUse != "string") {
        throw new Error("Invalid NPC name given to SystemObj.spawnNPCFaction!");
      }
      if (!testIfInput(npcFactionName)) {
        throw new Error("No NPC faction name given to SystemObj.spawnNPCFaction!"); // Input was either blank or a blank object or something.
      }
      var npcFactionNameToUse = npcFactionName.toString();
      if (typeof npcFactionNameToUse != "string") {
        throw new Error("Invalid NPC faction name given to SystemObj.spawnNPCFaction!");
      }

      // Description and initial growth can be blank, but throw error if invalid input given
      var npcDescriptionToUse = "";
      if (testIfInput(npcDescription)) {
        npcDescriptionToUse = npcDescription.toString();
      }
      var initialGrowthToUse = 10;
      if (isNum(initialGrowth)) {
        initialGrowthToUse = initialGrowth;
      }
      // /npc_spawn_faction_pos_fixed
      // DESCRIPTION: Spawns a faction on a fixed position
      // PARAMETERS: name(String), description(String), preset (npc faction config folder name)(String), Initial Growth(Integer), System X(Integer), System Y(Integer), System Z(Integer)
      // EXAMPLE: /npc_spawn_faction_pos_fixed "My NPC Faction" "My Faction's description" "Outcasts" 10 12 3 22
      return runSimpleCommand("/npc_spawn_faction_pos_fixed \"" + npcNameToUse + "\" \"" + npcFactionNameToUse + "\" \"" + npcDescriptionToUse + "\" " + initialGrowthToUse + " " + this.coords.toString(), options, cb);
    }
    return simplePromisifyIt(self.spawnNPCFaction, options, npcName, npcFactionName, npcDescription, initialGrowth);
  }
  this.territoryMakeUnclaimable = function (options, cb) {
    if (typeof cb == "function") {
      return runSimpleCommand("/territory_make_unclaimable " + this.coords.toString(), options, cb);
    }
    return simplePromisifyIt(self.territoryMakeUnclaimable, options);
  }
  this.territoryReset = function (options, cb) {
    if (typeof cb == "function") {
      return runSimpleCommand("/territory_reset " + this.coords.toString(), options, cb);
    }
    return simplePromisifyIt(self.territoryReset, options);
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
  if (arguments.length > SystemObj.length) {
    var extraInfoArray = [];
    for (let i = SystemObj.length - 1;i < arguments.length;i++) {
      extraInfoArray.push(arguments[i]);
    }
    this.extraInfo = extraInfoArray;
  }
};

function BlueprintObj(name) { // cb/promises/squish compliant
  var self = this;
  this.name = name.toString(); // This will throw an error if anything given cannot be turned into a string.  This is intentional.
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
  this.exists = function (options, cb) {
    if (typeof cb == "function") {
      return runSimpleCommand("/blueprint_info '" + self.name + "'", options, cb); // If the Blueprint exists, this should return true, otherwise false.
    }
    return simplePromisifyIt(self.exists, options);
  }
  this.del = function (options, cb) {
    if (typeof cb == "function") {
      return runSimpleCommand("/blueprint_delete \"" + this.name + "\"", options, cb);
    } else {
      return simplePromisifyIt(self.del, options);
    }

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
  this.delete = this.del;
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
  this.spawnTo = function (shipName, location, spacialCoords, faction, aiActiveTrueOrFalse, options, cb) { // spacialCoords optional
    // location can be sectorObj,CoordsObj, or a LocationObj
    if (typeof cb == "function") {
      var theShipName = toStringIfPossible(shipName);
      if (typeof theShipName != "string") {
        console.error("Invalid input given to BlueprintObj.spawnTo for shipName!");
        return cb(new Error("Invalid input given to BlueprintObj.spawnTo for shipName!"), null);
      }
      try {
        var theSector = new SectorObj(location); // Allows LocationObj, SectorObj, CoordsObj, or anything that can create a CoordsObj as input
      } catch (err) {
        console.error("Invalid input given to BlueprintObj.spawnTo for location!");
        return cb(err, null);
      }
      var theSpacial;
      if (testIfInput(spacialCoords)) {
        try {
          theSpacial = new CoordsObj(spacialCoords);
        } catch (err) {
          console.error("Invalid input given to BlueprintObj.spawnTo for spacialCoords!");
          return cb(err, null);
        }
      }
      if (location instanceof LocationObj) { // Always prefer the LocationObj spacial coords if two values given
        theSpacial = location.spacial;
      }
      var theSectorString = theSector.toString();
      var factionNum;
      if (testIfInput(faction)) {
        var factionString = toStringIfPossible(faction); // Allows FactionObj as input
        if (typeof factionString == "string") {
          factionNum = toNumIfPossible(factionString);
          if (typeof factionNum != "number") { // It should convert to a number
            return cb(new Error("Invalid input given to BlueprintObj for faction! (non-number)"), null);
          }
        } else {
          return cb(new Error("Invalid input given to BlueprintObj for faction!  (Could not convert to string!)"), null);
        }
      } else { // No faction number given, so use 0.
        factionNum = 0;
      }
      var aiActiveTrueOrFalseToUse = true; // by default, AI will be turned on.
      if (testIfInput(aiActiveTrueOrFalse)) {
        if (isTrueOrFalse(aiActiveTrueOrFalse)) {
          aiActiveTrueOrFalseToUse = aiActiveTrueOrFalse;
        } else {
          return cb(new Error("Invalid input given to BlueprintObj.spawnTo for aiActiveTrueOrFalse! (Should be true or false value)"), null);
        }
      }

      if (theSpacial) {
        var theSpacialString = theSpacial.toString();
        return runSimpleCommand("/spawn_entity_pos '" + self.name + "' '" + theShipName + "' " + theSectorString + " " + theSpacialString + " " + factionNum + " " + aiActiveTrueOrFalseToUse, options, cb);
        // /spawn_entity_pos mySavedShip shipName sectorX sectorY sectorZ local-X local-Y local-Z -1 true

      } else {
        // /spawn_entity
        return runSimpleCommand("/spawn_entity '" + self.name + "' '" + theShipName + "' " + theSectorString + " " + factionNum + " " + aiActiveTrueOrFalseToUse, options, cb);
      }

    }
    return simplePromisifyIt(self.spawnTo, options, shipName, location, spacialCoords, faction, aiActiveTrueOrFalse);
  }


  this.info = function (options, cb) {
    if (typeof cb == "function") {
      return starNetVerified(serverObj, "/blueprint_info '" + self.name + "'", options, function (err, result) {
        var outputObj = {};
        if (err) {
          return cb(err, result);
        }
        if (result) {
          outputObj["UID"] = returnLineMatch(result, /^UID: .*/, /^UID: /);
          var ownerTest = returnLineMatch(result, /^Owner: .*/, /^Owner: /);
          console.log("### OWNED BY: " + ownerTest); // temp
          if (ownerTest == "(unknown)") {
            outputObj["owner"] = null;
          } else {
            outputObj["owner"] = new PlayerObj(ownerTest);
          }
          outputObj["date"] = new Date(toNumIfPossible(returnLineMatch(result, /^DateMS: .*/, /^DateMS: /)));
          outputObj["description"] = returnLineMatch(result, /^Description: .*/, /^Description: /);
          outputObj["mass"] = toNumIfPossible(returnLineMatch(result, /^Mass: .*/, /^Mass: /));
          outputObj["spawnCount"] = toNumIfPossible(returnLineMatch(result, /^SpawnCount: .*/, /^SpawnCount: /));
          outputObj["price"] = toNumIfPossible(returnLineMatch(result, /^Price: .*/, /^Price: /));
          outputObj["rating"] = toNumIfPossible(returnLineMatch(result, /^Rating: .*/, /^Rating: /));
          outputObj["blocks"] = toNumIfPossible(returnLineMatch(result, /^Blocks: .*/, /^Blocks: /));
          outputObj["blocksInclChilds"] = toNumIfPossible(returnLineMatch(result, /^BlocksInclChilds: .*/, /^BlocksInclChilds: /));
          outputObj["dockCountOnMother"] = toNumIfPossible(returnLineMatch(result, /^DockCountOnMother: .*/, /^DockCountOnMother: /));
          var DimensionInclChilds = returnLineMatch(result, /^DimensionInclChilds: .*/, /^DimensionInclChilds: /);
          DimensionInclChilds = DimensionInclChilds.replace(/\[|\]|\(|\)/g, "").split("|");
          for (let i = 0;i < DimensionInclChilds.length;i++) {
            DimensionInclChilds[i] = new CoordsObj(DimensionInclChilds[i].split(", "));
          }
          outputObj["dimensionInclChilds"] = DimensionInclChilds; // This is an array with 2 CoordsObj in it
          outputObj["permissionMask"] = toNumIfPossible(returnLineMatch(result, /^PermissionMask: .*/, /^PermissionMask: /));
          outputObj["permissionFaction"] = trueOrFalse(returnLineMatch(result, /^PermissionFaction: .*/, /^PermissionFaction: /));
          outputObj["permissionHomeOnly"] = trueOrFalse(returnLineMatch(result, /^PermissionHomeOnly: .*/, /^PermissionHomeOnly: /));
          outputObj["permissionOthers"] = trueOrFalse(returnLineMatch(result, /^PermissionOthers: .*/, /^PermissionOthers: /));
          outputObj["permissionEnemyUsable"] = trueOrFalse(returnLineMatch(result, /^PermissionEnemyUsable: .*/, /^PermissionEnemyUsable: /));
          outputObj["permissionLocked"] = trueOrFalse(returnLineMatch(result, /^PermissionLocked: .*/, /^PermissionLocked: /));
          return cb(null, outputObj);
        }
        return cb(null, Boolean(false)); // this should never happen
      });
      // Successful Output looks like this:
      // }
      //   "UID":string
      //   "owner":PlayerObj/null
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

    } else {
      return simplePromisifyIt(self.info, options);
    }
  }
  this.UID = function (options, cb) {
    var valToGet = "UID";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.owner = function (options, cb) {
    var valToGet = "owner";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.date = function (options, cb) {
    var valToGet = "date";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.description = function (options, cb) {
    var valToGet = "description";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.mass = function (options, cb) {
    var valToGet = "mass";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.spawnCount = function (options, cb) {
    var valToGet = "spawnCount";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.price = function (options, cb) {
    var valToGet = "price";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.rating = function (options, cb) {
    var valToGet = "rating";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.blocks = function (options, cb) {
    var valToGet = "blocks";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.blocksInclChilds = function (options, cb) {
    var valToGet = "blocksInclChilds";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.dockCountOnMother = function (options, cb) {
    var valToGet = "dockCountOnMother";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.dimensionInclChilds = function (options, cb) {
    var valToGet = "dimensionInclChilds";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.permissionMask = function (options, cb) {
    var valToGet = "permissionMask";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.permissionFaction = function (options, cb) {
    var valToGet = "permissionFaction";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.permissionHomeOnly = function (options, cb) {
    var valToGet = "permissionHomeOnly";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.permissionOthers = function (options, cb) {
    var valToGet = "permissionOthers";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.permissionEnemyUsable = function (options, cb) {
    var valToGet = "permissionEnemyUsable";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };
  this.permissionLocked = function (options, cb) {
    var valToGet = "permissionLocked";
    if (typeof cb == "function") {
      return this.info(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return result[valToGet];
      })
    }
    return simplePromisifyIt(self[valToGet], options);
  };

  // blueprint_set_owner
  // DESCRIPTION: sets owner for a blueprint
  // PARAMETERS: blueprintname(String), playername(String)
  // EXAMPLE: /blueprint_set_owner my_ship schema

};

function FactionObj(number) { // cb/promises/squish compliant
  // number is the Faction Number
  this.number = toNumIfPossible(number);
  var self = this;

  this.name = function (options, cb) {
    if (typeof cb == "function") {
      return starNetVerified(serverObj, "/faction_list", options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        var resultArray = result.split("\n");
        var testReg = new RegExp("RETURN: \\[SERVER, FACTION: Faction \\[id=" + self.number + ",");
        var theName = "";
        for (let i = 0;i < resultArray.length;i++) {
          // RETURN: [SERVER, FACTION: Faction [id=-1003, name=Enemy Fauna Fac 3, 
          if (testReg.test(resultArray[i])) {
            theName = toStringIfPossible(resultArray[i].match(/(?<=, name=)[^,]+/));
            break;
          }
        }
        if (typeof theName == "string") {
          return cb(null, theName);
        }
        return cb(null, null); // The faction number was not found.
      })
    }
    return simplePromisifyIt(self.name, options);
  }
  this.description = function (options, cb) {
    if (typeof cb == "function") {
      return starNetVerified(serverObj, "/faction_list", options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        var resultArray = result.split("\n");
        var testReg = new RegExp("RETURN: \\[SERVER, FACTION: Faction \\[id=" + self.number + ",");
        var theDescription = null;
        for (let i = 0;i < resultArray.length;i++) {
          if (testReg.test(resultArray[i])) {
            theDescription = toStringIfPossible(resultArray[i].match(/(?<=, description=).*/).toString().replace(/, size: [0-9]+; FP: [0-9]+\].*$/, ""));
            break;
          }
        }
        if (typeof theDescription == "string") {
          return cb(null, theDescription); // May contain \n characters.  Should be an empty string if no description at all.
        }
        return cb(null, null); // The faction number was not found.
      })
    }
    return simplePromisifyIt(self.description, options);
  }

  this.homeBaseEntity = function (options, cb) {
    // RETURN: [SERVER, FACTION: Faction [id=-9999990, name=Traders, description=The Trading Guild is a collection of large corporations. They work to better themselves primarily through trade and economics.The Trading Guild treats others with neutrality, and they hardly care who or what they sell their products to. Their wealth grants them strength, but they are a relatively peaceful faction., size: 0; FP: 100]; HomeBaseName: Traders Home; HomeBaseUID: ENTITY_SPACESTATION_NPC-HOMEBASE_-322_13_-216; HomeBaseLocation: (-322, 13, -216); Owned: [(-21, 0, -14), (-21, 0, -13), (-22, 0, -13), (-22, 0, -14), (-21, -1, -13), (-22, 1, -14), (-21, -1, -14), (-22, -1, -13), (-20, -1, -14), (-20, 0, -14), (-20, -1, -15), (-22, -1, -14), (-20, -1, -13), (-20, 0, -15), (-21, -1, -15), (-22, 0, -15), (-22, 0, -12), (-23, 0, -13), (-21, 0, -12), (-20, -1, -16), (-22, -1, -12), (-19, -1, -16), (-20, 0, -16), (-21, -1, -16), (-21, 0, -16), (-23, -1, -13), (-23, 0, -12), (-19, 0, -16), (-20, 0, -17), (-21, -1, -17), (-21, 0, -17), (-19, -1, -17), (-21, 0, -11), (-22, -2, -12)], 0]
    if (typeof cb == "function") {
      return starNetVerified(serverObj, "/faction_list", options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        var resultArray = result.replace("\n", "").split("RETURN: [SERVER, ");
        var testReg = new RegExp("FACTION: Faction \\[id=" + self.number + ",");
        var theEntity;
        for (let i = 0;i < resultArray.length;i++) {
          // ; HomeBaseLocation: (-322, 13, -216);
          if (testReg.test(resultArray[i])) {
            // ; HomeBaseUID: ENTITY_SPACESTATION_MyHomeBase; HomeBaseLocation: (500, 500, 500); Owned: [], 0]
            theEntity = toStringIfPossible(resultArray[i].match(/(?<=; HomeBaseUID: )[^;]+(?=; HomeBaseLocation: )/));
            break;
          }
        }
        if (typeof theEntity == "string") {
          // If no homebase, the coords will be 0 0 0.  It IS possible the person has actually set up a homebase at 0 0 0, so let's check for the UID.. 
          return cb(null, new EntityObj(theEntity));
        }
        return cb(null, null); // There is no homebase
      })
    }
    return simplePromisifyIt(self.homeBaseEntity, options);
  }

  this.homeBaseSector = function (options, cb) {
    // RETURN: [SERVER, FACTION: Faction [id=-9999990, name=Traders, description=The Trading Guild is a collection of large corporations. They work to better themselves primarily through trade and economics.The Trading Guild treats others with neutrality, and they hardly care who or what they sell their products to. Their wealth grants them strength, but they are a relatively peaceful faction., size: 0; FP: 100]; HomeBaseName: Traders Home; HomeBaseUID: ENTITY_SPACESTATION_NPC-HOMEBASE_-322_13_-216; HomeBaseLocation: (-322, 13, -216); Owned: [(-21, 0, -14), (-21, 0, -13), (-22, 0, -13), (-22, 0, -14), (-21, -1, -13), (-22, 1, -14), (-21, -1, -14), (-22, -1, -13), (-20, -1, -14), (-20, 0, -14), (-20, -1, -15), (-22, -1, -14), (-20, -1, -13), (-20, 0, -15), (-21, -1, -15), (-22, 0, -15), (-22, 0, -12), (-23, 0, -13), (-21, 0, -12), (-20, -1, -16), (-22, -1, -12), (-19, -1, -16), (-20, 0, -16), (-21, -1, -16), (-21, 0, -16), (-23, -1, -13), (-23, 0, -12), (-19, 0, -16), (-20, 0, -17), (-21, -1, -17), (-21, 0, -17), (-19, -1, -17), (-21, 0, -11), (-22, -2, -12)], 0]
    if (typeof cb == "function") {
      return starNetVerified(serverObj, "/faction_list", options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        var resultArray = result.replace("\n", "").split("RETURN: [SERVER, ");
        var testReg = new RegExp("FACTION: Faction \\[id=" + self.number + ",");
        var theCoords = "";
        for (let i = 0;i < resultArray.length;i++) {
          // ; HomeBaseLocation: (-322, 13, -216);
          if (testReg.test(resultArray[i])) {
            theCoords = toStringIfPossible(resultArray[i].match(/(?<=; HomeBaseLocation: \()[-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+/));

            break;
          }
        }
        if (typeof theCoords == "string") {
          let theCoordsArray = theCoords.split(", ");
          // If no homebase, the coords will be 0 0 0.  It IS possible the person has actually set up a homebase at 0 0 0, so let's check for the homebaseEntityObj.. 
          return self.homeBaseEntity(options, function (err, result) {
            if (err) {
              return cb(err, result);
            }
            if (result) {
              return cb(null, new SectorObj(...theCoordsArray)); // A homebase UID existed, so return the sector
            }
            return cb(null, null); // No homebase existed, so return null
          })
        }
        return cb(null, null); // The faction number was not found or there were no coordinates for some reason.
      })
    }
    return simplePromisifyIt(self.homeBaseSector, options);
  }

  this.exists = function (options, cb) {
    if (typeof cb == "function") {
      return self.name(options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        if (testIfInput(result)) {
          return cb(null, true);
        }
        return cb(null, false);
      });
    }
    return simplePromisifyIt(self.exists, options);
  }
  this.systemsClaimed = function (options, cb) {
    if (typeof cb == "function") {
      return simpleSqlQuery("SELECT X,Y,Z FROM PUBLIC.SYSTEMS WHERE OWNER_FACTION=" + self.number, options, function (err, results) {
        if (err) {
          return cb(err, results);
        }
        let returnArray = [];
        for (let i = 0;i < results.length;i++) {
          returnArray.push(new SystemObj(results[i].X, results[i].Y, results[i].Z));
        }
        return cb(null, returnArray); // If no results, array will be empty.
      });
    }
    return simplePromisifyIt(self.systemsClaimed, options);
  }
  this.systemClaimEntities = function (options, cb) {
    if (typeof cb == "function") {
      return simpleSqlQuery("SELECT OWNER_UID FROM PUBLIC.SYSTEMS WHERE OWNER_FACTION=" + self.number, options, function (err, results) {
        if (err) {
          return cb(err, results);
        }
        let returnArray = [];
        for (let i = 0;i < results.length;i++) {
          returnArray.push(new EntityObj(results[i].OWNER_UID));
        }
        return cb(null, returnArray); // If no results, array will be empty.
      });
    }
    return simplePromisifyIt(self.systemClaimEntities, options);
  }
  this.systemClaimSectors = function (options, cb) {
    if (typeof cb == "function") {
      return simpleSqlQuery("SELECT OWNER_X,OWNER_Y,OWNER_Z FROM PUBLIC.SYSTEMS WHERE OWNER_FACTION=" + self.number, options, function (err, results) {
        if (err) {
          return cb(err, results);
        }
        let returnArray = [];
        for (let i = 0;i < results.length;i++) {
          returnArray.push(new SectorObj(results[i]["OWNER_X"], results[i]["OWNER_Y"], results[i]["OWNER_Z"]));
        }
        return cb(null, returnArray); // If no results, array will be empty.
      });
    }
    return simplePromisifyIt(self.systemClaimSectors, options);
  }

  this.delete = function (options, cb) { // deletes the faction
    if (typeof cb == "function") {
      return runSimpleCommand("/faction_delete " + self.number, options, cb);
    }
    return simplePromisifyIt(self.delete, options);
  }
  this.npcRemoveFaction = function (options, cb) { // deletes the NPC faction and all of it's stuff
    if (typeof cb == "function") {
      return runSimpleCommand("/npc_remove_faction " + self.number, options, cb);
    }
    return simplePromisifyIt(self.npcRemoveFaction, options);
  }

  this.deleteMember = function (player, options, cb) { // Accepts a playername string or PlayerObj.  Returns false if the player is not in the faction.
    if (typeof cb == "function") {
      var thePlayerName = toStringIfPossible(player);
      if (typeof thePlayerName == "string") {
        var thePlayerObj = new PlayerObj(thePlayerName);
        return thePlayerObj.faction(options, function (err, result) {
          if (err) {
            return cb(err, null);
          }
          var theFactionString = toStringIfPossible(result);
          var theFactionNum = toNumIfPossible(theFactionString);
          if (typeof theFactionNum == "number" && theFactionNum == self.number) {
            return runSimpleCommand("/faction_del_member " + thePlayerName + " " + self.number, options, function (err, result) {
              if (err) {
                return cb(err, result);
              }
              return cb(null, result); // should be true if the command succeeded.  False if some other problem happened.
            });
          } else {
            // the player does not appear to be in this faction
            return cb(null, false); // this is to indicate the command failed since the player was not in the faction.
          }
        });
      }
      return cb(new Error("Invalid input given to FactionObj.deleteMember as player!"), null);

    }
    return simplePromisifyIt(self.deleteMember, options, player);

  }
  this.edit = function (newName, newDescription, options, cb) { // If no newDescription given, will use blank.
    if (typeof cb == "function") {
      var theName = toStringIfPossible(newName);
      if (typeof theName == "string") {
        var theDescription = toStringIfPossible(newDescription);
        if (typeof theDescription != "string") {
          theDescription = " ";
        }
        return runSimpleCommand("/faction_edit " + self.number + " " + theName + " " + theDescription);
      }
      return cb(new Error("Invalid newName given to FactionObj.edit!"));

    }
    return simplePromisifyIt(self.edit, options, newName, newDescription);

  }
  this.addMember = function (player, options, cb) {
    if (typeof cb == "function") {
      var thePlayerName = toStringIfPossible(player);
      if (typeof thePlayerName == "string") {
        var thePlayerObj = new PlayerObj(thePlayerName);
        return thePlayerObj.joinFaction(self.number, options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          return cb(null, result); // returns true/false, depending on success/failure.
        });
      }
      return cb(new Error("Invalid input given to FactionObj.deleteMember as player!"), null);

    }
    return simplePromisifyIt(self.addMember, options, player);

  }
  this.listMembers = function (options, cb) {
    if (typeof cb == "function") {
      //RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] Merc Dragon: {Lightspeed12=>FactionPermission [playerUID=Lightspeed12, roleID=2], Nosajimiki=>FactionPermission [playerUID=Nosajimiki, roleID=4]}, 0]
      // TODO: Add an option to return an array of pairs, player and role number.
      return starNetVerified(serverObj, "/faction_list_members " + self.number, options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        let regMatch = /^RETURN: \[SERVER, \[ADMIN COMMAND\] \[SUCCESS\]/;
        let regRem1 = /^RETURN: \[SERVER, \[ADMIN COMMAND\] \[SUCCESS\] [^:]*: {/
        let regRem2 = /}, 0\]$/
        var theList = returnLineMatch(result, regMatch, regRem1, regRem2);
        if (typeof theList == "string") {
          var theArray = theList.split('], ');
          var outputArray = [];
          for (let i = 0;i < theArray.length;i++) {
            outputArray.push(new PlayerObj(theArray[i].match(/^[^=]*/).toString()));
          }
          return cb(null, outputArray); // I'm guessing if a faction exists but has no members, this will output an empty array.
        }
        return cb(null, false); // command failed for some reason.  Maybe the faction doesn't exist?  Maybe no members?
      });


    }
    return simplePromisifyIt(self.listMembers, options);

  }
  this.modRelation = function (targetFaction, newStatus, options, cb) { // newStatus can be enemy/ally/neutral
    if (typeof cb == "function") {
      var theTargetFaction = toStringIfPossible(targetFaction);
      var theTargetFactionNum = toNumIfPossible(theTargetFaction);
      if (typeof theTargetFactionNum == "number") {
        var theNewStatus = toStringIfPossible(newStatus);
        if (typeof theNewStatus == "string") {
          theNewStatus = theNewStatus.toLowerCase();
          if (theNewStatus == "enemy" || theNewStatus == "ally" || theNewStatus == "neutral") {
            return runSimpleCommand("/faction_mod_relation " + self.number + " " + theTargetFactionNum + " " + theNewStatus, options, cb);
          }
          return cb(new Error("Invalid input given to FactionObj.modRelation for newStatus! (must be 'enemy', 'ally', or 'neutral')"), null);
        }
        return cb(new Error("Invalid input given to FactionObj.modRelation for newStatus! (not stringable)"), null);
      }
      return cb(new Error("Invalid input given to FactionObj.modRelation for targetFaction! (cannot convert to number)"), null);
    }
    return simplePromisifyIt(self.modRelation, options, targetFaction, newStatus);
  }
  this.addFactionPoints = function (number, options, cb) { // numToAdd can be negative to remove
    if (typeof cb == "function") {
      var theNumToUse = toNumIfPossible(number);
      if (typeof theNumToUse == "number") {
        return runSimpleCommand("/faction_point_add " + self["number"] + " " + theNumToUse, options, cb);
      }
      return cb(new Error("Invalid number given to FactionObj.addFactionPoints!"), null);
    }
    return simplePromisifyIt(self.addFactionPoints, options, number);

  }
  this.setFactionPoints = function (number, options, cb) {
    if (typeof cb == "function") {
      var theNumToUse = toNumIfPossible(number);
      if (typeof theNumToUse == "number") {
        return runSimpleCommand("/faction_point_set " + self["number"] + " " + theNumToUse, options, cb);
      }
      return cb(new Error("Invalid number given to FactionObj.setFactionPoints!"), null);
    }
    return simplePromisifyIt(self.setFactionPoints, options, number);
  }
  this.getFactionPoints = function (options, cb) {
    if (typeof cb == "function") {
      return starNetVerified(serverObj, "/faction_point_get " + self.number, options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        // RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] faction points of whatever now: 426.0, 0]
        var regExpMatch = /RETURN: \[SERVER, \[ADMIN COMMAND\] \[SUCCESS\] faction points of.*/;
        var regExpRemove = /RETURN: \[SERVER, \[ADMIN COMMAND\] \[SUCCESS\] faction points of [^:]*: /;
        var regExpRemove2 = /, 0\]$/;
        var thePointsTest = toNumIfPossible(returnLineMatch(result, regExpMatch, regExpRemove, regExpRemove2));
        if (typeof thePointsTest == "number") {
          return cb(null, thePointsTest);
        } else {
          return cb(null, false);
        }
      })
    }
    return simplePromisifyIt(self.getFactionPoints, options);
  }

  this.resetActivity = function (options, cb) { // resets activity flags for all members of the faction (all to inactive)
    if (typeof cb == "function") {
      return runSimpleCommand("/faction_reset_activity " + self.number, options, cb);
    }
    return simplePromisifyIt(self.resetActivity, options);
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

function LocationObj(sector, spacial) { // cb/promises/squish compliant
  // This is to store an exact location, including system, sector, and spacial coordinates.
  var self = this; // this is needed to reference the "this" of functions in other contexts, particularly for creating promises via the outside function.  If "this" is used, the promisify function will not work correctly.
  // if (sectorObj instanceof SectorObj){
  //   self.sector=sectorObj;
  // } else if (sectorObj instanceof CoordsObj){
  //   self.sector=new SectorObj(sectorObj.x,sectorObj.y,sectorObj.z);
  // } else {
  //   self.sector=new SectorObj(sectorObj);
  // }
  self.sector = new SectorObj(sector); // This will take any input a CoordObj can take, including another SectorObj
  // if (coordsObj instanceof CoordsObj){
  //   self.spacial=coordsObj;
  // } else {
  //   self.spacial=new CoordsObj(coordsObj); // This will throw an error if invalid input
  // }
  self.spacial = new CoordsObj(spacial); // This will throw an error if invalid input
  self.system = self.sector.system;
};

function SectorObj(x, y, z) { // cb/promises/squish compliant
  var self = this; // this is needed to reference the "this" of functions in other contexts, particularly for creating promises via the outside function.  If "this" is used, the promisify function will not work correctly.
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


  var theCoordsObj = new CoordsObj(x, y, z); // This will handle any conversions needed of various inputs, either strings of x y z, Array of coordinates, other sector or coords objects, etc.
  self.x = theCoordsObj.x;
  self.y = theCoordsObj.y;
  self.z = theCoordsObj.z;
  // Only if this is valid should we proceed.
  if (typeof self.x == "number" && typeof self.y == "number" && typeof self.z == "number") {
    // TODO: add a .system method
    self.coords = theCoordsObj;
    self.system = convertSectorToSystem(self.coords);
    self.clearMines = function (options, cb) {
      // RETURN: [SERVER, Mines cleared in 2, 2, 2!, 0]
      if (typeof cb == "function") {
        return runSimpleCommand("/clear_mines_sector " + self.coords.toString(), options, cb);
      } else {
        return simplePromisifyIt(self.clearMines, options);
      }
    }
    self.clearOverheating = function (options, cb) {
      // Will error and return false if the sector is unloaded.
      if (typeof cb == "function") {
        return runSimpleCommand("/clear_overheating_sector " + self.coords.toString(), options, cb);
      } else {
        return simplePromisifyIt(self.clearOverheating, options);
      }
    }
    self.despawn = function (partOfShipName, used, shipOnly, options, cb) {
      // /despawn_sector
      // EXAMPLE: /despawn_sector MOB_ unused true 2 2 2
      // Will error and return false if the sector is unloaded.
      if (typeof cb == "function") {
        var partOfShipNameToUse = toStringIfPossible(partOfShipName);
        if (typeof partOfShipNameToUse != "string") {
          return cb(new Error("Invalid input given to SectorObj.despawn!"), null);
        }
        var usedToUse = "all";
        var usedTest = toStringIfPossible(used);
        if (typeof usedTest == "string") {
          usedTest = usedTest.toLowerCase();
        }
        if (usedTest == "all" || usedTest == "used" || usedTest == "unused") {
          usedToUse = usedTest;
        }
        var shipOnlyToUse = "false";
        if (isTrueOrFalse(shipOnly)) {
          shipOnlyToUse = shipOnly;
        }
        return runSimpleCommand("/despawn_sector \"" + partOfShipNameToUse + "\" " + usedToUse + " " + shipOnlyToUse + " " + self.coords.toString(), options, cb);
      }
      return simplePromisifyIt(self.despawn, options, partOfShipName, used, shipOnly);
    }
    self.isLoaded = function (options, cb) {
      // ^RETURN\: \[SERVER, LOADED SECTOR INFO\:
      // RETURN: [SERVER, LOADED SECTOR INFO: Sector[132](2, 2, 2); Permission[Peace,Protected,NoEnter,NoExit,NoIndication,NoFpLoss]: 000000; Seed: -4197430019395025102; Type: VOID;, 0]
      if (typeof cb == "function") {
        return starNetVerified(serverObj, "/sector_info " + self.coords.toString(), options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          let theReg = /^RETURN: \[SERVER, LOADED SECTOR INFO:.*/;
          return cb(null, starNet.checkForLine(result, theReg));
        });
      }
      return simplePromisifyIt(self.isLoaded, options);
    }
    self.importSector = function (sectorExport, options, cb) {
      // /import_sector
      // DESCRIPTION: make sure that the target sector is unloaded
      // PARAMETERS: toX(Integer), toY(Integer), toZ(Integer), name(String)
      // EXAMPLE: /import_sector 2 3 4 mySavedSector

      // No success message when successful
      // No error when file does not exist.

      // Only gives errors if parameters incorrect.  RETURN: [SERVER, Admin command failed: Error packing parameters, 0]

      // global.starMadeInstallFolder
      if (typeof cb == "function") {
        var sectorExportFile = toStringIfPossible(sectorExport);
        if (typeof sectorExportFile == "string") {
          if (!(/\.smsec$/i).test(sectorExportFile)) {
            sectorExportFile += ".smsec";
          }
          var exportFolder = path.join(global.starMadeInstallFolder, "sector-export/");
          var sectorExportFilePath = path.join(exportFolder, sectorExportFile);
          // StarMade seems to behave in a case insensitive way on windows, but case sensitive on linux and probably mac
          var theTest = false;
          if (process.platform == "win32") {
            theTest = miscHelpers.isFileInFolderCaseInsensitive(sectorExportFilePath); // This is literal for the path but not for the file.
          } else {
            theTest = miscHelpers.existsAndIsFile(sectorExportFilePath); // This does a literal check for linux/mac.
          }
          if (theTest) {
            // File exists
            return self.isLoaded(options, function (err, result) {
              if (err) {
                console.error("Error when checking if sector was loaded: " + self.coords.toString());
                return cb(err, result);
              }
              if (result) {
                return cb(null, Boolean(false)); // Sector was loaded, so we cannot load the sector
              }
              return runSimpleCommand("/import_sector " + self.coords.toString() + " " + sectorExport, options, cb);
            });
            // This will not return any errors unless the parameters are incorrect.
          } else {
            // File does not exist
            console.error("ERROR: Could not load sector export!  File does not exist: " + sectorExportFilePath);
            return cb(null, Boolean(false));
          }
        }
        return cb(new Error("ERROR: Input given as sectorExport given to SectorObj was invalid! (not stringable)"), null);
      }
      return simplePromisifyIt(self.importSector, options, sectorExport);
    }
    self.exportSector = function (sectorExport, options, cb) {
      // Will not give any error whether it did anything or not, unless parameters are incorrect
      if (typeof cb == "function") {
        var sectorExportToUse = toStringIfPossible(sectorExport);
        if (typeof sectorExportToUse == "string") {
          return runSimpleCommand("/export_sector " + self.coords.toString() + " " + sectorExport, options, cb);
        }
        return cb(new Error("Invalid input given to SectorObj.exportSector as sectorExport!"), null);
      }
      return simplePromisifyIt(self.exportSector, options);
    }
    self.populate = function (options, cb) {
      // Will not give any error whether it did anything or not, unless parameters are incorrect
      // DESCRIPTION: WARNING: this will populate the sector. Use this as a reset after using /despawn_sector!
      if (typeof cb == "function") {
        return runSimpleCommand("/populate_sector " + self.coords.toString(), options, cb);
      }
      return simplePromisifyIt(self.populate, options);
    }
    self.repair = function (options, cb) {
      // WARNING - I think this is broken via StarNet.jar or through the console.  It ALWAYS gives the following error:
      // RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client, 0]
      // DESCRIPTION: attempts to correct the regitry of the sector
      if (typeof cb == "function") {
        return runSimpleCommand("/repair_sector " + self.coords.toString(), options, cb);
      }
      return simplePromisifyIt(self.repair, options);
    }





    self.spawnEntity = function (blueprintObj, shipName, factionNum, aiActiveBoolean, options, cb) {
      // factionNum and aiActive are optional
      // factionNum can be a faction object.
      if (typeof cb == "function") {
        var blueprintName = toStringIfPossible(blueprintObj);
        if (typeof blueprintName != "string") {
          return cb(new Error("Invalid input given to SectorObj.spawnEntity as blueprintObj!"), null);
        }
        var shipNameToUse = toStringIfPossible(shipName);
        if (typeof shipNameToUse != "string") {
          return cb(new Error("Invalid input given to SectorObj.spawnEntity as shipName!"), null);
        }

        var factionNumToUse = 0;
        if (testIfInput(factionNum)) { // If no input given, that is ok, we'll just use 0.
          var factionNumTest = toStringIfPossible(factionNum); // This handles a factionObj
          if (isNum(factionNumTest)) { // Will be true if the string is a number.
            factionNumToUse = factionNumTest;
          } else { // Some invalid string or object was given
            return cb(new Error("Invalid input given to SectorObj.spawnEntity as factionNum!"), null);
          }
        }
        var aiActiveBooleanToUse = false;
        if (testIfInput(aiActiveBoolean)) { // If no input, that is ok.  We'll just use false.
          if (isTrueOrFalse(aiActiveBoolean)) {
            aiActiveBooleanToUse = aiActiveBoolean;
          } else {
            return cb(new Error("Invalid input given to SectorObj.spawnEntity as aiActiveBoolean!"), null);
          }
        }
        return runSimpleCommand("/spawn_entity \"" + blueprintName + "\" \"" + shipNameToUse + "\" " + self.coords.toString() + " " + factionNumToUse + " " + aiActiveBooleanToUse, options, cb);
        // /spawn_entity // Also in the BlueprintObj
        // DESCRIPTION: Spawns a ship in any sector with a faction tag and AI tag.
        // PARAMETERS: BlueprintName(String), ShipName(String), X(Integer), Y(Integer), Z(Integer), factionID(Integer), ActiveAI(True/False)
        // EXAMPLE: /spawn_entity mySavedShip shipName sectorX sectorY sectorZ -1 true
      }
      return simplePromisifyIt(self.spawnEntity, options, blueprintObj, shipName, factionNum, aiActiveBoolean);
    }


    // Below needs to be brought up to the current standard of true=success,false=fail, throw error on connection problem.
    self.load = function (options, cb) {
      // This returns "true" if the command ran, false for anything else, such as if the server was down.
      if (typeof cb == "function") {
        return runSimpleCommand("/load_sector_range " + self.coords.toString() + " " + self.coords.toString(), options, cb);
      }
      return simplePromisifyIt(self.load, options);
    };
    self.setChmod = function (val, options, cb) { // val should be a string or an array of strings.
      // This will return true if it was a success, false otherwise.
      // Example vals:  "+ peace" or "- protected" <-- the space is required!
      if (typeof cb == "function") {
        if (Array.isArray(val)) {
          var promiseArray = [];
          for (let i = 0;i < val.length;i++) {
            promiseArray.push(self.setChmod(val[i], options)); // Build an array of promises
          }
          // I have no idea if this will work or what, but I think this is the right idea.
          // It's ambiguous what happens if an error happens.  Will they all still try to complete?  Will it stop?  I have no idea.
          return Promise.all(promiseArray).then(function (resultArray) {
            return cb(null, resultArray); // Returns an array of results?
          }, function (err) {
            return cb(err, null); // No idea what this returns?  An array of errors?  1 error?
          });




        } else {
          var theVal = toStringIfPossible(val);
          if (typeof theVal == "string") {
            console.log("Setting sectorchmod for sector, '" + self.coords + "', to: " + theVal);
            return sectorSetChmod(self.coords, theVal, options, cb);
          } else {
            return cb(new Error("Invalid input given to SectorObj.setChmod as val!"), null);
          }
        }

      }
      return simplePromisifyIt(self.setChmod, options, val);
    };
    self.getChmodNum = function (options, cb) {
      // This really should do a force save before pulling the values.. wish there was a way to do it silently..
      if (typeof cb == "function") {
        var theQuery = "SELECT PROTECTION FROM PUBLIC.SECTORS WHERE X=" + self.coords.x + " AND Y=" + self.coords.y + " AND Z=" + self.coords.x + ";";
        return sqlQuery(theQuery, options, function (err, theQueryResult) {
          if (err) {
            return cb(err, theQueryResult); // some StarNet error happened when performing the SQL query.
          }
          if (theQueryResult["error"] == false) { // No error happened, such as an invalid sql query.
            if (theQueryResult["objArray"].length > 0) {
              return cb(null, toNumIfPossible(theQueryResult["objArray"][0]["PROTECTION"])); // Return the number
            } else {
              return cb(null, 0); // No results found, so the sector is not in the DB yet.  Return default of 0.
            }
          }
          return cb(theQueryResult["error"], null); // An invalid SQL query was given.  This should never happen!
        });
      }
      return simplePromisifyIt(self.getChmodNum, options);
    };
    self.getChmodArray = function (options, cb) {
      // This really should do a force save before pulling the values.. wish there was a way to do it silently..
      if (typeof cb == "function") {
        return self.getChmodNum(options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          return cb(null, decodeChmodNum(result));
        });
      }
      return simplePromisifyIt(self.getChmodArray, options);
    };

    self.setChmodNum = function (newNum, options, cb) { // Only has 1 option, which is to do a forcesave and then intelligently add/remove chmod values rather than the default of bruteforcing adding all needed and removing all unneeded.
      if (typeof cb == "function") {
        var theNumToUse = toNumIfPossible(newNum);
        if (typeof theNumToUse == "number") {
          return starNetVerified(serverObj, "/force_save", options, async function (err) { // Not sure if this needs to be async
            if (err) {
              return cb(err, null);
            }
            var theCurrentChmodNum = await self.getChmodNum(options);
            var arrayToUse = [];
            var bruteOption = getOption(options, "bruteForce", false);
            if (bruteOption == false) {
              try {
                arrayToUse = getProtectionsDifferentialString(theCurrentChmodNum, theNumToUse);
              } catch (error) {
                return cb(error, null);
              }
            } else {
              try {
                arrayToUse = getChmodArrayFromNum(theNumToUse); // This is slower but guarantees results.
              } catch (error) {
                return cb(error, null);
              }
            }
            return self.setChmod(arrayToUse, options, cb);
          });
        }
        return cb(new Error("Invalid input given to SectorObj.setChmodNum for newNum!"), null);
      }
      return simplePromisifyIt(self.setChmodNum, options, newNum);
    }





    self.listEntityUIDs = function (filter, options, cb) {
      // If a filter is provided, it should include the FULL UID, including for example "ENTITY_SHIP_", unless type is given to options.
      // Options: { "type":["ship","station","shop","asteroid","creature","planet","player"] }
      // If a type is given, the filter will be placed AFTER the ENTITY_SHIP_, ENTITY_SHOP_,etc.
      // return returnEntityUIDListOld(self.coords.toString(),filter,options);
      if (typeof cb == "function") {
        return returnEntityUIDList(self.coords.toString(), filter, options, cb);
      }
      return simplePromisifyIt(self.listEntityUIDs, options, filter);
    };

    self.listShipUIDs = function (filter, options, cb) {
      return self.listEntityUIDs(filter, addOption(options, "type", "ship"), cb); // handles promises
    };
    self.listStationUIDs = function (filter, options, cb) {
      return self.listEntityUIDs(filter, addOption(options, "type", "station"), cb); // handles promises
    };
    self.listShopUIDs = function (filter, options, cb) {
      return self.listEntityUIDs(filter, addOption(options, "type", "shop"), cb); // handles promises
    };
    self.listCreatureUIDs = function (filter, options, cb) {
      return self.listEntityUIDs(filter, addOption(options, "type", "creature"), cb); // handles promises
    };
    self.listAsteroidUIDs = function (filter, options, cb) {
      return self.listEntityUIDs(filter, addOption(options, "type", "asteroid"), cb); // handles promises
    };
    self.listPlanetUIDs = function (filter, options, cb) {
      return self.listEntityUIDs(filter, addOption(options, "type", "planet"), cb); // handles promises
    };
    self.listPlayerUIDs = function (filter, options, cb) {
      return self.listEntityUIDs(filter, addOption(options, "type", "player"), cb); // handles promises
    };


    self.entities = function (filter, options, cb) {
      // "filter" is optional, it should look something like this "(ENTITY_SHIP_|ENTITY_CREATURE_)".  This will return all ships and creatures.
      // "options" are simply forwarded to the listEntityUIDs method and are also optional
      if (typeof cb == "function") {
        // var returnType=getOption(options,"type","any").toLowerCase();
        // console.log("From SectorObj.entities returnType: " + returnType); // temp
        // var methodToUse;
        // if (returnType=="any"){
        //   methodToUse="listEntityUIDs";
        // } else if (returnType=="ship"){
        //   methodToUse="listShipUIDs";
        // } else if (returnType=="shop"){
        //   methodToUse="listShopUIDs";
        // } else if (returnType=="asteroid"){
        //   methodToUse="listAsteroidUIDs";
        // } else if (returnType=="planet"){
        //   methodToUse="listPlanetUIDs";
        // } else if (returnType=="player"){
        //   methodToUse="listPlayerUIDs";
        // } else if (returnType=="creature"){
        //   methodToUse="listCreatureUIDs";
        // } else {
        //   throw new Error("Invalid option given to SectorObj.entities as 'type'!");
        // }
        // console.log("From SectorObj.entities methodToUse: " + methodToUse); // temp

        // return self[methodToUse](filter,options,function(err,uidArray){ // Switch this to directly using the self.listEntityUIDs with option to only return a certain type
        return self.listEntityUIDs(filter, options, function (err, uidArray) {
          if (err) {
            return cb(err, uidArray);
          }
          if (uidArray) {
            var returnArray = [];
            for (let i = 0;i < uidArray.length;i++) {
              // Set the correct type of object for each entity in the sector.  If new commands come out for planets or asteroids, we should prefer those types.
              if (uidArray[i].match(/^(ENTITY_SHIP_|ENTITY_SPACESTATION_|ENTITY_SHOP_|ENTITY_FLOATINGROCK_|ENTITY_FLOATINGROCKMANAGED_|ENTITY_PLANET_|ENTITY_PLANETCORE_)/)) {
                returnArray.push(new EntityObj(uidArray[i]));
              } else if (uidArray[i].match(/^(ENTITY_PLAYERCHARACTER_|ENTITY_PLAYERSTATE_)/)) {
                returnArray.push(new PlayerObj(uidArray[i]));
              } else if (uidArray[i].match(/^ENTITY_CREATURE_/)) {
                returnArray.push(new CreatureObj(uidArray[i]));
              }
            }
          }
          return cb(null, returnArray);
        });
      }
      return simplePromisifyIt(self.entities, options, filter);
    };
    self.ships = function (filter, options, cb) { // filter should be a string.  Can be a RegExp pattern.
      return self.entities(filter, addOption(options, "type", "ship"), cb); // handles promises
    };
    self.stations = function (filter, options, cb) {
      return self.entities(filter, addOption(options, "type", "station"), cb); // handles promises
    };
    self.shops = function (filter, options, cb) {
      return self.entities(filter, addOption(options, "type", "shop"), cb); // handles promises
    };
    self.creatures = function (filter, options, cb) { // This includes NPC's, spiders, hoppies, or custom creations
      return self.entities(filter, addOption(options, "type", "creature"), cb); // handles promises
    };
    self.asteroids = function (filter, options, cb) { // TODO: Consider creating an AsteroidObj as opposed to entity if there are commands that won't work correctly with them
      return self.entities(filter, addOption(options, "type", "asteroid"), cb); // handles promises
    };
    self.planets = function (filter, options, cb) { // TODO: Consider creating an PlanetObj as opposed to entity if there are commands that won't work correctly with them
      return self.entities(filter, addOption(options, "type", "planet"), cb); // handles promises
    };
    self.players = function (filter, options, cb) {
      return self.entities(filter, addOption(options, "type", "player"), cb); // handles promises
    };
    // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
    if (arguments.length > SectorObj.length) {
      var extraInfoArray = [];
      for (let i = SectorObj.length - 1;i < arguments.length;i++) {
        extraInfoArray.push(arguments[i]);
      }
      self.extraInfo = extraInfoArray;
    }
    // self.toString=function(){ return self.coords.toString() }; // We don't want to set this here because then it shows up as a key.  Instead we set up the prototype at the top of the script.
  } else {
    throw new Error("ERROR: Invalid values given to SectorObj constructor!");
  }
};

function CoordsObj(x, y, z) { // cb/promises/squish compliant
  // x can be a string or space or comma separated numbers, coordsObj, or a sectorObj
  // test to ensure string, array, CoordsObj, SectorObj, and regular numbers/strings(which are numbers) works.
  var self = this; // this is needed to reference the "this" of functions in other contexts, particularly for creating promises via the outside function.  If "this" is used, the promisify function will not work correctly.
  var xToTry = objectHelper.toNumIfPossible(x);
  var yToTry = objectHelper.toNumIfPossible(y);
  var zToTry = objectHelper.toNumIfPossible(z);
  var xToUse;
  var yToUse;
  var zToUse;
  if (typeof xToTry == "number" && typeof yToTry == "number" && typeof zToTry == "number") {
    xToUse = xToTry;
    yToUse = yToTry;
    zToUse = zToTry;
  } else if (typeof x == "string" && typeof yToTry == "undefined") { // This handles coords with spaces or commas
    var tempArray = [];
    if (x.indexOf(",") > "-1") { // comma separated values
      tempArray = x.split(",");
    } else if (x.indexOf(" ") > "-1") {
      tempArray = x.split(" "); // space separated values
    } else {
      throw new Error("Invalid string given as input to CoordsObj: " + xToTry);
    }
    if (tempArray.length == 3) {
      xToUse = objectHelper.toNumIfPossible(tempArray[0].trim());
      yToUse = objectHelper.toNumIfPossible(tempArray[1].trim());
      zToUse = objectHelper.toNumIfPossible(tempArray[2].trim());
    } else {
      console.error("Invalid amount of numbers given as string to CoordsObj. (" + tempArray.length + "): " + x);
      throw new Error("Invalid amount of numbers given as string to CoordsObj.");
    }
  } else if (typeof x == "object") { // This handles arrays or other objects
    if (objectHelper.getObjType(x) == "Array") {
      if (x.length == 3) {
        if (typeof x[0] == "number") { // This is necessary because .trim() will throw an error if attempted on a number
          xToUse = x[0];
        } else {
          xToUse = objectHelper.toNumIfPossible(x[0].trim());
        }
        if (typeof x[1] == "number") {
          yToUse = x[1];
        } else {
          yToUse = objectHelper.toNumIfPossible(x[1].trim());
        }
        if (typeof x[2] == "number") {
          zToUse = x[2];
        } else {
          zToUse = objectHelper.toNumIfPossible(x[2].trim());
        }
      } else {
        var errMsgObj = new Error("Invalid number of values given in array to CoordsObj (" + xToTry.length + "): " + xToTry);
        throw errMsgObj;
      }
    } else if (objectHelper.getObjType(x) == "CoordsObj" || objectHelper.getObjType(x) == "SectorObj") {
      var coordArrayTemp = x.toArray();
      xToUse = coordArrayTemp[0];
      yToUse = coordArrayTemp[1];
      zToUse = coordArrayTemp[2];
    } else {
      throw new Error("Invalid object input given to CoordsObj: " + xToTry);
    }
  }
  if (typeof xToUse != "number" || typeof yToUse != "number" || typeof zToUse != "number") {
    console.error("Invalid coords input given to new CoordsObj: " + xToUse + " " + yToUse + " " + zToUse);
    throw new Error("Invalid coords input given to new CoordsObj: " + xToUse + " " + yToUse + " " + zToUse);
  }
  self.x = xToUse;
  self.y = yToUse;
  self.z = zToUse;
  self.coords = function () {
    return new CoordsObj(self.x, self.y, self.z)
  }; // This is to allow a sectorObj to gracefully morph into a CoordsObj and for a CoordsObj to be duplicated and then possibly modified.


  // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
  if (arguments.length > CoordsObj.length) { // the CoordsObj.length gets the number of expected input vars
    var extraInfoArray = [];
    for (let i = CoordsObj.length - 1;i < arguments.length;i++) {
      extraInfoArray.push(arguments[i]);
    }
    self.extraInfo = extraInfoArray;
  }
  // self.toString=function(){ return self.string };
};

function CreatureObj(fullUID) { // Not usable right now since there are no creature commands that accept UID inputs
  // TODO: create creature object as an extension of EntityObj
  console.log("Complete me plz.");
  var self = this; // this is needed to reference the "this" of functions in other contexts, particularly for creating promises via the outside function.  If "this" is used, the promisify function will not work correctly.
  self.UID = stripFullUIDtoUID(fullUID);
  self.fullUID = fullUID;
};

function EntityObj(fullUID) { // cb/promises/squish compliant
  // TODO: Make this the basis for CreatureObj, ShipObj, StationObj, etc., for which each object extends from this, adding commands that work for that object type.

  // TODO:  Make this ONLY ACCEPT fullUID - figure out which events only give an entity name and change it to return a promise that returns an EntityObj instead.
  // takes EITHER the full UID or the ship name.  If a ship name is provided, it will look up the full UID via a StarNet.jar command.
  var self = this; // this is needed to reference the "this" of functions in other contexts, particularly for creating promises via the outside function.  If "this" is used, the promisify function will not work correctly.

  // This builds an entity object based on the full UID
  // This can be used for ships and stations.  // TODO: There will be PlanetObj for planets and AsteroidObj for asteroids if there are differences in what can or cannot be done to them.

  let fullUIDToUse = fullUID;
  // if (shipName){
  //   fullUIDToUse=starNet.getUIDfromNameSync(shipName);
  // }

  if (fullUIDToUse) {
    // console.log("Creating a new entity.  fullUID: " + fullUID + " shipName: " + shipName);
    self.UID = stripFullUIDtoUID(fullUIDToUse); // Returns the UID as used with SQL queries, without the "ENTITY_SHIP_" whatever stuff.
    this.fullUID = fullUIDToUse;

    // Needs testing below:
    // /entity_get_inventory ENTITY_SHIP_theShip 16 17 16
    // /entity_get_inventory ENTITY_SPACESTATION_testBase 16 17 16

    // Success Example (has multi-block in slot 1):
    // [ADMIN COMMAND] [SUCCESS] Listing entity SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)] inventory START
    // [INVENTORY] SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)]:  SLOT: 0; MULTI: false; TYPE: 1; META: -1; COUNT: 100
    // [INVENTORY] SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)]:  SLOT: 1; MULTI: true; TYPE: -32768; META: -1; COUNT: 50
    // [INVENTORY] SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)]: - SLOT: 0; MULTI: false; TYPE: 413; META: -1; COUNT: 10
    // [INVENTORY] SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)]: - SLOT: 1; MULTI: false; TYPE: 411; META: -1; COUNT: 10
    // [INVENTORY] SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)]: - SLOT: 2; MULTI: false; TYPE: 412; META: -1; COUNT: 10
    // [INVENTORY] SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)]: - SLOT: 3; MULTI: false; TYPE: 979; META: -1; COUNT: 10
    // [INVENTORY] SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)]: - SLOT: 4; MULTI: false; TYPE: 980; META: -1; COUNT: 10
    // [INVENTORY] SpaceStation[ENTITY_SPACESTATION_testBase(271)][(16, 17, 16)]:  SLOT: 2; MULTI: false; TYPE: 598; META: -1; COUNT: 10

    // Error Examples:
    // [ADMIN COMMAND] [ERROR] No inventory found at (16, 17, 17). (hold RShift to check block coordinates of looked at block)
    // [ADMIN COMMAND] [ERROR] No Entity found for UID 'ENTITY_SPACESTATION_testBase2'

    self.getStorage = function (relativeX, relativeY, relativeZ, options, cb) {
      // Takes the relative coordinates of a storage on the entity and returns an array of itemObjects
      // Note:  Can accept a coordsObj as the first parameter, but will require the relativeY and relativeZ to be blanked out.
      // var exampleItemObj={
      //     "multi":true,       // If this is true, it indicates it is part of a multi-block item; will otherwise be false.
      //     "slot":0,           // items part of a multi-block will all have the same slot
      //     "subSlot":0,        // Only items part of a multi-block will have a subSlot number
      //     "type":1,
      //     "count":100,
      //     "meta":-1
      // }
      var x = "";
      var y = "";
      var z = "";
      if (typeof cb == "function") {
        if (Array.isArray(relativeX)) {
          if (relativeX.length == 3) {
            try {
              x = toNumIfPossible(relativeX[0]);
              y = toNumIfPossible(relativeX[1]);
              z = toNumIfPossible(relativeX[2]);
            } catch (err) {
              return cb(new Error("Invalid array input given to EntityObj.getStorage()!  Expects x,y,z OR a CoordsObj!"), null);
            }
          } else {
            return cb(new Error("Invalid array input given to EntityObj.getStorage()!  Array should have 3 numbers!  Example: [1,2,3]"), null);
          }
        } else if (typeof relativeX == "object") {
          try {
            x = toNumIfPossible(relativeX.x);
            y = toNumIfPossible(relativeX.y);
            z = toNumIfPossible(relativeX.z);
          } catch (err) {
            return cb(new Error("Invalid object input given to EntityObj.getStorage()!  Expects x,y,z OR a CoordsObj!"), null);
          }
        } else {
          x = toNumIfPossible(relativeX);
          y = toNumIfPossible(relativeY);
          z = toNumIfPossible(relativeZ);
        }
        if (typeof x == "number" && typeof y == "number" && typeof z == "number") {
          return starNetVerified(`/entity_get_inventory "${self.fullUID}" ${x} ${y} ${z}`, options, function (err, resultString) {
            if (err) {
              return cb(err, null); // This indicates a connection error of some kind
            }
            let resultArray = resultString.replace("\r", "").split("\n");
            var slot = Number();
            var returnArray = []; // This will be returned with an array of itemObjects
            var itemObj = {};
            for (let i = 0;i < resultArray.length;i++) {
              if ((/^\[ADMIN COMMAND\] \[ERROR\] No inventory found.*/).test(resultArray[i])) {
                return cb(false, "noInventoryFound");
              } else if ((/^\[ADMIN COMMAND\] \[ERROR\] No Entity found.*/).test(resultArray[i])) {
                return cb(false, "noEntityFound");
              }
              if ((/\^[INVENTORY].*/).test(resultArray[i])) {
                if ((/; MULTI: true;/).test(resultArray[i])) { // Is it a multi-block?
                  slot = toNumIfPossible(resultArray[i].match(/(?<= {2}SLOT: )[^;]+/)); // Set the slot for the next line.
                  // Skip adding to the array. We are interested in the blocks that are actually within the multi-block, not the multi-block itself.
                } else {
                  itemObj = {}; // Reset the itemObj
                  // We will be adding an entry to the array here, but may or may not be adding subSlot data
                  if ((/: - SLOT: [0-9]+;/).test(resultArray[i])) { // Are are looking at a multi-slot item?
                    itemObj.multi = true; // Indicate it is part of a multi-block
                    itemObj.slot = slot; // Use the slot number previously set
                    itemObj.subSlot = toNumIfPossible(resultArray[i].match(/(?<= - SLOT: )[^;]+/));
                  } else { // For multi-slot items, multi will remain true till we reach an item that is not a multi slot
                    itemObj.multi = false;
                    itemObj.slot = toNumIfPossible(resultArray[i].match(/(?<= {2}SLOT: )[^;]+/));
                  }
                  itemObj.type = toNumIfPossible(resultArray[i].match(/(?<=; TYPE: )[^;]+/));
                  itemObj.count = toNumIfPossible(resultArray[i].match(/(?<=; COUNT: )[0-9]+/));
                  itemObj.meta = toNumIfPossible(resultArray[i].match(/(?<=; META: )[^;]+/));
                  returnArray.push(itemObj);
                }
              }
            }
            return cb(null, returnArray);
          });
        } else {
          return cb(new Error("Invalid input given to EntityObj.getStorage() for x,y, or z!"), null);
        }
      }
      return simplePromisifyIt(self.getStorage, options, relativeX, relativeY, relativeZ);
    }
    self.getStorageItemIDCount = function (relativeX, relativeY, relativeZ, itemID, options, cb) {
      // Returns the number of an item in a storage.  Will count up all items, including separated ones.
      if (typeof cb == "function") {
        if (typeof itemID == "number") {
          return self.getStorage(relativeX, relativeY, relativeZ, options, function (err, resultArray) {
            if (err) {
              return cb(err, null);
            } else if (err == false) {
              return cb(false, resultArray);
            }
            var resultNum = 0;
            for (let i = 0;i < resultArray.length;i++) {
              if (resultArray[i].hasOwnProperty("type")) {
                if (resultArray[i].type == itemID) {
                  if (resultArray[i].hasOwnProperty("count")) {
                    resultNum += resultArray[i].count; // There can be more than one if the blocks were split, so add them up.
                  }
                }
              }
            }
            return cb(null, resultNum);
          });
        } else {
          return cb(new Error("Invalid input given to EntityObj.getStorageItemIDCount() as itemID!  Expects a number!"), null);
        }
      } else {
        return simplePromisifyIt(self.getStorageItemIDCount, options, relativeX, relativeY, relativeZ, itemID);
      }
    };

    // /give_uid_storage_id ENTITY_SHIP_theShip 16 17 16 1 100
    // /give_uid_storage_id ENTITY_SPACESTATION_testBase 16 17 16 1 100

    // Success example:
    // [ADMIN COMMAND] [SUCCESS] Put 100 of Ship Core(1) into Ship[theShip](16); inventory Inventory: (Type3; Param 68720590864; SlotCount: 3); slot 2

    // Error examples:
    // [ADMIN COMMAND] [ERROR] Can't put amount of that ID into inventory
    // [ADMIN COMMAND] [ERROR] No inventory found at (16, 17, 17). (hold RShift to check block coordinates of looked at block)
    // [ADMIN COMMAND] [ERROR] No Entity found for UID 'ENTITY_SPACESTATION_testBase2'
    self.giveStorageItemID = function (relativeX, relativeY, relativeZ, itemIDToGive, numberToGive, options, cb) {
      // Takes the relative coordinates of a storage on the entity and places a number of an itemID into it.
      // Note:  Can accept a coordsObj or array as the first parameter, but will require the relativeY and relativeZ to be blanked out.
      if (typeof cb == "function") {
        var x = "";
        var y = "";
        var z = "";
        var itemID = toNumIfPossible(itemIDToGive);
        var number = toNumIfPossible(numberToGive);
        if (Array.isArray(relativeX)) {
          if (relativeX.length == 3) {
            try {
              x = toNumIfPossible(relativeX[0]);
              y = toNumIfPossible(relativeX[1]);
              z = toNumIfPossible(relativeX[2]);
            } catch (err) {
              return cb(new Error("Invalid array input given to EntityObj.giveStorageItemID()!  Expects x,y,z OR a CoordsObj!"), null);
            }
          } else {
            return cb(new Error("Invalid array input given to EntityObj.giveStorageItemID()!  Array should have 3 numbers!  Example: [1,2,3]"), null);
          }
        } else if (typeof relativeX == "object") {
          try {
            x = toNumIfPossible(relativeX.x);
            y = toNumIfPossible(relativeX.y);
            z = toNumIfPossible(relativeX.z);
          } catch (err) {
            return cb(new Error("Invalid object input given to EntityObj.giveStorageItemID()!  Expects x,y,z OR a CoordsObj!"), null);
          }
        } else {
          x = toNumIfPossible(relativeX);
          y = toNumIfPossible(relativeY);
          z = toNumIfPossible(relativeZ);
        }
        if (typeof x == "number" && typeof y == "number" && typeof z == "number" && typeof itemID == "number" && typeof number == "number") {
          return starNetVerified(`/give_uid_storage_id "${self.fullUID}" ${x} ${y} ${z} ${itemID} ${number}`, options, function (err, resultString) {
            if (err) {
              return cb(err, null); // This indicates a connection error of some kind
            }
            let resultArray = resultString.replace("\r", "").split("\n");
            for (let i = 0;i < resultArray.length;i++) {
              if ((/^\[ADMIN COMMAND\] \[ERROR\] No inventory found.*/).test(resultArray[i])) {
                return cb(false, "noInventoryFound");
              } else if ((/^\[ADMIN COMMAND\] \[ERROR\] No Entity found.*/).test(resultArray[i])) {
                return cb(false, "noEntityFound");
              } else if ((/^\[ADMIN COMMAND\] \[ERROR\] Can't put amount of that ID into inventory.*/).test(resultArray[i])) {
                return cb(false, "storageFull");
              }
              // [ADMIN COMMAND] [SUCCESS] Put 100 of Ship Core(1) into Ship[theShip](16); inventory Inventory: (Type3; Param 68720590864; SlotCount: 3); slot 2

              // [ADMIN COMMAND] [ERROR] Can't put amount of that ID into inventory
              // [ADMIN COMMAND] [ERROR] No inventory found at (16, 17, 17). (hold RShift to check block coordinates of looked at block)
              // [ADMIN COMMAND] [ERROR] No Entity found for UID 'ENTITY_SPACESTATION_testBase2'
            }
            return cb(null, true); // No errors were found, so it must have been successful
          });
        } else {
          return cb(new Error("Invalid input given to EntityObj.giveStorageItemID() for x,y, or z!"), null);
        }
      }
      return simplePromisifyIt(self.giveStorageItemID, options, relativeX, relativeY, relativeZ, itemID, number);
    }


    self.decay = function (options, cb) { // decays the ship
      console.debug("Decaying UID: " + self.fullUID);
      return runSimpleCommand("/decay_uid " + self.fullUID, options, cb); // handles promises
    }
    self.setFaction = function (factionNumOrObj, options, cb) { // Expects a faction number or FactionObj as input.
      if (typeof cb == "function") {
        let factionNum = toNumIfPossible(toStringIfPossible(factionNumOrObj)); // This converts FactionObj to a string and then back to a number.
        if (typeof factionNum == "number") {
          return runSimpleCommand("/faction_set_entity_uid " + self.fullUID + " " + factionNum, options, cb);
        } else {
          return cb(new Error("Invalid input given to EntityObj.setFaction() for factionNumOrObj!"), null);
        }
      }
      return simplePromisifyIt(self.setFaction, options, factionNumOrObj);
    }
    self.setFactionRank = function (rankNum, options, cb) {
      if (typeof cb == "function") {
        let theRankNum = toNumIfPossible(rankNum);
        if (typeof theRankNum == "number") {
          return runSimpleCommand("/faction_set_entity_rank_uid " + self.fullUID + " " + theRankNum, options, cb);
        } else {
          return cb(new Error("Invalid input given to EntityObj.setFactionRank() for rankNum!"), null);
        }
      }
      return simplePromisifyIt(self.setFactionRank, options, rankNum);
    }
    self.kickPlayersOut = function (options, cb) { // kicks any players out of the ship
      return runSimpleCommand("/kick_players_out_of_entity_uid \"" + self.fullUID + "\"", options, cb); // handles promises
    }
    self.kickPlayersOutDock = function (options, cb) { // kicks any players out of the ship and anything docked to it
      return runSimpleCommand("/kick_players_out_of_entity_uid_dock \"" + self.fullUID + "\"", options, cb);
    }
    self.putPlayerIntoThisEntity = function (thePlayer, options, cb) { // player can be their name or a PlayerObj
      if (typeof cb == "function") {
        let thePlayerName = toStringIfPossible(thePlayer); // This converts PlayerObj to the name of the player as a string
        if (typeof thePlayerName == "string") {
          return runSimpleCommand("/player_put_into_entity_uid " + thePlayerName + " \"" + self.fullUID + "\"", options, cb);
        } else {
          return cb(new Error("Invalid input given to EntityObj.putPlayerIntoThisEntity() for thePlayer!"), null);
        }
      } else {
        return simplePromisifyIt(self.putPlayerIntoThisEntity, options, thePlayer);
      }
    }
    self.saveAsBlueprint = function (blueprintName, options, cb) { // Saves the ship as a blueprint with no owner.  Can accept a BlueprintObj as input
      // Note:  Returns a BlueprintObj if successful instead of true
      if (typeof cb == "function") {
        let theBlueprintName = toStringIfPossible(blueprintName); // This converts BlueprintObj a string
        if (typeof theBlueprintName == "string") {
          return runSimpleCommand("/save_uid \"" + self.fullUID + "\" \"" + theBlueprintName + "\"", options, function (err, result) {
            if (err) {
              return cb(err, null);
            } else if (testIfInput(result)) { // The result could be 0, so a truthy check is a bad idea.
              return cb(null, new BlueprintObj(theBlueprintName)); // It would be a good idea for the mod to use this BlueprintObj to set the owner
            } else {
              return cb(null, false);
            }
          });
        } else {
          return cb(new Error("Invalid input given to EntityObj.saveAsBlueprint() for blueprintName!"), null);
        }
      }
      return simplePromisifyIt(self.saveAsBlueprint, options, blueprintName);
    }
    self.shopRestockFull = function (options, cb) { // restocks a shop to full
      // WARNING: If a station has a shop on it, it will be restocked incorrectly to include even illegal items that should never be found in a shop, such as gold bars and green dirt.
      return runSimpleCommand("/shop_restock_full_uid \"" + self.fullUID + "\"", options, cb); // handles promises
    }
    self.shopRestock = function (options, cb) { // restocks a shop
      // WARNING: If a station has a shop on it, it will be restocked incorrectly to include even illegal items that should never be found in a shop, such as gold bars and green dirt.
      return runSimpleCommand("/shop_restock_uid \"" + self.fullUID + "\"", options, cb); // handles promises
    }
    self.softDespawn = function (options, cb) { // despawns an entity as though it were destroyed, till the sector is reloaded.
      // WARNING: if an entity has docked entities on it and it is soft-despawns, I believe this causes them to undock.
      return runSimpleCommand("/soft_despawn \"" + self.fullUID + "\"", options, cb);
    }
    self.softDespawnDock = function (options, cb) { // despawns an entity (and all docked entities) as though it were destroyed, till the sector is reloaded.
      return runSimpleCommand("/soft_despawn_dock \"" + self.fullUID + "\"", options, cb);
    }
    self.setMinable = function (trueOrFalse, options, cb) { // Sets whether an entity should be minable by salvager beams
      if (typeof cb == "function") {
        let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
        // Does not have success or fail messages
        if (isTrueOrFalse(booleanToUse)) {
          return runSimpleCommand("/structure_set_minable_uid \"" + self.fullUID + "\" " + booleanToUse, options, cb);
        } else {
          return cb(new Error("Invalid input given to EntityObj.setMinable() for trueOrFalse!"), null);
        }
      }
      return simplePromisifyIt(self.setMinable, options, trueOrFalse);
    }
    self.setVulnerable = function (trueOrFalse, options, cb) { // Sets whether an entity is invincible
      if (typeof cb == "function") {
        let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
        // Does not have success or fail messages
        if (isTrueOrFalse(booleanToUse)) {
          return runSimpleCommand("/structure_set_vulnerable_uid \"" + self.fullUID + "\" " + booleanToUse, options, cb);
        } else {
          return cb(new Error("Invalid input given to EntityObj.setVulnerable() for trueOrFalse!"), null);
        }
      }
      return simplePromisifyIt(self.setVulnerable, options, trueOrFalse);
    }
    self.changeSector = function (sector, options, cb) { // sector can be a LocationObj, SectorObj, CoordsObj, or other input that can be translated to a CoordsObj.
      // This should accept a location Obj, a pair of sectorObj and coordsObj, or any other pair of input that can translate to a CoordsObj
      if (typeof cb == "function") {
        var sectorToUse;
        if (testIfInput(sector)) { // Non-object input given
          // sectorToUse=toStringIfPossible(sector); // This converts any obj, including SectorObj, CoordsObj, and LocationObj to a string
          sectorToUse = sector; // We should not make it into a string, in case an array is given.
          try { // Let's see if coordinates can be made from the input.  A String (separated by , or spaces) or an Array can be given as input.
            sectorToUse = new CoordsObj(sectorToUse).toString();
          } catch (error) { // Invalid input given.
            return cb(new Error("Invalid input given to EntityObj.changeSector as sector!"), null);
          }
        } else { // Invalid amount of arguments given
          return cb(new Error("No sector value given EntityObj.changeSector for sector!"), null);
        }
        if (typeof sectorToUse == "string") {
          // We should be all set to send the command now.
          var fast = getOption(options, "fast", false);
          var changeSectorCommand = "/change_sector_for_uid \"" + self.fullUID + "\" " + sectorToUse;
          if (fast) {
            return sendDirectToServer(changeSectorCommand, cb);
          } else {
            return starNetVerified(serverObj, changeSectorCommand, options, function (err, result) {
              if (err) {
                return cb(err, result);
              }
              // Success: RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS] changed sector for Benevolent27 to (1000, 1000, 1000), 0]
              // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client Benevolent27, 0]
              var theReg = new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[SUCCESS\\]");
              if (starNet.checkForLine(result, theReg)) { // The command succeeded.
                return cb(null, Boolean(true));
              } else { // The command failed.  Player either offline or does not exist for some reason.
                return cb(null, Boolean(false));
              }
            }); // This will throw an error if the connection to the server fails.
          }
        }
        return cb(new Error("Invalid parameters given to EntityObj.changeSector!"), null); // This is redundant
      }
      return simplePromisifyIt(self.changeSector, options, sector);
    }
    // self.changeSectorCopy // There is no "/change_sector_for_uid_copy" command in-game right now.
    self.teleportTo = function (coords, options, cb) { // Accepts CoordsObj or LocationObj or any set of input that will translate to a CoordsObj
      if (typeof cb == "function") {
        if (testIfInput(coords)) { // Input given
          var spacialCoordsToUse;
          if (Array.isArray(coords)) {
            spacialCoordsToUse = coords;
          } else {
            spacialCoordsToUse = toStringIfPossible(coords, {"type": "spacial"}); // This option will allow a LocationObj to have it's spacial coords converted to as tring.  Any other object, such as a CoordsObj will ignore the option.
          }
          try { // Let's see if coordinates can be made from the input.  If a LocationObj was provided, the string returned will work.
            spacialCoordsToUse = new CoordsObj(spacialCoordsToUse).toString();
          } catch (error) { // Invalid input given.
            return cb(new Error("Invalid input given to EntityObj.teleportTo for coords!"), null);
          }
        }
        var fast = getOption(options, "fast", false);
        // I'm not using runSimpleCommand() since I know what the success message is for this, and this provides better accuracy on the success/fail result.
        if (typeof spacialCoordsToUse == "string" && testIfInput(coords)) { // This is a redundant check.
          var teleportToCommand = "/teleport_uid_to \"" + self.fullUID + "\" " + spacialCoordsToUse;
          if (fast) {
            return sendDirectToServer(teleportToCommand, cb);
          } else {
            return starNetVerified(serverObj, teleportToCommand, options, function (err, result) {
              if (err) {
                return cb(err, result);
              }
              // Success: RETURN: [SERVER, [ADMIN COMMAND] teleported Benevolent27 to , 0]
              // Fail: RETURN: [SERVER, [ADMIN COMMAND] [ERROR] player not found for your client, 0]
              var theReg = new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] teleported");
              if (starNet.checkForLine(result, theReg)) { // The command succeeded.
                return cb(null, Boolean(true));
              } else { // The command failed.  Player either offline or does not exist for some reason.
                return cb(null, Boolean(false));
              }
            }); // This will throw an error if the connection to the server fails.
          }
        }
        return cb(new Error("Invalid parameters given EntityObj.teleportTo for coords!"), null); // This is redundant and should never happen.
      }
      return simplePromisifyIt(self.teleportTo, options, coords);
    }

    this.dataMap = function (options, cb) {
      // return new starNet.ShipInfoUidObj(self.fullUID);
      if (typeof cb == "function") {
        return starNetVerified(serverObj, "/ship_info_uid \"" + self.fullUID + "\"", options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          return cb(null, mapifyShipInfoUIDString(result, options));
        });
      }
      return simplePromisifyIt(self.dataMap, options);
    }; // TODO:  This seems broken
    this.dataObj = function (options, cb) {
      // return new starNet.ShipInfoUidObj(self.fullUID,{"objType":"object"})
      if (typeof cb == "function") {
        return starNetVerified(serverObj, "/ship_info_uid \"" + self.fullUID + "\"", options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          return cb(null, mapifyShipInfoUIDString(result, addOption(options, "objType", "object")));
        });
      }
      return simplePromisifyIt(self.dataObj, options);
    }; // TODO:  This seems broken


    this.isLoaded = function (options, cb) {
      return starNet.getEntityValue(self.fullUID, "loaded", options, cb); // handles promises
    };
    this.faction = function (options, cb) {
      // faction.number is WILDLY INACCURATE RIGHT NOW - WAITING ON FIX FROM SCHEMA - WILL NEED TO BE FIXED IN starNet.js
      if (typeof cb == "function") {
        return starNet.getEntityValue(self.fullUID, "faction", options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          if (testIfInput(result)) {
            return cb(null, new FactionObj(result));
          } else {
            return cb(null, Boolean(false));
          }
        });
      }
      return simplePromisifyIt(self.faction, options);
    };

    this.mass = function (options, cb) {
      return starNet.getEntityValue(self.fullUID, "Mass", options, cb)
    };
    this["attached"] = function (options, cb) {
      // TODO: Change this to return an array of objects that are attached.  Players I think normally?  Are NPC's also possible though?  Needs testing.
      return starNet.getEntityValue(self.fullUID, "Attached", options, cb); // handles promises
    };

    this["dockedUIDs"] = function (options, cb) {
      // TODO: Change this to "docked", which will return an array of EntityObjs
      // Note:  Currently nothing seems to be returned in this field anymore.
      return starNet.getEntityValue(self.fullUID, "DockedUIDs", options, cb); // handles promises
    };
    this.blocks = function (options, cb) {
      return starNet.getEntityValue(self.fullUID, "Blocks", options, cb); // handles promises
    };

    this.lastModified = function (options, cb) {
      // TODO: See what sorts of values might appear for lastModified and have it return the correct types of objects rather than a string value
      return starNet.getEntityValue(self.fullUID, "LastModified", options, cb); // handles promises 
    };
    this.creator = function (options, cb) {
      // TODO: See what sorts of values might appear for creator and have it return the correct types of objects rather than a string value
      return starNet.getEntityValue(self.fullUID, "Creator", options, cb); // handles promises 
    };
    this.sector = function (options, cb) {
      if (typeof cb == "function") {
        return starNet.getEntityValue(self.fullUID, "Sector", options, function (err, result) {
          if (err) {
            return cb(err, result);
          } else if (result) {
            return cb(null, new SectorObj(result));
          } else {
            return cb(null, result);
          }
        });
      }
      return simplePromisifyIt(self.sector, options);
    };
    this.system = function (options, cb) {
      if (typeof cb == "function") {
        return self.sector(options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          return cb(null, result.system);
        });
      }
      return simplePromisifyIt(self.system, options);
    }
    this.spacialCoords = function (options, cb) {
      if (typeof cb == "function") {
        return starNet.getEntityValue(self.fullUID, "Local-Pos", options, function (err, result) {
          if (err) {
            return cb(err, result);
          } else if (result) {
            return cb(null, new CoordsObj(...result));
          } else {
            return cb(null, result);
          }
        });
      }
      return simplePromisifyIt(self.spacialCoords, options);
    };



    this.name = function (options, cb) {
      return starNet.getEntityValue(self.fullUID, "Name", options, cb)
    };
    this.exists = function (options, cb) {
      if (typeof cb == "function") {
        return self.name(options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          if (testIfInput(result)) {
            return cb(null, true);
          }
          return cb(null, false);
        });
      }
      return simplePromisifyIt(self.exists, options);
    }
    this.minBB = function (options, cb) {
      if (typeof cb == "function") {
        return starNet.getEntityValue(self.fullUID, "MinBB(chunks)", options, function (err, result) {
          if (err) {
            return cb(err, result);
          } else if (result) {
            return cb(null, new CoordsObj(...result));
          } else {
            return cb(null, result);
          }
        });
      }
      return simplePromisifyIt(self.minBB, options);
    };
    this.maxBB = function (options, cb) {
      if (typeof cb == "function") {
        return starNet.getEntityValue(self.fullUID, "MaxBB(chunks)", options, function (err, result) {
          if (err) {
            return cb(err, result);
          } else if (result) {
            return cb(null, new CoordsObj(...result));
          } else {
            return cb(null, result);
          }
        });
      }
      return simplePromisifyIt(self.maxBB, options);
    };
    // TODO: Create an OrientationObj. Till then though, just return an array of values.
    this.orientation = function (options, cb) {
      return starNet.getEntityValue(self.fullUID, "Orientation", options, cb); // handles promises  
    };
    this.type = function (options, cb) {
      // Will return 
      return starNet.getEntityValue(self.fullUID, "type", options, cb); // handles promises 
    };
    this.typeNumber = function (options, cb) {
      // Returns a number representing the type of entity this is:
      // 1: ENTITY_SHOP_
      // 2: ENTITY_SPACESTATION_
      // 3: ENTITY_FLOATINGROCK_
      // 4: ENTITY_PLANET_
      // 5: ENTITY_SHIP_
      // 6: ENTITY_FLOATINGROCKMANAGED_

      // Returns undefined if the entity does not have a world file entry yet
      if (typeof cb == "function") {
        return simpleSqlQuery(serverObj, `SELECT TYPE FROM PUBLIC.ENTITIES WHERE UID='${self.UID}';`, options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          if (result.length > 0) {
            return cb(null, Number(result[0]["TYPE"])); // There should only ever be 1 result, if the system is claimed.
          } else {
            return cb(null); // If no result, the system is not claimed.
          }
        });
      }
      return simplePromisifyIt(self.typeNumber, options);
    }
    this.touched = function (options, cb) {
      // Returns a true/false, depending on whether a player has interacted with the entity.  Does not count damage.
      // Returns undefined if the entity does not exist in the world file yet.
      if (typeof cb == "function") {
        return simpleSqlQuery(serverObj, `SELECT TOUCHED FROM PUBLIC.ENTITIES WHERE UID='${self.UID}';`, options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          if (result.length > 0) {
            return cb(null, Boolean(result[0]["TOUCHED"])); // There should only ever be 1 result, if the system is claimed.
          }
          return cb(null); // If no result, the entity does not exist in the world file yet or the UID is invalid.
        });
      }
      return simplePromisifyIt(self.typeNumber, options);
    }

    this.dockedTo = function (options, cb) {
      // Returns an EntityObj of the entity this entity is docked to.  
      // Returns null if not docked
      // Returns undefined if not in the world file yet.
      if (typeof cb == "function") {
        return simpleSqlQuery(serverObj, `SELECT DOCKED_TO FROM PUBLIC.ENTITIES WHERE UID='${self.UID}';`, options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          if (result.length > 0) {
            if (result != "-1") {
              var dockedTo = result[0]["DOCKED_TO"];
              return simpleSqlQuery(serverObj, `SELECT UID,TYPE FROM PUBLIC.ENTITIES WHERE ID='${dockedTo}'`, options, function (err, result) {
                if (err) {
                  return cb(err, result);
                }
                let entityPrefix = getEntityPrefixFromPublicEntitiesTypeNumber(result[0]["TYPE"]);
                let fullUID = entityPrefix + result[0]["UID"];
                return cb(null, new EntityObj(fullUID)); // There should only ever be 1 result, if the system is claimed.
              });

            }
            return cb(null, null); // entity is not docked

          } else {
            return cb(null); // If no result, the entity does not exist in the world file yet or the UID is invalid.  This will be undefined.
          }
        });
      }
      return simplePromisifyIt(self.dockedTo, options);
    }
    this.dockedToRoot = function (options, cb) {
      // Returns an EntityObj of the root entity this entity is docked to.  
      // Returns null if not docked
      // Returns undefined if not in the world file yet.
      if (typeof cb == "function") {
        return simpleSqlQuery(serverObj, `SELECT DOCKED_ROOT FROM PUBLIC.ENTITIES WHERE UID='${self.UID}';`, options, function (err, result) {
          if (err) {
            return cb(err, result);
          }
          if (result.length > 0) {
            if (result != "-1") {
              var dockedTo = result[0]["DOCKED_ROOT"];
              return simpleSqlQuery(serverObj, `SELECT UID,TYPE FROM PUBLIC.ENTITIES WHERE ID='${dockedTo}'`, options, function (err, result) {
                if (err) {
                  return cb(err, result);
                }
                let entityPrefix = getEntityPrefixFromPublicEntitiesTypeNumber(result[0]["TYPE"]);
                let fullUID = entityPrefix + result[0]["UID"];
                return cb(null, new EntityObj(fullUID)); // There should only ever be 1 result, if the system is claimed.
              });
            }
            return cb(null, null); // entity is not docked

          } else {
            return cb(null); // If no result, the entity does not exist in the world file yet or the UID is invalid.  This will be undefined.
          }
        });
      }
      return simplePromisifyIt(self.dockedTo, options);
    }


    self.load = function (options, cb) {
      // This returns "true" if the command ran, false for anything else, such as if the server was down.
      if (typeof cb == "function") {
        return self.sector(options, function (err, theSector) {
          if (err) {
            return cb(err, theSector);
          } else if (theSector) { // Will be false or null if there was some problem
            return theSector.load(options, cb); // Will provide error or true/false value on success/fail.
          } else {
            return cb(null, theSector); // Command connected but failed for some reason.
          }

        })
      }
      return simplePromisifyIt(self.load, options);
    };
    // self.toString=function(){ return self.fullUID.toString() }; // This is visible as an element, so really we should set the prototype outside of the constructor.

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

// Support Functions

function ipWhitelist(ipAddress, minutes, options, cb) { // minutes are optional.  A perm ban is applied if none provided. options are optional
  if (ipAddress) {
    var ipToUse = ipAddress.toString(); // This allows ipObj's to be fed in, and this should translate to an ip string.
    if (minutes) {
      var minutesNum = toNumIfPossible(minutes);
      if (typeof minutesNum == "number") {
        console.log("Whitelisting IP, '" + ipAddress + "' for " + minutesNum + " minutes.");
        return starNetVerified(serverObj, "/whitelist_ip_temp " + ipToUse + " " + minutesNum, options, function (err, result) {
          if (err) {
            console.error("ERROR when attempting to whitelist IP, '" + ipToUse + "'!  Could not send command via StarNet.jar!");
            return cb(err, result);
          }
          return cb(null, starNet.detectSuccess2(result));
        });
      } else { // invalid minutes given
        return cb(new Error("Invalid minutes specified for ipWhitelist!"), null);
      }
    } else {
      // no minutes provided, so perform a perm ban
      console.log("Whitelisting IP, '" + ipAddress + "'!");
      return starNetVerified(serverObj, "/whitelist_ip " + ipToUse, options, function (err, result) {
        if (err) {
          console.error("ERROR whitelisting ip: " + ipAddress);
          return cb(err, result);
        }
        return cb(null, starNet.detectSuccess2(result));
      });
    }
  } else {
    return cb(new Error("No ipAddress given to function, 'ipWhitelist'!"), null);
  }
};


function ipBan(ipAddress, minutes, options, cb) { // minutes are optional.  A perm ban is applied if none provided. options are optional
  if (ipAddress) {
    var ipToUse = ipAddress.toString(); // This allows ipObj's to be fed in, and this should translate to an ip string.
    if (minutes) {
      var minutesNum = toNumIfPossible(minutes);
      if (typeof minutesNum == "number") {
        console.log("Banning IP, '" + ipAddress + "' for " + minutesNum + " minutes.");
        return starNetVerified(serverObj, "/ban_ip_temp " + ipToUse + " " + minutesNum, options, function (err, result) {
          if (err) {
            console.error("ERROR when attempting to ban IP, '" + ipToUse + "'!  Could not send command via StarNet.jar!");
            return cb(err, result);
          }
          return cb(null, starNet.detectSuccess2(result));
        });
      } else { // invalid minutes given
        return cb(new Error("Invalid minutes specified for ipBan!"), null);
      }
    } else {
      // no minutes provided, so perform a perm ban
      console.log("PERMANENT banning IP, '" + ipAddress + "'!");
      return starNetVerified(serverObj, "/ban_ip " + ipToUse, options, function (err, result) {
        if (err) {
          console.error("ERROR banning ip: " + ipAddress);
          return cb(err, result);
        }
        return cb(null, starNet.detectSuccess2(result));
      });
    }
  } else {
    return cb(new Error("No ipAddress given to function, 'ipBan'!"), null);
  }
};

function ipUnBan(ipAddress, options, cb) { // options are optional and should be an object.
  if (ipAddress) {
    var ipToUse = ipAddress.toString(); // This allows ipObj's to be fed in, and this should translate to an ip string.
    console.log("Unbanning IP: " + ipAddress);
    return starNetVerified(serverObj, "/unban_ip " + ipToUse, options, function (err, result) {
      if (err) {
        console.error();
        return cb(err, result);
      }
      return cb(null, starNet.detectSuccess2(result));
    }); // This will return false if the ip is not found in the blacklist
  } else {
    return cb(new Error("No ipAddress given to function, 'ipUnBan'!"), null);
  }
};

function createDateObjIfPossible(input) { // Takes either a date string that "new Date" can turn into an object, passes along a Date object fed to it, or returns false if no new Date could be created.
  // This can be used to return a date object from some dates provided by StarMade directly, such as the ip dates returned by the /player_info command.
  if (typeof input != "undefined" && input != "" && getObjType(input) != "Null") { // if an input is nulled out using null, it actually appears as an "object" to typeof
    if (getObjType(input) == "Date") {
      return input; // If the input was already a Date object, just return it
    } else {
      try {
        var dateTest = new Date(input);
        if (dateTest.toString() == "Invalid Date") { // If invalid input is given, return false
          return false;
        }
        return dateTest;

      } catch (err) {
        return false; // Returns false if creating the data object threw an error.
      }
    }
  }
  return false; // Returns false if no input given
};

function decodeChmodNum(num) { // runs as Sync
  // A number should be provided, but a number as a string should be coerced into a number.
  // This converts a chmod number value from a sql query to an array of strings, such as ["peace","protected","noindications"].  Values are always returned in an array, even if only a single protection is in the number.  A 0 number will return an empty array.
  var theNum = toNum(num);
  if (typeof theNum == "number") {
    var returnArray = [];
    var numberOfProtections = sectorProtectionsArray.length;
    var exponentValue = numberOfProtections - 1;
    var highestValue = Math.pow(2, exponentValue); // The "highestValue" is what each potential value in the array represents, starting with the first value in the array
    var highestTotal = Math.pow(2, numberOfProtections);
    var errorMsg;
    if (num <= highestTotal && num > 0) { // Valid numbers can only be lower/equal to the highest total or larger than 0
      for (let i = 0;i < sectorProtectionsArray.length && theNum > 0;i++) {
        if (theNum >= highestValue) {
          returnArray.push(sectorProtectionsArray[i]);
          theNum -= highestValue
        }
        highestValue /= 2; // Halve it!
      }
    } else if (theNum > highestTotal) {
      errorMsg = "ERROR: Number given to decodeChmodNum function was too large!  It should be no more than " + highestTotal + "!";
      throw new Error(errorMsg);
    } else if (theNum < 0) {
      errorMsg = "ERROR: Number given to decodeChmodNum function was too small!  It should always be an integer larger than 0!";
      throw new Error(errorMsg);
    }
    return returnArray;
  } else {
    throw new Error("ERROR: Invalid input given to function, decodeChmodNum!  Expected a number!");
  }
};

function sectorSetChmod(coordsObj, chmodString, options, cb) { // Performs a single sectorChmod
  // Simple example:  sectorSetChmod(mySectorObj,"+ protected"); // This sets the sector number from mySectorObj to add protected, returning true or false depending on the success.
  try {
    var theCoordsObj = new CoordsObj(coordsObj); // Allows this to use any input a coordsObj can accept
  } catch (err) {
    console.error(new Error("Invalid input given to sectorSetChmod() for coordsObj!"));
    return cb(err, null);
  }
  var theChmodString = toStringIfPossible(chmodString);
  if (typeof theChmodString == "string") {
    let coordsObjString = toStringIfPossible(theCoordsObj);
    if (typeof coordsObjString == "string") {
      theChmodString = theChmodString.toLowerCase();
      let theCommand = "/sector_chmod " + coordsObj.toString() + " " + theChmodString;
      return starNetVerified(serverObj, theCommand, options, function (err, result) {
        if (err) {
          return cb(err, result);
        }
        return cb(null, starNet.detectSuccess(result)); // returns true/false based on success message
      });
    } else {
      return cb(new Error("Invalid input given to sectorSetChmod() for coordsObj!!"), null); // Redundant
    }
  } else {
    return cb(new Error("Invalid input given to sectorSetChmod() for chmodString!"), null);
  }
};

function getChmodArrayFromNum(newChmodNum) { // This outputs the chmod values for a chmod number as an array, including values it should have and subtracting values it should NOT have
  // Example: [ "+ protected","+ peace","- nofploss","- noindications","- noexit","- noenter" ]
  // This kind of array can be fed directly to the sectorSetChmod function.
  var outputArray = [];
  var chmodValuesToGive = decodeChmodNum(newChmodNum);
  var chmodValuesToRemove = getInverseProtectionsArrayFromNum(newChmodNum);
  for (let i = 0;i < chmodValuesToGive.length;i++) {
    outputArray.push("+ " + chmodValuesToGive[i]);
  }
  for (let e = 0;e < chmodValuesToRemove.length;e++) {
    outputArray.push("- " + chmodValuesToRemove[e]);
  }
  return outputArray;
};

function getProtectionsDifferentialString(currentProtectNum, newProtectNum) { // The current sector protection number and what the new number should be
  // Returns an array of strings to set and remove needed chmod values based on what the end result should be.
  var currentProtection = decodeChmodNum(currentProtectNum);
  var whatItNeeds = decodeChmodNum(newProtectNum);
  var whatItDoesntNeed = getInverseProtectionsArrayFromArray(whatItNeeds); // These are all the values it should not have
  var whatItNeedsAdded = subArrayFromAnother(currentProtection, whatItNeeds); // This ensures we're only adding what it needs
  var whatItNeedsRemoved = findSameFromTwoArrays(currentProtection, whatItDoesntNeed); // This ensures we're only removing a chmod it already has
  var outputArray = [];
  for (let i = 0;i < whatItNeedsAdded.length;i++) {
    outputArray.push("+ " + whatItNeedsAdded[i]);
  }
  for (let i = 0;i < whatItNeedsRemoved.length;i++) {
    outputArray.push("- " + whatItNeedsRemoved[i]);
  }
  return outputArray; // An array of strings, ready for chmodding
};

function getInverseProtectionsArrayFromNum(num) {
  var array = decodeChmodNum(num);
  return getInverseProtectionsArrayFromArray(array);
};

function getInverseProtectionsArrayFromArray(arrayToInvert, baseProtectionsArray) { // baseProtectionsArray is optional.  This is used to whittle down based on pre-existing protections, scheduling for removal.
  var arrayToUse = [];
  if (baseProtectionsArray) {
    arrayToUse = copyArray(baseProtectionsArray);
  } else {
    arrayToUse = copyArray(regExpHelper.sectorProtections);
  }
  return subArrayFromAnother(arrayToInvert, arrayToUse);
};


function returnEntityUIDList(coords, beginFilter, options, cb) {
  // TODO: Add an option to only return certain type(s). { "type":["one","or","more","types"]}
  // beginFilter can be a string or an array of strings

  // coords can be a string that can convert to a CoordsObj, a SectorObj, CoordsObj, or a LocationObj
  // beginFilter should be a string.  It can be a RegExp pattern, but should not be /regexp/.  But just regexp

  // TODO: Test to ensure the options for filtering work
  // Example: returnEntityUIDList("2 2 2")
  // Example2: returnEntityUIDList("2 2 2","ENTITY_SHIP_");
  // Example3: returnEntityUIDList("2 2 2","ENTITY_SHIP_",{spawnerFilter:"Benevolent27",lastModifierFilter:"Benevolent27",uidFilter:"TheShip",nameFilter:"TheShipName",factionFilter:"10000",touchedFilter:true});

  // TODO: Implement the option filtering.
  // Returns an array of strings of UID's.  Does NOT convert to objects!
  // Returns null if the command failed for some reason.
  // Examples:
  // returnEntityUIDList("2 2 2"); // Returns all entities in the sector
  // returnEntityUIDList("2 2 2","ENTITY_SHIP_"); // Returns only ships in the sector
  // returnEntityUIDList("2 2 2","ENTITY_SHIP_|ENTITY_SPACESTATION_"); // Returns ships and stations in the sector

  var type = getOption(options, "type", "any"); // By default return any
  // console.debug("Using type: " + type);
  var theTypeArray = [];

  if (type != "any") {
    var typeArray = [];
    if (Array.isArray(type)) {
      typeArray = type;
    } else {
      typeArray.push(type);
    }
    // console.debug("typeArray: " + typeArray);
    for (let i = 0;i < typeArray.length;i++) {
      // More than 1 type can be included.  Any filter will be added to the END
      if (typeArray[i] == "ship") {
        theTypeArray.push("ENTITY_SHIP_");
      } else if (typeArray[i] == "station") {
        theTypeArray.push("ENTITY_SPACESTATION_");
      } else if (typeArray[i] == "shop") {
        theTypeArray.push("ENTITY_SHOP_");
      } else if (typeArray[i] == "creature") {
        theTypeArray.push("ENTITY_CREATURE_");
      } else if (typeArray[i] == "asteroid") {
        theTypeArray.push("ENTITY_FLOATINGROCK_");
        theTypeArray.push("ENTITY_FLOATINGROCKMANAGED_");
      } else if (typeArray[i] == "planet") {
        theTypeArray.push("ENTITY_PLANET_");
        theTypeArray.push("ENTITY_PLANETCORE_");
      } else if (typeArray[i] == "player") {
        theTypeArray.push("ENTITY_PLAYERCHARACTER_");
        theTypeArray.push("ENTITY_PLAYERSTATE_");
      }
    }
  }
  // console.debug("theTypeArray: " + theTypeArray);
  // console.debug("theTypeArray.length: " + theTypeArray.length);


  try {
    var theSector = new SectorObj(coords);
    var theCoords = theSector.toString();
  } catch (err) {
    console.error(err);
    throw new Error("Invalid input given to returnEntityUIDList as 'coords'!  (Expect coordinates!)");
  }

  var theReg = new RegExp("");
  // console.debug("beginFilter: " + beginFilter);
  // console.debug("typeof beginFilter: " + typeof beginFilter);
  var filterArray = [];
  if (typeof beginFilter == "string") {
    filterArray.push(beginFilter);
  } else if (Array.isArray(beginFilter)) {
    filterArray = beginFilter;
  } else if (typeof beginFilter != "undefined" && beginFilter !== null && beginFilter != "") {
    throw new Error("Invalid input given to returnEntityUIDList as beginFilter!");
  }


  var finalFilterArray = [];
  if (theTypeArray.length > 0) {
    for (let i = 0;i < theTypeArray.length;i++) { // add types to the beginning of each filter.
      if (filterArray.length > 0) {
        for (let e = 0;e < filterArray.length;e++) {
          finalFilterArray.push(theTypeArray[i] + filterArray[e]);
        }
      } else { // If no filters given, just push the type as the filter.
        finalFilterArray.push(theTypeArray[i]);
      }
    }
  } else { // No types were given, so just use the filter Array.
    finalFilterArray = filterArray;
  }
  // console.debug("finalFilterArray:" + finalFilterArray);
  var finalFilterRegArray = [];
  var tempValue;
  for (let i = 0;i < finalFilterArray.length;i++) {
    tempValue = toStringIfPossible(finalFilterArray[i]);
    if (typeof tempValue == "string") { // String check all the filters given and only add valid ones.
      finalFilterRegArray.push(tempValue)
    } else { // If not a string, discard it, with an error.
      console.error("Invalid input given to returnEntityUIDList as beginFilter!  Skipping!");
    }
  }

  if (finalFilterRegArray.length > 0) { // Build the uid filter
    for (let i = 0;i < finalFilterRegArray.length;i++) {
      finalFilterRegArray[i] = "uid=" + finalFilterRegArray[i] + "[^,]*";
    }
    theReg = new RegExp(finalFilterRegArray.join("|")); // Make it a regExp
  } else { // No filters were given
    theReg = new RegExp("uid=[^,]*");
  }
  console.debug("finalFilterRegArray: " + finalFilterRegArray);

  // Check for options
  var checkSpawner = getOption(options, "spawnerFilter", false);
  if (checkSpawner !== false) {
    var spawnerRegExp = new RegExp("spawner=" + options["spawnerFilter"] + ","); // It MUST end in a , so the filter is looking at the spawner full spawner data.  Partial matches will not be included.
  }
  var checkLastModifier = getOption(options, "lastModifierFilter", false);
  if (checkLastModifier !== false) {
    var lastModifierRegExp = new RegExp("lastModifier=" + options["lastModifierFilter"] + ",");
  }
  var checkUID = getOption(options, "uidFilter", false);
  if (checkUID !== false) {
    var uidRegExp = new RegExp("uid=" + options["uidFilter"] + ",");
  }
  var checkName = getOption(options, "nameFilter", false);
  if (checkName !== false) {
    var nameRegExp = new RegExp("realName=" + options["nameFilter"] + ",");
  }
  var checkFaction = getOption(options, "factionFilter", false);
  if (checkFaction !== false) {
    var factionRegExp = new RegExp("faction=" + options["factionFilter"] + ",");
  }
  var checkIfTouched = trueOrFalse(getOption(options, "touchedFilter", "false24352345345234534"));
  if (checkIfTouched !== "false24352345345234534") {
    var touchedRegExp;
    if (checkIfTouched == true) {
      touchedRegExp = new RegExp("touched=true,");
    } else if (checkIfTouched == false) {
      touchedRegExp = new RegExp("touched=false,");
    }
  }
  var checkSpacialCoords = getOption(options, "betweenSpacialCoordsFilter", false);
  if (checkSpacialCoords !== false) {
    // Should be an array of values that can be made into CoordsObj (could be CoordsObj's)
    if (Array.isArray(checkSpacialCoords)) {
      if (checkSpacialCoords.length == 2) {
        try {
          var spacialCoordsFilterPointAObj = new CoordsObj(checkSpacialCoords[0]);
          var spacialCoordsFilterPointBObj = new CoordsObj(checkSpacialCoords[1]);
        } catch (err) {
          throw new Error("Invalid option given to returnEntityUIDList as 'betweenSpacialCoordsFilter'!  Expected an Array containing two coordinates! (input was not coordinates!)");
        }


      } else {
        throw new Error("Invalid option given to returnEntityUIDList as 'betweenSpacialCoordsFilter'!  Expected an Array containing TWO coordinates! (Invalid number of inputs in array)");
      }
    } else {
      throw new Error("Invalid option given to returnEntityUIDList as 'betweenSpacialCoordsFilter'!  Expected an Array containing two coordinates! (non-array input given)");
    }
  }


  if (typeof theCoords == "string") {
    // This will return an array of entities within the sector
    // Todo: Add an option to convert from full UID to hsql uid
    var shipListResults = "";
    return theSector.load(options, function (err, results) {
      if (err) {
        console.error("ERROR:  Could not load sector!");
        return cb(err, results);
      }
      return starNetVerified(serverObj, "/sector_info " + theCoords, options, function (err, shipListResults) {
        if (err) {
          console.error("Error getting sector_info for sector: " + theCoords);
          return cb(err, shipListResults);
        }
        var resultsArray = shipListResults.split("\n");
        resultsArray.pop(); // Remove "command execution ended" line
        resultsArray.pop(); // Remove the sector info line
        var returnResults = [];
        var entityUID = {};


        var proceed;
        for (let i = 0;i < resultsArray.length;i++) { // If there were any results, cycle through them one by one
          // example: RETURN: [SERVER, DatabaseEntry [uid=ENTITY_SHIP_TopolM_1526337858159, sectorPos=(2, 2, 2), type=5, seed=0, lastModifier=ENTITY_PLAYERSTATE_TopolM, spawner=ENTITY_PLAYERSTATE_TopolM, realName=TopolM_1526337858159, touched=true, faction=0, pos=(121.83931, 271.8866, -1257.7705), minPos=(-2, -2, -2), maxPos=(2, 2, 2), creatorID=0], 0]
          entityUID = resultsArray[i].match(theReg);
          if (entityUID) { // will be null if no match found on this line
            proceed = true;
            if (spawnerRegExp) {
              if (!resultsArray[i].match(spawnerRegExp)) {
                proceed = false;
              }
            }
            if (lastModifierRegExp && proceed) {
              if (!resultsArray[i].match(lastModifierRegExp)) {
                proceed = false;
              }
            }
            if (uidRegExp && proceed) {
              if (!resultsArray[i].match(uidRegExp)) {
                proceed = false;
              }
            }
            if (nameRegExp && proceed) {
              if (!resultsArray[i].match(nameRegExp)) {
                proceed = false;
              }
            }
            if (factionRegExp && proceed) {
              if (!resultsArray[i].match(factionRegExp)) {
                proceed = false;
              }
            }
            if (touchedRegExp && proceed) {
              if (!resultsArray[i].match(touchedRegExp)) {
                proceed = false;
              }
            }
            if (checkSpacialCoords !== false && proceed) {
              // TODO: Create the function that can compare a set of floating point coordinates against a set
              // Example (loaded and unloaded):
              // pos=(121.83931, 271.8866, -1257.7705) // Can be an E type value, so make sure to convert during the check.
              var posResult = resultsArray[i].match(/pos=[(][0-9, .E-][)]/)
              if (posResult) { // This is redundant, there should ALWAYS be a match, but just in case..
                var posString = posResult[0].replace(/^pos=[(]/, "").replace(/[)]$/, "");
                var posCoordsObj = new CoordsObj(posString); // This converts any E numbers to floating point
                if (!areCoordsBetween(posCoordsObj, spacialCoordsFilterPointAObj, spacialCoordsFilterPointBObj)) {
                  proceed = false;
                }
              } else { // I guess the entity didn't have spacial coords somehow?
                proceed = false;
              }
            }
            if (proceed) { // If all tests passed, then push the UID
              returnResults.push(entityUID[0].replace(/^uid=/, "")); // Grab the first value from the match object created to get the string. Don't use .toString() because this doesn't work right when using | either/or type regex patterns on the uid filter
            }

          }
        }
        return cb(null, returnResults); // Outputs an array of UIDs
      });
    });
  } else {
    throw new Error("Invalid input given to returnEntityUIDList as Coords!");
  }
};

// applyFunctionToArray(theArray,function(input){ return new PlayerObj(input) })

function splitHelper1(result, matchReg, regExpToRem, regExpToRem2, functionToRunOnEachValue) {
  // takes input from banlist or whitelist, producing an array, running a function on each one.
  // example:  splitHelper1(result,matchReg,regExpToRem,regExpToRem2,makePlayerObj){
  var outputArray = [];
  var functionToRun = functionToRunOnEachValue;
  var theLine = returnLineMatch(result, matchReg, regExpToRem, regExpToRem2);
  if (theLine) { // this will be empty if there were no results
    var tempArray = theLine.split(", "); // If only 1 result, it will still be in an array
    for (let i = 0;i < tempArray.length;i++) {
      outputArray.push(functionToRun(tempArray[i]));
    }
  }
  return outputArray;
}

function splitHelper1CB(command, options, matchReg, regExpToRem, regExpToRem2, functionToRunOnEachValue, cb) {
  // takes input from banlist or whitelist, producing an array, running a function on each one.
  return starNetVerifiedCB(serverObj, command, options, function (err, result) {
    if (err) {
      return cb(err, null);
    } else {
      return cb(null, splitHelper1(result, matchReg, regExpToRem, regExpToRem2, functionToRunOnEachValue)); // Will be empty array if no results
    }
  });
}

function compareToObjectArrayToString(inputArray, whatToLookFor, options) {
  // Used when checking if a player or entity is in a list, such as for bans/whitelists.  Can be used to check an array of entities returned from a sector to see if a certain entity is there.
  // Accepts input of an array, running .toString() on each result. // Sets both sides to lowercase, unless option is set to false
  var doLowerCase = getOption(options, "toLowerCase", true);
  var theCheck;
  if (doLowerCase) {
    theCheck = whatToLookFor.toString().toLowerCase(); // Allows objects that can be turned into strings to be used as input
    for (let i = 0;i < inputArray.length;i++) {
      if (inputArray[i].toString().toLowerCase() == theCheck) {
        return true
      }
    };
  } else {
    theCheck = whatToLookFor.toString(); // Allows objects that can be turned into strings to be used as input
    for (let i = 0;i < inputArray.length;i++) {
      if (inputArray[i].toString() == theCheck) {
        return true
      }
    };
  }
  return false;
}

function splitHelper2(result, matchReg, regExpToRem, regExpToRem2, functionToRunOnEachValue) {
  // takes input from commands like /player_list where we want to isolate specific lines
  // and then isolate a single word, producing an array, running a function on each one, such
  // as turning each word into an object type.

  // For example, if we run a /player_list command and feed the output here and the regex's
  // needed to select the line, then remove the first part and the last part
  // example:  splitHelper1(result,matchReg,regExpToRem,regExpToRem2,makePlayerObj){
  var outputArray = [];
  var functionToRun = functionToRunOnEachValue;
  var resultsArray = returnMatchingLinesAsArray(result, matchReg);
  var theLine;
  for (let i = 0;i < resultsArray.length;i++) {
    theLine = theLine.replace(regExpToRem, "").replace(regExpToRem2, "");
    if (theLine) {
      outputArray.push(functionToRun(theLine));
    }
  }
  return outputArray;
}

function splitHelper2CB(command, options, matchReg, regExpToRem, regExpToRem2, functionToRunOnEachValue, cb) {
  // takes input from /player_list, producing an array, running a function on each one.
  return starNetVerifiedCB(serverObj, command, options, function (err, result) {
    if (err) {
      return cb(err, null);
    } else {
      return cb(null, splitHelper2(result, matchReg, regExpToRem, regExpToRem2, functionToRunOnEachValue)); // Will be empty array if no results
    }
  });
}





function makePlayerObj(input) {
  return new PlayerObj(input);
}

function getPlayerList(options, cb) { // Returns an array of player objects for all online players or false if the starNet command fails.
  // returns an array of all online players.  The array will be empty if nobody is online.
  var matchReg = /^RETURN: \[SERVER, \[PL\] Name: .*/;
  var regExpToRem = /^RETURN: \[SERVER, \[PL\] Name: {/;
  var regExpToRem2 = /, 0]$/;
  var theCommand = "/player_list";
  var theFunctionToRunOnEachResult = makePlayerObj;
  var theErrorMsg = "StarNet error running getPlayerList()!";
  if (typeof cb == "function") {
    return splitHelper2CB(theCommand, options, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult, cb);
  } else {
    try {
      var result = starNetVerified(serverObj, theCommand, options);
      return splitHelper2(result, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult);
    } catch (error) {
      console.error(theErrorMsg);
      throw error;
    }
  }
}

function getWhitelistedNameList(options, cb) {
  // /list_whitelist_name
  // RETURN: [SERVER, Whitelisted: {six, four, five}, 0]
  var matchReg = /^RETURN: \[SERVER, Whitelisted: {.*/;
  var regExpToRem = /^RETURN: \[SERVER, Whitelisted: {/;
  var regExpToRem2 = /}, 0\]$/;
  var theCommand = "/list_whitelist_name";
  var theFunctionToRunOnEachResult = makePlayerObj;
  var theErrorMsg = "StarNet error running getWhitelistedNameList()!";
  if (typeof cb == "function") {
    return splitHelper1CB(theCommand, options, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult, cb);
  } else {
    try {
      var result = starNetVerified(serverObj, theCommand, options);
      return splitHelper1(result, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult);
    } catch (error) {
      console.error(theErrorMsg);
      throw error;
    }
  }
}

function getBannedNameList(options, cb) {
  // TODO:  Add {"fast":true} option to read directly from the blacklist.txt file.
  // /list_banned_name
  // RETURN: [SERVER, Banned: {six, four, five}, 0]
  var matchReg = /^RETURN: \[SERVER, Banned: {.*/;
  var regExpToRem = /^RETURN: \[SERVER, Banned: {/;
  var regExpToRem2 = /}, 0\]$/;
  var theCommand = "/list_banned_name";
  var theFunctionToRunOnEachResult = makePlayerObj;
  var theErrorMsg = "StarNet error running getBannedNameList()!";
  if (typeof cb == "function") {
    return splitHelper1CB(theCommand, options, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult, cb);
  } else {
    try {
      var result = starNetVerified(serverObj, theCommand, options);
      return splitHelper1(result, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult);
    } catch (error) {
      console.error(theErrorMsg);
      throw error;
    }
  }
}

function getAdminsList(options, cb) { // TODO:  Test this.. there are 4 ways of doing things.
  // Returns an array of PlayerObj, will be an empty array if no admins returned
  // Note: ALWAYS RETURNS NAMES IN LOWERCASE
  // example:
  // RETURN: [SERVER, Admins: {thrace_vega=>thrace_vega, andyp=>andyp, weedle=>weedle, modr4de=>modr4de, melvin=>melvin, build_lonebluewolf=>build_lonebluewolf, arkwulff=>arkwulff, dukeofrealms=>dukeofrealms, borednl=>borednl, mod_lonebluewolf=>mod_lonebluewolf, mod_caribe=>mod_caribe, benevolent27=>benevolent27, pezz=>pezz, lancake=>lancake, nikodaemos=>nikodaemos, char_aznable=>char_aznable, mod_flagitious=>mod_flagitious, arbiter=>arbiter, benevolent37=>benevolent37, nastral=>nastral, benevolent327=>benevolent327}, 0]
  // options can be {"fast":true}, which will cause this scripting to read from the admins.txt file in the StarMade folder rather than run the command.
  // another option can be {"unrestricted":true}, which will only return admins that have no restrictions - note that this forces reading from the admins.txt file.
  let unrestricted = trueOrFalse(getOption(options, "unrestricted", false));
  let fast = trueOrFalse(getOption(options, "fast", false));
  if (unrestricted) {
    fast = true; // The fileread method MUST be used if showing only unrestricted admins
  }
  var theError = "ERROR:  Connection failed when attempting to get list of admins!";
  var theReadError = "ERROR: Problem reading admins.txt file:"
  var theReg = /^RETURN: \[SERVER, Admins: {.*/;
  var remReg = /^RETURN: \[SERVER, Admins: {/;
  var remReg2 = /}, 0\]$/;
  var processLine;
  var processArray = []; // Note:  I have no idea if this will work as a callback function converted to a promise with this sync in here.
  var adminsTxtFile = path.join(global.starMadeInstallFolder, "admins.txt");
  var adminFileContentsArray = [];
  var outputArray = [];
  if (fast == true) { // Perform file read style
    return fs.readFile(adminsTxtFile, "UTF-8", function (err, data) { // node.js documentation has 'utf8' as it's example.. maybe we should use that?
      if (err) {
        console.error(theReadError);
        console.dir(err);
        return cb(err, data);
      } else {
        var adminFileContents = data.replace(/\r/g, "");
        if (adminFileContents) {
          adminFileContentsArray = adminFileContents.split("\n");
          for (let i = 0;i < adminFileContentsArray.length;i++) {
            if (adminFileContentsArray[i].trim()) { // Test to see if the line is blank or not.  Only process it if there is text.
              if (unrestricted) { // Only add the playerObj if it is an unrestricted admin
                if (!(/#.*$/).test(adminFileContentsArray[i])) {
                  outputArray.push(new PlayerObj(adminFileContentsArray[i].replace(/#.*$/g, "").trim()));
                }
              } else {
                outputArray.push(new PlayerObj(adminFileContentsArray[i].replace(/#.*$/g, "").trim()));
              }
            }
          }
        }
        return cb(null, outputArray);
      }
    });
  } else { // Use StarNet to get admin list
    return starNetVerified(serverObj, "/list_admins", options, function (err, result) {
      if (err) {
        console.error(theError);
        return cb(err, result);
      } else {
        processLine = returnLineMatch(result, theReg, remReg, remReg2);
        processArray = processLine.split(", ");
        for (let i = 0;i < processArray.length;i++) {
          outputArray.push(new PlayerObj(processArray[i].split("=>")[0]));
        }
        return cb(null, outputArray);
      }
    });
  }
};


function isPlayerOnline(name, options, cb) { // Expects a string or PlayerObj as input for name.  Returns true if the player is online, false if not.
  return getPlayerList(options, function (err, resultArray) {
    if (err) {
      return cb(err, null);
    } else {
      return cb(null, compareToObjectArrayToString(resultArray, name));
    }
  });
}

function isPlayerAdmin(name, options, cb) {
  return getAdminsList(options, function (err, result) {
    if (err) {
      return cb(err, result);
    } else {
      return cb(null, compareToObjectArrayToString(result, name));
    }
  });
}

function isNameWhitelisted(name, options, cb) { // cb is optional
  return getWhitelistedNameList(options, function (err, resultArray) {
    if (err) {
      return cb(err, null);
    } else {
      return cb(null, compareToObjectArrayToString(resultArray, name));
    }
  });
}

function isNameBanned(name, options, cb) { //cb is optional.  Runs Sync if not given.  Options will be added to allow a "fast" option, which will read from the blacklist.txt file.
  return getBannedNameList(options, function (err, resultArray) {
    if (err) {
      return cb(err, null); // Could not get Banned name list, so pass on the error
    } else {
      return cb(null, compareToObjectArrayToString(resultArray, name)); // isBanned is a Sync function.
    }
  });
}


function makeSMNameObj(input) {
  return new SMNameObj(input);
}

function getBannedAccountsList(options, cb) { // Returns an array of SMNameObj
  // RETURN: [SERVER, Banned: {three, two, one}, 0]
  var matchReg = /^RETURN: \[SERVER, Banned: {.*/;
  var regExpToRem = /^RETURN: \[SERVER, Banned: {/;
  var regExpToRem2 = /}, 0\]$/;
  var theCommand = "/list_banned_accounts";
  var theFunctionToRunOnEachResult = makeSMNameObj;
  return splitHelper1CB(theCommand, options, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult, cb);
}

function getWhitelistedAccountsList(options, cb) { // Returns an array of SMNameObj
  // RETURN: [SERVER, Whitelisted: {three, two, one}, 0]
  var matchReg = /^RETURN: \[SERVER, Whitelisted: {.*/;
  var regExpToRem = /^RETURN: \[SERVER, Whitelisted: {/;
  var regExpToRem2 = /}, 0\]$/;
  var theCommand = "/list_whitelist_accounts";
  var theFunctionToRunOnEachResult = makeSMNameObj;
  return splitHelper1CB(theCommand, options, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult, cb);
}

function isAccountWhitelisted(account, options, cb) {
  return getWhitelistedAccountsList(options, function (err, resultArray) {
    if (err) {
      return cb(err, null);
    } else {
      return cb(null, compareToObjectArrayToString(resultArray, account));
    }
  });
}

function isAccountBanned(account, options, cb) {
  return getBannedAccountsList(options, function (err, resultArray) {
    if (err) {
      return cb(err, null);
    } else {
      return cb(null, compareToObjectArrayToString(resultArray, account));
    }
  });
}


function makeIPObj(input) {
  return new IPObj(input);
}

function getWhitelistedIPList(options, cb) {
  // RETURN: [SERVER, Whitelisted: {1.2.3.6, 1.2.3.5, 1.2.3.4}, 0]
  var matchReg = /^RETURN: \[SERVER, Whitelisted: {.*/;
  var regExpToRem = /^RETURN: \[SERVER, Whitelisted: {/;
  var regExpToRem2 = /}, 0\]$/;
  var theCommand = "/list_whitelist_ip";
  var theFunctionToRunOnEachResult = makeIPObj;
  return splitHelper1CB(theCommand, options, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult, cb);
}

function getBannedIPList(options, cb) {
  // RETURN: [SERVER, Banned: {1.2.3.6, 1.2.3.5, 1.2.3.4}, 0]
  var matchReg = /^RETURN: \[SERVER, Banned: {.*/;
  var regExpToRem = /^RETURN: \[SERVER, Banned: {/;
  var regExpToRem2 = /}, 0\]$/;
  var theCommand = "/list_banned_ip";
  var theFunctionToRunOnEachResult = makeIPObj;
  return splitHelper1CB(theCommand, options, matchReg, regExpToRem, regExpToRem2, theFunctionToRunOnEachResult, cb);
}

function isIPWhitelisted(ip, options, cb) {
  return getWhitelistedIPList(options, function (err, resultArray) {
    if (err) {
      return cb(err, null);
    } else {
      return cb(null, compareToObjectArrayToString(resultArray, ip));
    }
  });
}

function isIPBanned(ip, options, cb) {
  return getBannedIPList(options, function (err, resultArray) {
    if (err) {
      return cb(err, null);
    } else {
      return cb(null, compareToObjectArrayToString(resultArray, ip));
    }
  });
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
// TODO: Create a function that gives a specific protection a value based on the sectorProtections array.
// TODO: Create a function that converts an array of protection names to a total number

function getPlayerSpawnLocationFromResults(result) { // sync function
  // RETURN: [SERVER, [ADMINCOMMAND][SPAWN][SUCCESS] PlS[Benevolent27 ; id(2)(1)f(10002)] spawn currently absolute; sector: (2, 2, 2); local position: (8.0, -6.5, 0.0), 0]
  // RETURN: [SERVER, END; Admin command execution ended, 0]

  var resultArray = result.trim().split("\n");
  // RETURN: [SERVER, [PL] Name: Benevolent27, 0]
  var theReg = /^RETURN: \[SERVER, \[ADMINCOMMAND\]\[SPAWN\]\[SUCCESS\]/;
  for (let i = 0;i < resultArray.length;i++) {
    if (theReg.test(resultArray[i])) {
      // This will only trigger if there is a success.  All the data is on one line.
      // RETURN: [SERVER, [ADMINCOMMAND][SPAWN][SUCCESS] PlS[Benevolent27 ; id(2)(1)f(10002)] spawn currently absolute; sector: (2, 2, 2); local position: (8.0, -6.5, 0.0), 0]
      // Scientific E notation: RETURN: [SERVER, [ADMINCOMMAND][SPAWN][SUCCESS] PlS[Benevolent27 ; id(2)(1)f(10002)] spawn currently absolute; sector: (2, 2, 2); local position: (0.01E5, -6.5, 0.0), 0]
      var sectorCoords = resultArray[i].match(/sector: \([-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+/).toString().replace(/sector: \(/, "").
split(", ");
      var sectorObj = new SectorObj(sectorCoords);
      var spacialCoords = resultArray[i].match(/position: \([-]{0,1}[0-9]+[.]{0,1}[0-9]*[eE]{0,1}[0-9]*, [-]{0,1}[0-9]+[.]{0,1}[0-9]*[eE]{0,1}[0-9]*, [-]{0,1}[0-9]+[.]{0,1}[0-9]*[eE]{0,1}[0-9]*/).toString().replace(/position: \(/, "").
split(", "); // Supports scientific e notation, which is used sometimes for spacial coordinates.
      var coordsObj = new CoordsObj(spacialCoords);
      // Returns a LocationObj, which has the sector and spacial coordinates in it.
      return new LocationObj(sectorObj, coordsObj);
    }
  }
  // If failed, the player is offline:
  // RETURN: [SERVER, [ADMINCOMMAND][SPAWN] Player not found, 0]
  return false; // The player must have been offline.
}

function getPlayerSpawnLocation(player, options, cb) {
  if (typeof cb == "function") {
    return starNetVerified(serverObj, "/player_get_spawn " + player, options, function (err, result) {
      if (err) {
        return cb(err, result);
      } else {
        return cb(null, getPlayerSpawnLocationFromResults(result));
      }
    });
  }
  return simplePromisifyIt(getPlayerSpawnLocation, options, player);
}

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
        } else if (starNet.checkForLine(msgResult, msgTestFail) || starNet.checkForLine(msgResult, msgTestFail2)) { // The player was offline, did not exist, or other parameters were incorrect.
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


function convertSectorToSystem(sectorObj) {
  var sectorArray = sectorObj.toArray();
  var systemArray = convertSectorCoordsToSystem(sectorArray);
  return new SystemObj(systemArray);
}

function convertSectorCoordsToSystem(array) {
  if (Array.isArray(array)) {
    let outputArray = [];
    for (let i = 0;i < array.length;i++) {
      outputArray.push(getSysCoordFromSector(array[i]));
    }
    console.log("Sector: " + array + "  System: " + outputArray);

    return outputArray;
  }
  throw new Error("ERROR: Invalid input given to convertSectorCoordsToSystem! (Expects an array)");
}

function getSysCoordFromSector(input) {
  if (testIfInput(input)) {
    var theInput = toNumIfPossible(input);
    if (typeof theInput == "number") {
      if (theInput >= 0) {
        // Positive numbers need an offset of 1 because -1 is in -1 system, except where the value is divisible by 16, whereas 1 is in 0 system.
        // console.log("theInput%16: " + theInput%16);
        if (theInput % 16 == "0") {
          return Math.floor(theInput / 16);
        } else {
          // console.log("theInput/16: " + theInput/16);
          return Math.floor((theInput / 16)); // - 1;
        }
      } else {
        return Math.ceil(((theInput * -1) + 1) / 16) * -1;
      }
    }
    throw new Error("Invalid input given to getSysCoordFromSector! (must be a number!)");
  }
  throw new Error("Invalid input given to getSysCoordFromSector! (Cannot be empty)");
}

function getEntityPrefixFromPublicEntitiesTypeNumber(input) {
  if (input == 1) {
    return "ENTITY_SHOP_";
  } else if (input == 2) {
    return "ENTITY_SPACESTATION_";
  } else if (input == 3) {
    return "ENTITY_FLOATINGROCK_";
  } else if (input == 4) {
    return "ENTITY_PLANET_";
  } else if (input == 5) {
    return "ENTITY_SHIP_";
  } else if (input == 6) {
    return "ENTITY_FLOATINGROCKMANAGED_";
  }
  throw new Error("Invalid input given to getEntityPrefixFromPublicEntitiesTypeNumber!  (Needs number 1-6)");
}
