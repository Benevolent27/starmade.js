if (__filename == require.main.filename) {
  console.log("This script should not be ran by itself!  Exiting..");
  process.exit();
}

module.exports = { // Always put module.exports at the top so circular dependencies work correctly.
  // init, // This is needed so objects can send text directly to the server
  ServerObj
}

// Requires
const fs = require('fs');
const path = require('path');
// const EventEmitter = require('events');
// class Event extends EventEmitter {};
const prompt = global["prompt"]; // This creates sync prompts and can have auto-complete capabilties.
// const events               = require('events');
const mainFolder = path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself for testing purposes.
const binFolder = path.join(mainFolder, "bin");
const spawn = require('child_process').spawn;
const miscHelpers = require(path.join(binFolder, "miscHelpers.js"));
const {requireBin} = miscHelpers;

// const objectCreator = requireBin("objectCreator.js"); // This is imported for the CustomConsole object
const objectHelper = requireBin("objectHelper.js");
const regExpHelper = requireBin("regExpHelper.js");
const ini = requireBin("iniHelper.js");
const installAndRequire = requireBin("installAndRequire.js");
const sleep = requireBin("mySleep.js").softSleep;
const sleepSync = global["sleepSync"];
const sleepPromise = requireBin("mySleep.js").sleepPromise;

// TODO:  Below needs to be fixed, because they require a serverObj to initialize correctly
const modBinFolder = path.join(__dirname, "bin");
const setSettings = require(path.join(modBinFolder, "setSettings.js")); // This will confirm the settings.json file is created and the install folder is set up.
const sqlQueryJs = require(path.join(__dirname, "sqlQuery.js"));
const starNetJs = require(path.join(__dirname, "starNet.js"));
const serverObjects = require(path.join(__dirname, "serverObjects.js"));
const smInstallHelpers = require(path.join(modBinFolder, "smInstallHelpers.js"));
const lineProcessor = require(path.resolve(__dirname, "lineProcessor.js"));
const {
  processDataInput,
  processServerlogDataInput
} = lineProcessor; // These cannot be used till the ServerObj has been created since it relies on creating objects from the serverObj.
// NPM installable requires
const treeKill = installAndRequire('tree-kill', '^1.2.1'); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes
// const isInvalidPath = installAndRequire("is-invalid-path",'^1.0.2'); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
// const exitHook      = installAndRequire('exit-hook','2.2.0'); // https://github.com/sindresorhus/exit-hook Handles normal shutdowns, sigterm, sigint, and a "message=shutdown" event.  Good for ensuring the server gets shutdown.
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
  starNetVerified,
  returnMatchingLinesAsArray,
  runSimpleCommand,
  sendDirectToServer
} = starNetJs;
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
const {
  areCoordsBetween,
  isPidAlive,
  ensureFolderExists,
  existsAndIsDirectory,
  existsAndIsFile,
  isSeen,
  writeJSONFileSync,
  getSimpleDate,
  getSimpleTime,
  waitAndThenKill
} = miscHelpers;
// const {CustomConsole} = objectCreator; // This is now created by starmade.js and placed on the installObj

// Import all the server objects
var { 
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
  getProtectionsDifferentialString,
  getChmodArrayFromNum,
  squish,
  unSquish,
  isSquishable,
  getPlayerList,
  getWhitelistedNameList,
  getWhitelistedAccountsList,
  getWhitelistedIPList,
  getAdminsList,
  getBannedAccountsList,
  getBannedNameList,
  getBannedIPList
} = serverObjects;


var installObj=global.getInstallObj(__dirname);
var {event,settings,log,installPath}=installObj;

async function getSuperAdminPassword(starMadeInstallPath) { // This will grab the superadmin password, setting it up and enabling it if not already.
  // TODO: Offload this to a require
  // Load the server.cfg from install path
  var serverCfgFile = path.join(starMadeInstallPath, "StarMade", "server.cfg");
  var serverCfgObj = ini.getFileAsObj(serverCfgFile);
  var superAdminPassword = ini.getVal(serverCfgObj, "SUPER_ADMIN_PASSWORD");
  var superAdminPasswordEnabled = ini.getVal(serverCfgObj, "SUPER_ADMIN_PASSWORD_USE");
  if (superAdminPasswordEnabled) { // Only perform .toLowerCase() if the value exists to avoid crashing the script.
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
    await sleepSync(2000);
    // serverCfgObj["SUPER_ADMIN_PASSWORD"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD"],newSuperAdminPassword);
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

// TODO: Fix recording
function getRecordFileName() {
  if (miscHelpers.isSeen(recordingFile)) {
    recordingCounter++;
    recordingFile = path.join(__dirname, recordFileName + recordingCounter + ".log");
    return getRecordFileName();
  } else {
    return path.join(__dirname, recordFileName + recordingCounter + ".log");
  }
}

function dumpToRecordFile(options, cb) {
  if (typeof cb == "function") {
    var stringToWrite = recordingArray.join("\n");
    recordingArray = [];
    return fs.writeFile(getRecordFileName(), stringToWrite, cb);
  }
  return simplePromisifyIt(dumpToRecordFile, options);
}
var recording = false;
var recordingArray = [];
var recordFileName = "record";
var recordingCounter = 1;
var recordingFile = getRecordFileName();

function ServerObj(options) { // If given it will load existing settings or create new ones if needed. // cb/promises/squish compliant 
  // This object is set up so that there can only be 1 per install.  If a new one is attempted, it will just return the original one.
  // This us used to run server commands or gather specific information regarding the server.
  // TODO:  Make it so the server is actually spawned when this object is created.
  // TODO: Add sections with information on the parameters used for the server, the path to the jar file ran, etc.
  // Takes a settings object, which specifies the following, as an example:
  // {
  //   commandOperator:"!",
  //   installPath:"/path/to/starmade",
  //   javaMin:"512m",
  //   javaMax:"4096m",
  //   port:"4242",
  //   addionalJavaArgs:["-jvm blah blah","-more options"], // optional
  //   additionalSMJarArgs:["-more options","-if any exist"] // optional
  // }
  var forceStart = getOption(options, "forceStart", false);
  var ignoreLockFile = getOption(options, "ignoreLockFile", false);;

  var response = "";
  var self = this; // This is needed to keep this context within subfunctions
  this.serverName = path.basename(installObj.path);
  // this.console = new CustomConsole(self.serverName); // This is to output text only when the user has switched to the console for this server.  It's a fully operational Console object.
  this.console = installObj.console; // redundant
  // Paths
  installObj.settings=setSettings(installObj.settings); // Set up any missing settings
  global.writeSettings();

  this.settings = installObj.settings; // Complete any missing settings.  If a starMadeFolder argument was given, this will be used as the install path.  This includes the starmade folder, min and max java settings, etc.
  console.log("installObj.settings: " + installObj.settings);
  this.installFolder = self.settings["installFolder"];
  // We have to do the below check AFTER the settings were set up because we don't know what the starmade folder will be if none was provided to the object
  if (installObj.hasOwnProperty("serverObj")) { // Check to see if this serverObj has already been created, returning that object if so.
    console.error("Server already initialized!  Ignoring any settings you may have set and using the existing server object!");
    return installObj.serverObj; // TODO: Test this.  I have no idea if this will work or not
  }

  this.objects = {};
  this.regConstructor = function (theFunction) {
    if (typeof theFunction == "function") {
      if (theFunction.hasOwnProperty("name")) {
        var firstLetter = theFunction.name[0];
        var letterTest = firstLetter.toLowerCase();
        if (firstLetter === letterTest) {
          throw new Error("Unable to register constructor! Constructor functions should have an uppercase first letter! '" + theFunction.name + "' does not have an uppercase first letter! -- Source Server: " + self.installFolder);
        } else {
          self.objects[theFunction.name] = theFunction;
          console.log("Registered new Constructor, '" + theFunction.name + "', for server: " + self.installFolder); // This does not make it a constructor.
          return true;
        }
      }
      throw new Error("Unable to register unnamed constructor!  Please only attempt to register VALID constructors!  Server: " + self.installFolder);
    }
    return false;
  }
  this.deregConstructor = function (theFunction) {
    var theFunctionTypeName = "";
    if (typeof theFunction == "function") {
      if (theFunction.hasOwnProperty("name")) {
        theFunctionTypeName = theFunction.name;
      } else {
        throw new Error("Invalid input given to deregConstructor!  Expects a named function or string! Server: " + self.installFolder);
      }
    } else if (typeof theFunction == "string") {
      theFunctionTypeName = theFunction;
    } else {
      throw new Error("Invalid input given to deregConstructor!  Expects a named function or string! Server: " + self.installFolder);
    }
    var deregged = false;
    if (self.objects.hasOwnProperty(theFunctionTypeName)) {
      deregged = true;
      Reflect.deleteProperty(self.objects, theFunctionTypeName);
    }
    return deregged; // Returns true if successful, false if not found.
  }

  this.deregAllConstructors = function () {
    var deregged = false;
    const objectKeys = Object.keys(self.objects);
    for (let i = 0;i < objectKeys.length;i++) {
      if (self.deregConstructor(objectKeys[i])) { // If at least 1 constructor is deregistered, this will return true.
        deregged = true;
      }
    }
    return deregged; // Returns true if something was removed, false if not.
  }
  // this.event=new Event();  // This has been changed to being created in starmade.js so that the event listeners can be registered there and unregistered when mods are reloaded.
  this.event = event;
  global.settings.servers[self.installFolder] = self.settings; // Only update the settings to the global settings file IF the serverObj wasn't already set up.
  // Before we go any further, we should check to see if there are any previous PIDs associated with this server and kill them if necessary.
  if (self.settings.hasOwnProperty("lockPIDs")) {
    var lockPIDs = [];
    if (self.settings.lockPIDs.length > 0 && ignoreLockFile == false) {
      lockPIDs = copyArray(self.settings.lockPIDs);
      for (let i = 0;i < lockPIDs.length;i++) {
        if (isPidAlive(lockPIDs[i])) {
          console.log("Existing server process found running on PID, '" + lockPIDs[i] + "'!");
          if (forceStart == true) {
            console.log("forceKill flag set!  Auto-killing PID!");
            response = "yes";
          } else {
            response = prompt("If you want to kill it, type 'yes': ").toLowerCase();
          }
          if (response == "yes") {
            console.log("TREE KILLING WITH EXTREME BURNINATION!");
            treeKill(lockPIDs[i], 'SIGTERM');
            // We should initiate a loop giving up to 5 minutes for it to shut down before sending a sig-kill.
            waitAndThenKill(300000, lockPIDs[i]);
            sleepSync(1000); // Give the sigKILL time to complete if it was necessary.
            self.settings.lockPIDs = arrayMinus(self.settings.lockPIDs, lockPIDs[i]); // PID was killed, so remove it from the settings.json file.
          } else {
            console.log("Alrighty, I'll just let it run then.");
          }
        } else {
          console.log("Prior starmade.js wrapper PID (" + lockPIDs[i] + ") not running. Cool.");
          self.settings.lockPIDs = arrayMinus(self.settings.lockPIDs, lockPIDs[i]); // PID wasn't alive, so remove it from the settings.json file.
        }
      }
      console.log("");
      if (self.settings.lockPIDs.length > 0) {
        // We never want to start the wrapper if any of the PIDs are still alive, unless the person started with the argument to ignore the lock file
        console.log("\nDANGER WILL ROBINSON!  There are " + self.settings.lockPIDs.length + " server processes still running!");
        console.log("We cannot continue while an existing server might still be running!  Exiting!");
        console.log("NOTE: If you are 100% SURE that these the PIDs from the lock file are NOT from another server running, you can create the server object again with the option, {ignoreLockFile:true}.  This will ignore the old PIDs and delete them from the settings.json file.");
        console.log("NOTE2: If you want to create this server object auto-killing any old PID's, you can use the {forceStart:true} option.");
        process.exit(1);

      }
    } else if (self.settings.lockPIDs.length > 0) {
      var settingsBackupFile = path.join(self.installFolder, "settingsBackup.json");
      console.log("Ignoring existing server PIDs and deleting them from the settings.json file.  Saving a backup here: " + settingsBackupFile);
      writeJSONFileSync(settingsBackupFile, global.settings);
      self.settings.lockPIDs = [];
    }
  } else {
    // No lockPIDs set up for this server, so set it to an empty array.
    self.settings.lockPIDs = [];
  }
  this.lockPIDS = self.settings.lockPIDs;
  global.writeSettings(); // Write the global settings.json to the hard drive
  this.addLockPID = function (PID) { // Only adds the PID if it wasn't already in the array.  Always returns true whether it added the PID or not
    var thePID = toNumIfPossible(PID);
    if (typeof thePID == "number") {
      if (!Array.isArray(self.lockPIDs)) {
        self.lockPIDs = [];
      }
      self.lockPIDs = addUniqueToArray(self.lockPIDs, thePID);
      global.writeSettings();
      return true;
    }
    throw new Error("Non-Number input given to addLockPID!  Please provide a number!");
  }
  this.removeLockPID = function (PID) { // Always returns true, whether the PID was there to remove or not.
    var thePID = toNumIfPossible(PID);
    if (typeof thePID == "number") {
      if (!Array.isArray(self.lockPIDs)) {
        self.lockPIDs = [];
      }
      self.lockPIDs = arrayMinus(self.lockPIDs, thePID);
      global.writeSettings();
      return true;
    }
    throw new Error("Non-Number input given to removeLockPID!  Please provide a number!");
  }
  this.killAllPIDs = function(){ // This will kill any PIDs associated with this server, first with sigTERM, then with sigKILL after 5 minutes.
    console.log("Killing all PIDs..");
    for (let i=self.lockPIDs.length-1;i<=0;i--){
      console.log("DIE PID: " + self.lockPIDs[i]);
      treeKill(self.lockPIDs[i], 'SIGTERM');
      waitAndThenKill(300000, self.lockPIDs[i]); // We should initiate a loop giving up to 5 minutes for it to shut down before sending a sig-kill.
      self.removeLockPID(self.lockPIDs[i]);
    }
  }


  // Set up any folders needed
  ensureFolderExists(self.installFolder);
  this.starMadeInstallFolder = path.join(self.installFolder, "StarMade");
  ensureFolderExists(self.starMadeInstallFolder);
  this.logsFolder = path.join(self.installFolder, "logs");
  this.log=installObj["log"]; // redundant
  this.starMadeLogFolder = path.join(self.starMadeInstallFolder, "logs"); // This is added because we have to parse the serverlog.0.log file for ship spawns
  var serverLogFile = path.join(self.starMadeLogFolder, "serverlog.0.log");
  this.starMadeJar = path.join(self.starMadeInstallFolder, "StarMade.jar");
  // Ensure the mods folder exists, and copy over mods from the root install folder if it doesn't exist yet.
  this.modsFolder = path.join(installObj.path, "mods"); 
  // ensureFolderExists(self.modsFolder); // This isn't needed if fsExtra creates the folder.  TODO: Test this
  if (!existsAndIsDirectory(self.modsFolder)) { //check to see if a mods folder exists, and if not, copy the mods from the root folder over.
    fsExtra.copy(global["modsFolder"], self.installFolder, function (err) {
      if (err) {
        throw err;
      }
      console.log("Copied mods folder from wrapper folder to starmade install folder: " + self.modsFolder);
    })
  }

  this.starMadeInstallerFilePath = global["starMadeInstallerFilePath"];
  this.serverCfgFilePath = path.join(self.starMadeInstallFolder, "server.cfg");
  
  //  We need to ensure the server has been installed before we continue

  this.getServerCfgAsIniObj = function () { // callbackify and promisify this
    // This should only be ran AFTER a successful install has been performed
    if (typeof self.serverCfgObj == "object"){
      return self.serverCfgObj; // This is an iniObj.  This should get deleted when the server exits.
    }
    if (existsAndIsFile(self.serverCfgFilePath)) {
      self.serverCfgFile = ini.getFileAsObj(self.serverCfgFilePath); // This generates a new ini file object each time it's ran
      return self.serverCfgFile;
    } else {
      return null; // File does not exist
    }
  };
  this.getSuperAdminPassword = function () {
    if (typeof self.superAdminPassword == "string"){
      return self.superAdminPassword; // This should get deleted when the server exits.
    }
    // self.superAdminPassword = getSuperAdminPassword(installObj.settings["starMadeFolder"]); // Check the super admin password and set up if not configured.
    var serverCfgObj = self.getServerCfgAsIniObj(); // If the server.cfg file does not exist, this will be null.
    if (serverCfgObj === null) {
      return null;
    }
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
      ini.setVal(serverCfgObj, "SUPER_ADMIN_PASSWORD", newSuperAdminPassword);
      if (superAdminPasswordEnabled == "false") {
        console.log("Super Admin Password was disabled, enabling!");
        // serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"],"true");
        ini.setVal(serverCfgObj, "SUPER_ADMIN_PASSWORD_USE", "true");
      }
      ini.writeObjToFile(serverCfgObj, self.serverCfgFilePath);
    } else if (superAdminPasswordEnabled != "true") { // Enable super admin password if it was disabled for some reason.
      console.log("Super Admin Password was disabled, enabling!");
      // serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"],"true");
      ini.setVal(serverCfgObj, "SUPER_ADMIN_PASSWORD_USE", "true");
      ini.writeObjToFile(serverCfgObj, self.serverCfgFilePath);
    }
    self.superAdminPassword=ini.getVal(serverCfgObj, "SUPER_ADMIN_PASSWORD");
    return self.superAdminPassword;
  }
  this.install = function (options, cb) {
    if (typeof cb == "function") {
      // Need to add a check to see if the folder already has an install or not.
      try {
        smInstallHelpers.spawnStarMadeInstallTo(self.installFolder, global["starMadeInstallerFilePath"]); // Does not create config files upon install.
        smInstallHelpers.verifyInstall(self.installFolder); // Creates config files if they don't exist
        var testCfgFile = self.getServerCfgAsIniObj();
        if (testCfgFile === null) {
          console.error("ERROR: Could not retrieve server.cfg file.  Was there an error during install?  Please try the install again!");
          return cb(null, false);
        }
        self.getSuperAdminPassword();
      } catch (error) {
        return cb(error, null);
      }
      return cb(null, true); // This means the install was a success
    }
    return simplePromisifyIt(self.install, options);
  }
  // Check if the install exists or not and install it if needed
  if (!existsAndIsFile(self.serverCfgFilePath)) { // Right now we are only using the server.cfg file to check if it was installed or not.
    self.install("", function (err) {
      if (err) {
        throw err;
      }
      console.log("Install successful to folder: " + self.installFolder);
    });
  }
  // This may not exist yet if the StarMade install hasn't been performed yet.  Need the install routine put in here, so a check can be made and if not installed, install first.
  this.bot = new BotObj(installObj.settings["botName"]);

  // #### Settings
  this.ignoreLockFile = false;
  this.forceStart = false;

  this.buildBranch = installObj.settings["buildBranch"].toLowerCase().trim(); // Should be normal/dev/pre
  var baseJavaArgs = ["-Xms" + installObj.settings["javaMin"], "-Xmx" + installObj.settings["javaMax"], "-jar"]; // These run on any OS.  TODO: Add support for JVM arguments
  if (installObj.settings.hasOwnProperty("addionalJavaArgs")) {
    baseJavaArgs = installObj.settings.addionalJavaArgs.concat(baseJavaArgs);
  }
  var baseJavaArgsWindows = ["-Xincgc", "-Xshare:off"]; // These will run on windows only
  var baseSMJarArgs = [self.starMadeJar, "-server", "-port:" + installObj.settings["port"]];
  if (self.buildBranch == "pre") {
    baseSMJarArgs.push("-pre");
  } else if (self.buildBranch == "dev") {
    baseSMJarArgs.push("-dev");
  }
  if (process.platform == "win32") {
    this.spawnArgs = baseJavaArgs.concat(baseJavaArgsWindows).concat(baseSMJarArgs);
  } else {
    this.spawnArgs = baseJavaArgs.concat(baseSMJarArgs);
  }
  console.log("Set spawnArgs: " + self.spawnArgs);

  // Todo:  add stop(), kill(), forceKill(), isResponsive(), etc.
  // This might be useful for spawning:  this.spawn=spawn("java",this.javaArgs,{"cwd": this.settings["starMadeInstallFolder"]});

  // this.spawn=spawn("java",self.spawnArgs,{"cwd": self.starMadeInstallFolder}); // TEMP for testing
  this.spawnStatus = "stopped"; // By default the server is not spawned yet at this point in the scripting.
  this.spawnStatusWanted = "stopped"; // This is the end result of what the current process should be, such as if the status is "stopping", the wanted status is "stopped"
  this.start = function (options, cb) {
    if (typeof cb == "function") {
      // First check to see if the process already exists or not.
      if (self.spawn) {
        if (self.spawn.hasOwnProperty("connected")) {
          if (self.spawn.connected == true) { // TODO: Check to ensure this method works fine, otherwise check the PID to see if it's still running.
            if (self.spawnStatus == "started") {
              console.log("ERROR: Cannot start server.  It is already started!");
              return cb(null, false);
            } else { // Server may be shutting down or in an error state
              console.log("ERROR: Cannot start server.  It has not been shut down yet!  If the server is in an error state, it must be stopped before started again!");
              return cb(null, false);
            }
          }
        }
      }
      self.spawn = spawn("java", self.spawnArgs, {"cwd": self.starMadeInstallFolder}); // Spawn the server
      self.spawnStatus = "started";
      self.spawnStatusWanted= "started"; // This tells us if the server crashes or something, we know it should be restarted.
      // global["servers"][self.installFolder]=self.spawn; // Old method, plus no need to add the spawn, since this adds it to the ServerObj
      self.addLockPID(self.spawn.pid);

      // Tailing is no longer necessary, since the console should output serverlog messages (added after StarMade ver 0.201.378)
      // console.log("Initializing tail of serverlog.0.log");
      // miscHelpers.touch(serverLogFile); // Ensure the file exists before we tail it.
      // if (process.platform == "win32" ){ // TODO:  See if there is a cleaner workaround than using a powershell instance to force the serverTail to be faster..  It does not handle errors well.  I believe it will crash when log rotation happens.
      //   console.log("#########   Windows detected, running powershell listener.  #########");
      //   //  powershell type -wait -Tail 0 .\serverlog.0.log  <-- this will force it to refresh  Source: https://serverfault.com/questions/1845/how-to-monitor-a-windows-log-file-in-real-time
      //   var powershellArgs=["type","-wait","-Tail 0",serverLogFile];
      //   console.log("Set Powershell arguments to: " + powershellArgs)
      //   self.powershellSpawn=spawn("powershell",powershellArgs,{"cwd": self.starMadeLogFolder});
      //   console.log("Powershell started with PID: " + self.powershellSpawn.pid);
      //   self.addLockPID(self.powershellSpawn.pid); // This is to ensure the PID is killed if the server is started again and was not successfully shut down.  I am also adding a treekill to the global exit listener.
      // }
      // var tailOptions = {
      //   "fsWatchOptions": {"persistent": false},
      //   "follow": true,
      //   "fromBeginning": false
      // };    
      // self.serverTail = new Tail(serverLogFile,tailOptions);
      // serverTail.watch(); // TEMPORARY
      // process.exit(); // TEMPORARY

      // Unnecessary to follow the 'close' since 'exit' suffices.  This would duplicate with the 'exit' listener.
      // this.spawn.on('close',function(code){ // This has to do with whether it's STDIO is closed or not, this normally fires after the exit.
      //   console.log("###### SPAWN STATUS SET TO:  closed");
      //   self.spawnStatus="closed";
      //   self.spawnStatusCode=code;
      // });
      self.spawn.on('disconnect', function (data) {
        console.log("###### SPAWN STATUS SET TO:  disconnect");
        self.spawnStatus = "disconnected";
        self.event.emit("disconnect",data);
        if (self.hasOwnProperty("spawnStatusCode")) {
          Reflect.deleteProperty(self, "spawnStatusCode");
        }
      });
      self.spawn.on('error', function (data) { // This happens when a process could not be spawned, killed, or sending a message to the child process failed.
        // Note:  This does not mean the spawn has exited, but it is possible that it did.  We will rely on the 'exit' event to remove the PID from the lock
        console.log("###### SPAWN STATUS SET TO:  error");
        self.spawnStatus = "errored";
        self.event.emit("error",data);
        if (self.hasOwnProperty("spawnStatusCode")) {
          Reflect.deleteProperty(self, "spawnStatusCode");
        }
      });
      self.spawn.on('exit', function (code) { // I'm guessing if a non-zero code is given, it means the server errored out.
        console.log("###### SPAWN STATUS SET TO:  exited");
        self.spawnStatus = "stopped";
        self.event.emit("exit",code);
        self.removeLockPID(self.spawn.pid);
        console.log("Removed PID, '" + self.spawn.pid + "' from lockPIDs.");
        if (typeof toStringIfPossible(code) == "string") {
          console.log('Server instance exited with code: ' + code.toString());
        }
        if (self.hasOwnProperty("spawnStatusCode")) {
          Reflect.deleteProperty(self, "spawnStatusCode");
        }
        if (self.hasOwnProperty("serverCfgObj")) { // This ensures it will reload the server.cfg file on next start
          Reflect.deleteProperty(self, "serverCfgObj");
        }
        if (self.hasOwnProperty("superAdminPassword")) { // Same as above. The superAdminPassword can change between reboots.
          Reflect.deleteProperty(self, "superAdminPassword");
        }

        // Tail will no longer be used in StarMade after the current version as of this writing
        // console.log("serverTail:");
        // console.dir(self.serverTail.listeners());
        // console.log("Shutting down server log tail..");
        // self.serverTail.unwatch();
      });

      // Set up the listeners for the main process and for the serverlog
      // ####################
      // ###    WRAPPER   ###
      // ####################

      self.spawn.stdout.on('data', function (data) { // Displays the standard output from the starmade server
        let dataString = data.toString().trim(); // Clear out any blank lines
        if (dataString != "") {
          let dataArray = dataString.replace("\r", "").split("\n"); // simplify to only new line characters and split to individual lines.
          for (let i = 0;i < dataArray.length;i++) {
            if (dataArray[i] != "") {
              if (self.settings.showStdout == true || self.settings.showAllEvents == true) {
                if (typeof self.settings.stdoutFilter == "object") {
                  if (self.settings.stderrFilter.test(dataArray[i])) {
                    console.log("STDOUT: " + dataArray[i]);
                  }
                } else {
                  console.log("STDOUT: " + dataArray[i]);
                }
              }
              if (recording) { // For the wrapper console command "!recording"
                recordingArray.push("STDOUT: " + dataArray[i]);
              }
              processDataInput(dataArray[i]); // Process the line to see if it matches any events and then trigger the appropriate event
            }
          }
        }
      });

      self.spawn.stderr.on('data', function (data) { // Displays the error output from the starmade server
        let dataString = data.toString().trim(); // Clear out any blank lines
        if (dataString != "") {
          let dataArray = dataString.replace("\r", "").split("\n"); // simplify to only new line characters and split to individual lines.
          for (let i = 0;i < dataArray.length;i++) {
            if (dataArray[i]) {
              if (self.settings.showStderr == true || self.settings.showAllEvents == true) {
                if (typeof self.settings.stderrFilter == "object") {
                  if (self.settings.stderrFilter.test(dataArray[i])) {
                    console.log("STDERR: " + dataArray[i]);
                  }
                } else {
                  console.log("STDERR: " + dataArray[i]);
                }
              }
              if (recording) { // For the wrapper console command "!recording"
                recordingArray.push("STDERR: " + dataArray[i]);
              }
              processDataInput(dataArray[i]); // Process the line to see if it matches any events and then trigger the appropriate event
            }
          }
        }
      });
      // No longer needed since we aren't tailing the serverlog anymore
      // self.serverTail.on('line', function (data) { // This is unfortunately needed because some events don't appear in the console output.  I do not know if the tail will be 100% accurate, missing nothing.
      //   // console.log("Processing serverlog.0.log line: " + data.toString().trim());
      //   // There needs to be a separate processor for serverlog stuff, since there can be duplicates found in the console and serverlog.0.log file.  This should also be faster once streamlined.
      //   // let dataString=data.toString().trim().replace(/^\[[^\[]*\] */,''); // This was throwing ESLINTER areas I guess.
      //   let dataString = data.toString().trim().replace(/^\[[^[]*\] */, ''); // This removes the timestamp from the beginning of each line so each line looks the same as a console output line, which has no timestamps.
      //   if (dataString) { // Do not process empty lines
      //     let dataArray = dataString.replace("\r", "").split("\n"); // simplify to only new line characters and split to individual lines.
      //     for (let i = 0;i < dataArray.length;i++) {
      //       if (dataArray[i]) { // Do not process empty lines
      //         if (self.settings.showServerlog == true || self.settings.showAllEvents == true) {
      //           if (typeof self.settings.serverlogFilter == "object") {
      //             if (self.settings.serverlogFilter.test(dataArray[i])) {
      //               console.log("serverlog.0.log: " + dataArray[i]);
      //             }
      //           } else {
      //             console.log("serverlog.0.log: " + dataArray[i]);
      //           }
      //         }
      //         if (recording) { // For the wrapper console command "!recording"
      //           recordingArray.push("serverlog.0.log: " + dataArray[i]);
      //         }
      //         processServerlogDataInput(dataArray[i]); // Process the line to see if it matches any events and then trigger the appropriate event
      //       }
      //     }
      //   }
      // });

      // return this.spawn;
      return cb(null, this.spawn);
    } else {
      return simplePromisifyIt(self.start, options);
    }
  }

  this.stop = function (duration, message, options, cb) {
    if (typeof cb == "function") {
      console.log(`Stop function ran with duration: ${duration}  and message: ${message}`);
      self.spawnStatus = "stopping";
      var theDuration = 10;
      if (isNum(duration)) {
        theDuration = toNumIfPossible(duration);
      }
      if (typeof toStringIfPossible(message) == "string") {
        if (message.length > 0) {
          var theMessage = '"' + toStringIfPossible(message).trim().replace('"', "").replace("'", "") + '"';
        }
      }
      if (theDuration > 1) {
        if (typeof theMessage == "string") {
          return runSimpleCommand(self, "/start_countdown " + theDuration + " " + theMessage, options, async function (err, result) {
            if (err) {
              console.log("Shutdown command failed with an error when attempting to start a countdown!");
              return cb(err, null);
            }
            if (result) {
              await sleepPromise(theDuration * 1000);
              return runSimpleCommand(self, "/shutdown 1", options, cb);
            } else {
              console.error("Shutdown command failed due to connection error!");
              return cb(new Error("Shutdown command failed due to connection error!"), null);
            }
          });
        } else {
          console.log("No message given, so using default shutdown message..");
          return runSimpleCommand(self, "/start_countdown " + theDuration + '" Server shutting down in.."', options, async function (err, result) {
            if (err) {
              console.log("Shutdown command failed with an error when attempting to start a countdown!");
              return cb(err, null);
            }
            if (result) {
              await sleepPromise(theDuration * 1000);
              return runSimpleCommand(self, "/shutdown 1", options, cb);
            } else {
              console.error("Shutdown command failed due to connection error!");
              return cb(new Error("Shutdown command failed due to connection error!"), null);
            }
          });
        }
      } else {
        console.log("Using failsafe shutdown option..");
        return runSimpleCommand(self, "/shutdown 1", options, cb);
      }
    } else {
      return simplePromisifyIt(self.stop, options, duration, message);
    }
  }

  this.kill = function (options, cb) {
    // Returns (ErrorObject,null) if there is an error when attempting to send the kill signal to the PID
    // Returns (false,false) if the spawn previously was ran, but the PID is no longer active
    // returns (null,null) if the spawn object has no PID associated with it
    if (typeof cb == "function") {
      if (self.spawn.hasOwnProperty("pid")) {
        if (isPidAlive(self.spawn.pid)) {
          self.spawnStatus = "killing";
          try {
            return cb(null, self.spawn.kill()); // Sends SIGTERM
          } catch (err) {
            console.log("Error when attempting to kill server spawn (with TERM signal)!");
            return cb(err, null);
          }
        } else {
          console.log(`Spawn PID (${self.spawn.pid}) was not alive!  Cannot kill it!`);
          return cb(false, false);
        }
      } else {
        console.log("Cannot kill spawn.  There is no PID associated with it!");
        return cb(new Error(null, null));
      }
    } else {
      return simplePromisifyIt(self.kill, options);
    }
  }
  this.forcekill = function (options, cb) {
    // Returns (ErrorObject,null) if there is an error when attempting to send the kill signal to the PID
    // Returns (false,false) if the spawn previously was ran, but the PID is no longer active
    // returns (null,null) if the spawn object has no PID associated with it
    if (typeof cb == "function") {
      if (self.spawn.hasOwnProperty("pid")) {
        if (isPidAlive(self.spawn.pid)) {
          self.spawnStatus = "forceKilling";
          try {
            return cb(null, self.spawn.kill('SIGKILL')); // Sends SIGTERM
          } catch (err) {
            console.log("Error when attempting to kill server spawn (with KILL signal)!");
            return cb(err, null);
          }
        } else {
          console.log(`Spawn PID (${self.spawn.pid}) was not alive!  Cannot kill it!`);
          return cb(false, false);
        }
      } else {
        console.log("Cannot kill spawn.  There is no PID associated with it!");
        return cb(new Error(null, null));
      }
    } else {
      return simplePromisifyIt(self.kill, options);
    }
  }

  // TODO:
  // add isInServerList()  using: getServerListArray()

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



  this.onlinePlayers = function (options, cb) {
    if (typeof cb == "function") {
      return getPlayerList(self, options, cb);
    } else {
      return simplePromisifyIt(self.onlinePlayers, options);
    }
  }
  this.getAdmins = function (options, cb) {
    if (typeof cb == "function") {
      return getAdminsList(self, options, cb);
    } else {
      return simplePromisifyIt(self.getAdmins, options);
    }
  };
  this.getBannedAccounts = function (options, cb) {
    if (typeof cb == "function") {
      return getBannedAccountsList(self, options, cb)
    } else {
      return simplePromisifyIt(self.getBannedAccounts, options);
    }
  };
  this.getBannedIPs = function (options, cb) {
    if (typeof cb == "function") {
      return getBannedIPList(self, options, cb);
    } else {
      return simplePromisifyIt(self.getBannedIPs, options);
    }
  };
  this.getBannedNames = function (options, cb) {
    if (typeof cb == "function") {
      return getBannedNameList(self, options, cb);
    } else {
      return simplePromisifyIt(self.getBannedNames, options);
    }
  };
  this.getWhitelistedAccounts = function (options, cb) {
    if (typeof cb == "function") {
      return getWhitelistedAccountsList(self, options, cb);
    } else {
      return simplePromisifyIt(self.getWhitelistedAccounts, options);
    }
  };
  this.getWhitelistedIPs = function (options, cb) {
    if (typeof cb == "function") {
      return getWhitelistedIPList(self, options, cb);
    } else {
      return simplePromisifyIt(self.getWhitelistedIPs, options);
    }
  };
  this.getWhitelistedNames = function (options, cb) {
    if (typeof cb == "function") {
      return getWhitelistedNameList(self, options, cb);
    } else {
      return simplePromisifyIt(self.getWhitelistedNames, options);
    }
  };
  this.msg = function (message, options, cb) { // Sends a message to online players.
    // options can be {"type":plain/info/warning/error} <-- pick one.
    if (typeof cb == "function") {
      let msgType = getOption(options, "type", "plain"); // Default is a plain message, which sends to main chat.
      let messageToSend = toStringIfPossible(message);
      if (testIfInput(messageToSend)) {
        if (typeof messageToSend != "string") { // non blank, non stringable? What is it?!
          return cb(new Error("Invalid input given to ServerObj.msg!"), null);
        }
      } else {
        messageToSend = " "; // no message given, so let's just be nice and assume they want a blank message
      }
      // I don't think there is any difference between using "plain" with this command and the /chat command.
      return runSimpleCommand(self, "/server_message_broadcast " + msgType + " '" + messageToSend.toString().trim() + "'", options, cb);
    } else {
      return simplePromisifyIt(self.msg, options, message);
    }
  }
  this.botMsg = function (message, options, cb) { // Sends a plain message to the player with the bot's name.
    if (typeof cb == "function") {
      let messageToSend = toStringIfPossible(message);
      if (testIfInput(message)) {
        if (typeof messageToSend != "string") { // non blank, non stringable? What is it?!
          return cb(new Error("Invalid input given to ServerObj.botMsg!"), null);
        }
      } else { // no message given, so let's just be nice and assume they want a blank bot message
        messageToSend = " ";
      }
      return self.bot.serverMsg(messageToSend, options, cb); // This should throw an error if there is a problem connecting to the server
    } else {
      return simplePromisifyIt(self.botMsg, options, message);
    }
  }
  this.clearShipSpawns = function (options, cb) { // clears all ship entities not spawned by a player ie. admin spawned or mobs
    // Note: Be careful with this!  This applies to the entire universe!
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/clear_system_ship_spawns_all", options, cb);
    } else {
      return simplePromisifyIt(self.clearShipSpawns, options);
    }
  }
  this.daytime = function (timeInHours, options, cb) {
    if (typeof cb == "function") {
      let timeToUse = toNumIfPossible(timeInHours);
      // Does not have success or fail messages
      if (typeof timeToUse == "number") {
        return runSimpleCommand(self, "/daytime " + timeToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.daytime() for timeInHours!"), null);
      }
    } else {
      return simplePromisifyIt(self.daytime, options, timeInHours);
    }
  }
  this.delaySave = function (timeInSeconds, options, cb) {
    if (typeof cb == "function") {
      let timeToUse = toNumIfPossible(timeInSeconds);
      // Does not have success or fail messages
      if (typeof timeToUse == "number") {
        return runSimpleCommand(self, "/delay_save " + timeToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.delaySave() for timeInSeconds!"), null);
      }
    } else {
      return simplePromisifyIt(self.delaySave, options, timeInSeconds);
    }
  }
  this.despawn = function (partOfShipName, used, shipOnly, options, cb) { // Only partOfShipName input is mandatory.
    if (typeof cb == "function") {
      // Note: Becareful with this because this will despawn ALL ships in the entire universe that match!
      // EXAMPLE: /despawn_all MOB_ unused true
      var partOfShipNameToUse = toStringIfPossible(partOfShipName);
      if (typeof partOfShipNameToUse != "string") {
        return cb(new Error("Invalid input given to Server.despawn as partOfShipNameToUse!"), null);
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
      return runSimpleCommand(self, "/despawn_all \"" + partOfShipNameToUse + "\" " + usedToUse + " " + shipOnlyToUse, options, cb);
    } else {
      return simplePromisifyIt(self.despawn, options, partOfShipName, used, shipOnly);
    }
  }
  this.exportSector = function (sector, nameToUse, options, cb) {
    if (typeof cb == "function") {
      var sectorToUse = new SectorObj(sector); // Throws an error if input is bad.
      return sectorToUse.exportSector(nameToUse, options, cb);
    } else {
      return simplePromisifyIt(self.exportSector, options, sector, nameToUse);
    }
  }
  this.importSector = function (sector, nameToUse, options, cb) {
    if (typeof cb == "function") {
      var sectorToUse = new SectorObj(sector); // Throws an error if input is bad.
      return sectorToUse.importSector(nameToUse, options);
    } else {
      return simplePromisifyIt(self.importSector, options, sector, nameToUse);
    }
  }
  this.exportSectorBulk = function (textFileToUse, options, cb) {
    if (typeof cb == "function") {
      let textFileToUseToUse = toStringIfPossible(textFileToUse);
      if (typeof textFileToUseToUse == "string") {
        return runSimpleCommand(self, "/export_sector_bulk " + textFileToUse, options, cb);
      }
      return cb(new Error("Invalid textFileToUse specified for Server.exportSectorBulk"), null);
    } else {
      return simplePromisifyIt(self.exportSectorBulk, options, textFileToUse);
    }
  }
  this.importSectorBulk = function (textFileToUse, options, cb) {
    // I should actually check to see if the file specified exists, because I'm guessing no error is returned if the file does not exist, but meh I'll be lazy on this for now.
    if (typeof cb == "function") {
      let textFileToUseToUse = toStringIfPossible(textFileToUse);
      if (typeof textFileToUseToUse == "string") {
        return runSimpleCommand(self, "/import_sector_bulk " + textFileToUse, options, cb);
      }
      return cb(new Error("Invalid textFileToUse specified for Server.importSectorBulk"), null);
    } else {
      return simplePromisifyIt(self.importSectorBulk, options, textFileToUse);
    }
  }
  this.factionSanityCheck = function (options, cb) { // checks sanity of factions (removes leftover/invalid factions)
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/faction_check", options, cb);
    } else {
      return simplePromisifyIt(self.factionSanityCheck, options);
    }
  }
  this.factionCreate = function (factionName, playerName, factionNumber, options, cb) { // factionNumber is optional. Can take strings or objects as input
    // Creates a new faction, assigning a player to it.  The faction description will be blank!
    if (typeof cb == "function") {
      var factionNameToUse = toStringIfPossible(factionName);
      var playerNameToUse = toStringIfPossible(playerName);
      var factionNumberToUse = toNumIfPossible(factionNumber);

      if (typeof factionNameToUse == "string" && typeof playerNameToUse == "string") {
        if (typeof factionNumberToUse == "number") { // If a faction number is provided
          // Warning:  I do not know what happens if a faction number is given for one that already exists!
          return runSimpleCommand(self, "/faction_create_as " + factionNumberToUse + " " + factionNameToUse + " " + playerNameToUse, options, cb);
        }
        return runSimpleCommand(self, "/faction_create " + factionNameToUse + " " + playerNameToUse, options, cb);
      }
      return cb(new Error("Invalid parameters given to Server.factionCreate!"), null);
    } else {
      return simplePromisifyIt(self.factionCreate, options, factionName, playerName, factionNumber);
    }
  }
  this.factionCreateAmount = function (factionName, numberOfFactions, options, cb) { // accepts inputs that can be converted to string or number
    // Creates empty, open factions with the same name -- I'm not sure what the purpose of this is exactly.
    if (typeof cb == "function") {
      var factionNameToUse = toStringIfPossible(factionName);
      var numberOfFactionsToUse = toNumIfPossible(numberOfFactions);
      if (typeof factionNameToUse == "string" && typeof numberOfFactionsToUse == "number") {
        return runSimpleCommand(self, "/faction_create_amount " + factionNameToUse + " " + numberOfFactionsToUse, options, cb);
      }
      throw new Error("Invalid parameters given to Server.factionCreateAmount!");
    } else {
      return simplePromisifyIt(self.factionCreateAmount, options, factionName, factionName, numberOfFactions);
    }
  }
  this.factionPointTurn = function (options, cb) { // Forces the next faction point calculation turn
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/faction_point_turn", options, cb);
    } else {
      return simplePromisifyIt(self.factionPointTurn, options);
    }
  }
  this.factionReinstitute = function (options, cb) {
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/faction_reinstitute", options, cb);
    } else {
      return simplePromisifyIt(self.factionReinstitute, options);
    }
  }
  this.fleetSpeed = function (timeInMs, options, cb) {
    // Does not have success or fail messages
    if (typeof cb == "function") {
      let numberToUse = toNumIfPossible(timeInMs);
      if (typeof numberToUse == "number") {
        return runSimpleCommand(self, "/fleet_speed " + numberToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.fleetSpeed() for timeInMs!"), null);
      }
    } else {
      return simplePromisifyIt(self.fleetSpeed, options, timeInMs);
    }
  }
  this.fogOfWar = function (trueOrFalse, options, cb) { // Turns fog of war on or off
    if (typeof cb == "function") {
      let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      // Does not have success or fail messages
      if (isTrueOrFalse(booleanToUse)) {
        return runSimpleCommand(self, "/fog_of_war " + booleanToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.fogOfWar() for trueOrFalse!"), null);
      }
    } else {
      return simplePromisifyIt(self.fogOfWar, options, trueOrFalse);
    }
  }
  this.ignoreDockingArea = function (trueOrFalse, options, cb) { //  enables/disables docking area validation (default off)
    if (typeof cb == "function") {
      let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      // Does not have success or fail messages
      if (isTrueOrFalse(booleanToUse)) {
        return runSimpleCommand(self, "/ignore_docking_area " + booleanToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.ignoreDockingArea() for trueOrFalse!"), null);
      }
    } else {
      return simplePromisifyIt(self.ignoreDockingArea, options, trueOrFalse);
    }
  }
  this.forceSave = function (options, cb) { // Performs a force save
    // Does not have success or fail messages
    if (typeof cb == "function") {
      console.log("Running force save..");
      return runSimpleCommand(self, "/force_save", options, cb);
    } else {
      return simplePromisifyIt(self.forceSave, options, trueOrFalse);
    }
  }
  this.activateWhitelist = function (trueOrFalse, options, cb) { //  activates the whitelist, so only players listed in the whitelist.txt file can join the server.
    // Does not have success or fail messages
    if (typeof cb == "function") {
      let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      if (isTrueOrFalse(booleanToUse)) {
        return runSimpleCommand(self, "/whitelist_activate " + booleanToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.activateWhitelist() for trueOrFalse!"), null);
      }
    } else {
      return simplePromisifyIt(self.activateWhitelist, options, trueOrFalse);
    }
  }
  this.updateShopPrices = function (options, cb) { // Updates shop prices.
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/update_shop_prices", options, cb);
    } else {
      return simplePromisifyIt(self.updateShopPrices, options);
    }
  }
  this.sectorSize = function (sizeInM, options, cb) { // Resizes the sector for the server - writes to the server.cfg file
    // WARNING: Setting sector sizes to be smaller can cause some really bizarre issues if entities are now outside of the sector but still inside it!
    if (typeof cb == "function") {
      let numberToUse = toNumIfPossible(sizeInM);
      if (typeof numberToUse == "number") {
        return runSimpleCommand(self, "/sector_size " + numberToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.sectorSize() for sizeInM!"), null);
      }
    } else {
      return simplePromisifyIt(self.sectorSize, options, sizeInM);
    }
  }
  this.setWeaponRangeReference = function (sizeInM, options, cb) { // Sets the weapon reference range distance in meters, which config values are multiplied with (default is sector distance)
    if (typeof cb == "function") {
      let numberToUse = toNumIfPossible(sizeInM);
      if (typeof numberToUse == "number") {
        return runSimpleCommand(self, "/set_weapon_range_reference " + numberToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.setWeaponRangeReference() for sizeInM!"), null);
      }
    } else {
      return simplePromisifyIt(self.setWeaponRangeReference, options, sizeInM);
    }
  }
  this.aiSimulation = function (trueOrFalse, options, cb) { //  activates or deactivates AI simulation
    if (typeof cb == "function") {
      let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      // Does not have success or fail messages
      if (isTrueOrFalse(booleanToUse)) {
        return runSimpleCommand(self, "/simulation_ai_enable " + booleanToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.aiSimulation() for trueOrFalse!"), null);
      }
    } else {
      return simplePromisifyIt(self.aiSimulation, options, trueOrFalse);
    }
  }
  this.simulationClear = function (options, cb) { // Clears all AI from simulation
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/simulation_clear_all", options, cb);
    } else {
      return simplePromisifyIt(self.simulationClear, options);
    }
  }
  this.simulationSpawnDelay = function (timeInSeconds, options, cb) { // Not sure what this does.  If I had to guess what this is for, it's the delay before pirates come attack when near a pirate station or in void space?  I think the help for this command is wrong which is:  sets the time of the day in hours
    if (typeof cb == "function") {
      let timeToUse = toNumIfPossible(timeInSeconds);
      if (typeof timeToUse == "number") {
        return runSimpleCommand(self, "/set_weapon_range_reference " + timeToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.simulationSpawnDelay() for sizeInM!"), null);
      }
    } else {
      return simplePromisifyIt(self.simulationSpawnDelay, options, timeInSeconds);
    }
  }
  this.simulationInfo = function (options, cb) { // Prints info about macro AI Simulation
    // this returns a string for now.. I'm not interested in discovery and parsing of the data at this time.
    if (typeof cb == "function") {
      return starNetVerified(self, "/simulation_info", options, cb);
    } else {
      return simplePromisifyIt(self.simulationInfo, options);
    }
  }
  this.factionList = function (options, cb) { // Returns an array of FactionObj for all factions on the server.
    if (typeof cb == "function") {
      return starNetVerified(self, "/faction_list", options, function (err, results) {
        if (err) {
          console.error("ERROR:  Could not obtain faction list for ServerObj.factionList!");
          return cb(err, results);
        }
        // RETURN: [SERVER, FACTION: Faction [id=-9999992
        var returnArray = [];
        let theReg = new RegExp("^RETURN: \\[SERVER, FACTION: Faction \\[id=[-]{0,1}[0-9]+.*");
        var theArray = results.trim().split("\n");
        var theLine;
        for (let i = 0;i < theArray.length;i++) {
          if (theReg.test(theArray[i])) {
            theLine = theArray[i].match(/^RETURN: \[SERVER, FACTION: Faction \[id=[-]{0,1}[0-9]+/);
            if (theLine) {
              theLine = theLine.toString().match(/[-]{0,1}[0-9]+$/).toString();
              returnArray.push(new FactionObj(theLine));
              theLine = "";
            }
          }
        }
        return cb(null, returnArray); // Array is empty if no factions were found.
      });
    } else {
      return simplePromisifyIt(self.factionList, options);
    }
  }
  this.blueprintList = function (options, cb) { // Returns an array of FactionObj for all factions on the server.
    if (typeof cb == "function") {
      return starNetVerified(self, "/list_blueprints", options, function (err, results) {
        if (err) {
          console.error("ERROR: Could not obtain blueprint list for ServerObj.blueprintList!");
          return cb(err, results);
        }
        var returnArray = [];
        // RETURN: [SERVER, [CATALOG] INDEX 0: This is another test, 0]
        let theReg = new RegExp("^RETURN: \\[SERVER, \\[CATALOG\\] INDEX.*");
        var theArray = results.trim().split("\n");
        var theLine;
        for (let i = 0;i < theArray.length;i++) {
          if (theReg.test(theArray[i])) {
            theLine = theArray[i].replace(/^RETURN: \[SERVER, \[CATALOG\] INDEX [0-9]+: /, "");
            theLine = theLine.replace(/, 0\]$/, "");
            returnArray.push(new BlueprintObj(theLine));
            theLine = "";
          }
        }
        return cb(null, returnArray); // Array is empty if no factions were found.
      });
    } else {
      return simplePromisifyIt(self.blueprintList, options);
    }
  }
  this.listControlUnits = function (options, cb) { // Prints info about characters and entities
    // this returns a string for now.. I'm not interested in discovery and parsing of the data at this time, since other commands have better info than this.
    if (typeof cb == "function") {
      return starNetVerified(self, "/list_control_units", options, cb);
    } else {
      return simplePromisifyIt(self.listControlUnits, options);
    }
  }
  this.loadSectorRange = function (firstSector, SecondSector, options, cb) { // Allows any input that can create a CoordsObj, including any other Sector or Coords obj
    if (typeof cb == "function") {
      try {
        var sectorToUse1 = new CoordsObj(firstSector); // This will error if invalid input is given.
      } catch (err) {
        console.error("Invalid input given as 'firstSector' to ServerObj.loadSectorRange!");
        return cb(err, null);
      }
      try {
        var sectorToUse2 = new CoordsObj(SecondSector);
      } catch (err) {
        console.error("Invalid input given as 'SecondSector' to ServerObj.loadSectorRange!");
        return cb(err, null);
      }
      return runSimpleCommand(self, "/load_sector_range " + sectorToUse1.toString() + " " + sectorToUse2.toString(), options, cb);
    } else {
      return simplePromisifyIt(self.loadSectorRange, options, firstSector, SecondSector);
    }
  }
  this.friendlyMissileFire = function (trueOrFalse, options, cb) { //  activates or deactivates friendly fire for missiles.
    if (typeof cb == "function") {
      let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      // Does not have success or fail messages
      if (isTrueOrFalse(booleanToUse)) {
        return runSimpleCommand(self, "/missile_defense_friendly_fire " + booleanToUse, options, cb);
      } else {
        return cb(new Error("Invalid input given to Server.friendlyMissileFire() for trueOrFalse!"), null);
      }
    } else {
      return simplePromisifyIt(self.friendlyMissileFire, options, trueOrFalse);
    }
  }
  this.npcLoadedFleetSpeed = function (floatTime, options, cb) { // Expects a number between 0 and 1, ie. 0.5.  Changes how fast, in percentage, npc fleets travel.
    if (typeof cb == "function") {
      let numberToUse = toNumIfPossible(floatTime);
      if (typeof numberToUse == "number") {
        if (numberToUse >= 0 && numberToUse <= 1) {
          return runSimpleCommand(self, "/npc_fleet_loaded_speed " + numberToUse, options, cb);
        }
        return cb(new Error("Invalid input given to Server.npcLoadedFleetSpeed() for floatTime!  Expects a number between 0 and 1. ie. 0.5"), null);
      } else {
        return cb(new Error("Invalid input given to Server.npcLoadedFleetSpeed() for floatTime!  Expects a number between 0 and 1. ie. 0.5"), null);
      }
    } else {
      return simplePromisifyIt(self.npcLoadedFleetSpeed, options, floatTime);
    }
  }
  this.npcTurnAll = function (options, cb) { // "Turn for all NPC factions"
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/npc_turn_all", options, cb);
    } else {
      return simplePromisifyIt(self.npcTurn, options);
    }
  }
  this.refreshServerMessage = function (options, cb) { // Refreshes the server message that players see upon joining the server from the "server-message.txt" located in the StarMade folder.
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/refresh_server_msg", options, cb);
    } else {
      return simplePromisifyIt(self.refreshServerMessage, options);
    }
  }
  this.restructAABB = function (options, cb) { // "Reconstructs the AABBs of all objects on the server"
    if (typeof cb == "function") {
      return runSimpleCommand(self, "/restruct_aabb", options, cb);
    } else {
      return simplePromisifyIt(self.restructAABB, options);
    }
  }
  this.startCountdown = function (timeInSeconds, message, options, cb) { // Expects a number between 0 and 1, ie. 0.5.  Changes how fast, in percentage, npc fleets travel.
    if (typeof cb == "function") {
      let numberToUse = toNumIfPossible(timeInSeconds);
      let messageToUse = toStringIfPossible(message);
      if (typeof numberToUse == "number") {
        if (numberToUse > 0) {
          numberToUse = Math.ceil(numberToUse); // Make sure we are using a whole number that is at least 1
          if (typeof messageToUse == "string") {
            return runSimpleCommand(self, "/start_countdown " + numberToUse, options, cb);
          }
          return cb(new Error("Invalid input given to Server.startCountdown() for message!  Expects a string value!  ie. Explosions happening in.."), null);
        }
        return cb(new Error("Invalid input given to Server.startCountdown() for timeInSeconds!  Expects a number LARGER than 0! ie. 10"), null);
      } else {
        return cb(new Error("Invalid input given to Server.startCountdown() for timeInSeconds!  Expects a number larger than 0! ie. 10"), null);
      }
    } else {
      return simplePromisifyIt(self.startCountdown, options, timeInSeconds, message);
    }
  }
  this.spawnNPCFaction = function (npcName, npcFactionName, npcDescription, initialGrowth, system, options, cb) { // system is optional.  If none given, the npc will be spawned in a random system.
    // DOES NOT GIVE AN ERROR IF THE NPC TYPE IS NOT CORRECT - NEED TO DO MY OWN CHECKING HERE TO SEE IF VALID.
    if (typeof cb == "function") {
      if (!testIfInput(npcName)) {
        return cb(new Error("No NPC name given to server.spawnNPCFaction!"), null); // Input was either blank or a blank object or something.
      }
      var npcNameToUse = npcName.toString(); // If it's an object or something that can be converted to a string, we can use the string.  This will throw an error if it cannot be converted to a string.
      if (typeof npcNameToUse != "string") {
        return cb(new Error("Invalid NPC name given to server.spawnNPCFaction!"), null);
      }
      if (!testIfInput(npcFactionName)) {
        return cb(new Error("No NPC faction name given to server.spawnNPCFaction!"), null); // Input was either blank or a blank object or something.
      }
      var npcFactionNameToUse = npcFactionName.toString();
      if (typeof npcFactionNameToUse != "string") {
        return cb(new Error("Invalid NPC faction name given to server.spawnNPCFaction!"), null);
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
      if (testIfInput(system)) { // Check to see if the system is valid
        try {
          var systemToUse = new SystemObj(system); // this will throw an error if invalid input given.
        } catch (err) {
          return cb(new Error("Invalid System given to server.spawnNPCFaction!"), null);
        }
      }

      // /npc_spawn_faction_pos_fixed
      // DESCRIPTION: Spawns a faction on a fixed position
      // PARAMETERS: name(String), description(String), preset (npc faction config folder name)(String), Initial Growth(Integer), System X(Integer), System Y(Integer), System Z(Integer)
      // EXAMPLE: /npc_spawn_faction_pos_fixed "My NPC Faction" "My Faction's description" "Outcasts" 10 12 3 22
      if (systemToUse) {
        // This is lazy and might return an error in the systemobj rather than pointing here: return systemToUse.spawnNPCFaction(npcName,npcFactionName,npcDescription,initialGrowth,options);
        return runSimpleCommand(self, "/npc_spawn_faction_pos_fixed \"" + npcNameToUse + "\" \"" + npcFactionNameToUse + "\" \"" + npcDescriptionToUse + "\" " + initialGrowthToUse + " " + systemToUse.toString(), options, cb);
      } else {
        return runSimpleCommand(self, "/npc_spawn_faction \"" + npcNameToUse + "\" \"" + npcFactionNameToUse + "\" \"" + npcDescriptionToUse + "\" " + initialGrowthToUse, options, cb);
      }
    } else {
      return simplePromisifyIt(self.spawnNPCFaction, options, npcName, npcFactionName, npcDescription, initialGrowth, system);
    }
  }
  this.search = function (partOfEntityName, options, cb) { // Searches for entities by part of their name.  Accepts inputs that can be converted to string
    // Returns a compound array of EntityObj and SectorObj
    // Example: [[ entityObj, sectorObj],[ entityObj, sectorObj ], [entityObj, sectorObj ]]
    if (typeof cb == "function") {
      var partOfEntityNameToUse = toStringIfPossible(partOfEntityName);
      if (typeof partOfEntityNameToUse == "string") {
        var returnArray = [];
        return starNetVerified(self, "/search " + partOfEntityNameToUse, options, function (err, results) {
          if (err) {
            return cb(err, results);
          }
          let theReg = new RegExp("RETURN: \\[SERVER, FOUND: .*");
          var resultsArray = returnMatchingLinesAsArray(results, theReg);
          var shipName;
          var shipCoords;
          var line;
          var tempArray = [];
          for (let i = 0;i < resultsArray.length;i++) {
            line = resultsArray[i].replace(/^RETURN: \[SERVER, FOUND: /, "");
            shipName = line.replace(/ ->.*$/, "");
            shipCoords = line.replace(/^.* -> \(/, "").replace(/\), 0\]$/, "").split(", ");
            tempArray.push(new EntityObj("", shipName));
            tempArray.push(new SectorObj(shipCoords));
            returnArray.push(tempArray);
            tempArray = [];
          }
          // RETURN: [SERVER, FOUND: second_name -> (2, 2, 2), 0]
          // RETURN: [SERVER, FOUND: And this is named -> (1000, 998, 1000), 0]
          // RETURN: [SERVER, END; Admin command execution ended, 0]
          return cb(null, returnArray); // Array is empty if no results found
        });
      }
      return cb(new Error("Invalid parameters given to Server.search!"), null);
    } else {
      return simplePromisifyIt(self.search, options, partOfEntityName);
    }
  }
  this.status = function (options, cb) { // returns an object with the server's status, as reported by /server_status
    if (typeof cb == "function") {
      return starNetVerified(self, "/status", options, function (err, results) {
        if (err) {
          return cb(err, results);
        }
        // RETURN: [SERVER, PhysicsInMem: 0; Rep: 1, 0]
        // RETURN: [SERVER, Total queued NT Packages: 0, 0]
        // RETURN: [SERVER, Loaded !empty Segs / free: 189 / 184, 0]
        // RETURN: [SERVER, Loaded Objects: 82, 0]
        // RETURN: [SERVER, Players: 1 / 32, 0]
        // RETURN: [SERVER, Mem (MB)[free, taken, total]: [214, 631, 845], 0]
        var returnObj = {};
        var searchReg = /^RETURN: \[SERVER, PhysicsInMem: .*/;
        var remReg1 = /^RETURN: \[SERVER, PhysicsInMem: /;
        var remReg2 = /, 0\]$/;
        var physicsLine = returnLineMatch(results, searchReg, remReg1, remReg2);
        var physicsArray = physicsLine.split("; Rep:");
        returnObj["physics"] = toNumIfPossible(physicsArray[0]);
        returnObj["physicsRep"] = toNumIfPossible(physicsArray[1]);

        searchReg = /^RETURN: \[SERVER, Total queued NT Packages: .*/;
        remReg1 = /^RETURN: \[SERVER, Total queued NT Packages: /;
        remReg2 = /, 0\]$/;
        returnObj["queuedNTPackages"] = toNumIfPossible(returnLineMatch(results, searchReg, remReg1, remReg2));

        searchReg = /^RETURN: \[SERVER, Loaded !empty Segs \/ free:.*/;
        remReg1 = /^RETURN: \[SERVER, Loaded !empty Segs \/ free: /;
        remReg2 = /, 0\]$/;
        var loadedSegsLine = returnLineMatch(results, searchReg, remReg1, remReg2);
        var loadedSegsArray = loadedSegsLine.split(" / ");
        returnObj["loadedEmptySegs"] = toNumIfPossible(loadedSegsArray[0]);
        returnObj["loadedEmptySegsFree"] = toNumIfPossible(loadedSegsArray[1]);

        searchReg = /^RETURN: \[SERVER, Loaded Objects: .*/;
        remReg1 = /^RETURN: \[SERVER, Loaded Objects: /;
        remReg2 = /, 0\]$/;
        returnObj["loadedObjects"] = toNumIfPossible(returnLineMatch(results, searchReg, remReg1, remReg2));

        searchReg = /^RETURN: \[SERVER, Players: .*/;
        remReg1 = /^RETURN: \[SERVER, Players: /;
        remReg2 = /, 0\]$/;
        var playersLine = returnLineMatch(results, searchReg, remReg1, remReg2);
        var playersArray = playersLine.split(" / ");
        returnObj["players"] = toNumIfPossible(playersArray[0]);
        returnObj["playersMax"] = toNumIfPossible(playersArray[1]);

        searchReg = /^RETURN: \[SERVER, Mem \(MB\)\[free, taken, total\]: \[.*/;
        remReg1 = /^RETURN: \[SERVER, Mem \(MB\)\[free, taken, total\]: \[/;
        remReg2 = /\], 0\]$/;
        var memLine = returnLineMatch(results, searchReg, remReg1, remReg2);
        var memArray = memLine.split(", ");
        returnObj["memFree"] = toNumIfPossible(memArray[0]);
        returnObj["memTaken"] = toNumIfPossible(memArray[1]);
        returnObj["memTotal"] = toNumIfPossible(memArray[2]);
        return cb(null, returnObj);
      });
    } else {
      return simplePromisifyIt(self.status, options);
    }
  }

  // #####################
  // ####   EVENTS    ####
  // #####################
  event.on("unloadMods",function(){ // Shut down the server and any pids, quickly.
    console.log("unloadMods event detected!  Killing all PIDs!");
    self.killAllPIDs();
    // Unregister any constructors
    console.log("Unregistering all constructors..");
    self.deregAllConstructors();
  });

  // ######################
  // ####   STARTER    ####
  // ######################
  if (self.settings.autoStart == true){
    console.log("Auto-start is on!  Starting server..");
    self.start();
  }
  self.spawnStatusWanted="started";

  // shutdown(seconds,"message") // message is optional.  If given, a countdown timer will be used and then a 1 second shutdown when it is set to expire.
  // ip
  //

  // New Methods needed:

  // shutdown(TimeInSeconds,publicMessageString,CountdownMessageString) - No fields are required, but if no time is given, 10 seconds is default.  If a publicMessageString is given, an announcement is made to the public channel. If CountdownMessageString is provided, then a countdown starts with a message and 1 second before it ends, the actual shutdown is started.  This will allow the server to shut down without auto-restarting.
};
