if (__filename == require.main.filename) {
  console.log("This script should not be ran by itself!  Exiting..");
  process.exit();
}

module.exports = { // Always put module.exports at the top so circular dependencies work correctly.
  // init, // This is needed so objects can send text directly to the server
  ServerObj
}

// Requires
const path = require('path');
// const EventEmitter = require('events');
// class Event extends EventEmitter {};
const prompt = global["prompt"]; // This creates sync prompts and can have auto-complete capabilties.
// const events               = require('events');
const spawn = require('child_process').spawn;
const {treeKill} = global;
const objectHelper=require("./helpers/objectHelper.js");
const miscHelpers=require("./helpers/miscHelpers.js");
const regExpHelper=require("./helpers/regExpHelper.js");
const ini=require("./helpers/iniHelper.js");
const installAndRequire=require("./helpers/installAndRequire.js");
const mySleep=require("./helpers/mySleep.js");
const {softsleep:sleepSync,sleepPromise:sleep}=mySleep;
const {i} = miscHelpers;

// TODO:  Below needs to be fixed, because they require a serverObj to initialize correctly
const setSettings = require("./bin/setSettings.js"); // This will confirm the settings.json file is created and the install folder is set up.
const sqlQueryJs = require("./sqlQuery.js");
const starNetJs = require("./starNet.js");
const serverObjects = require("./serverObjects.js");
const smInstallHelpers = require("./bin/smInstallHelpers.js");
const {spawnStarMadeInstallTo,verifyInstall,generateConfigFiles,isInstalled}=smInstallHelpers;
const lineProcessor = require("./lineProcessor.js");
const {processDataInput} = lineProcessor; // These cannot be used till the ServerObj has been created since it relies on creating objects from the serverObj.

// Aliases for requires - These are set up for readability
const {simpleSqlQuery} = sqlQueryJs;
const {
  starNet,
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
  isInArray,
  testIfInput,
  trueOrFalse,
  isTrueOrFalse,
  isNum,
  colorize,
  getObjType,
  returnLineMatch,
  applyFunctionToArray,
  simplePromisifyIt,
  toTrueOrFalseIfPossible,
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
  waitAndThenKill,
  waitAndThenKillSync
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
var {settings,log,installPath,event}=installObj;
var thisConsole=installObj.console;

function ServerObj(options) { 
  // This us used to run server commands or gather specific information regarding the server.
  
  // This object is set up so that there can only be 1 per install.  If a new one is attempted, it will just return the original serverObj.
  
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

  if (installObj.hasOwnProperty("serverObj")) { // Check to see if this serverObj has already been created, returning that object if so.
    thisConsole.error("Server already initialized!  Ignoring any settings you may have set and using the existing server object!");
    return installObj.serverObj; // TODO: Test this.  I have no idea if this will work or not
  }

  var forceStart = getOption(options, "forceStart", false);
  var ignoreLockFile = getOption(options, "ignoreLockFile", false);;

  var response = "";
  var self = this; // This is needed to keep this context within subfunctions
  this.serverName = path.basename(installObj.path);
  // this.console = new CustomConsole(self.serverName); // This is to output text only when the user has switched to the console for this server.  It's a fully operational Console object.
  this.console = installObj.console; // redundant
  // Paths
  //  #####################
  //  ### SETTINGS SETUP ## - Set up any missing settings.  This is synchronous and uses prompt currently
  //  #####################   This includes RAM usage, bot name, command operator, etc.
  installObj.settings=setSettings(installObj.settings);
  global.writeSettings();

  this.settings = installObj.settings; // Complete any missing settings.  If a starMadeFolder argument was given, this will be used as the install path.  This includes the starmade folder, min and max java settings, etc.
  thisConsole.log("installObj.settings: " + installObj.settings);
  this.installFolder = self.settings["installFolder"];
  // We have to do the below check AFTER the settings were set up because we don't know what the starmade folder will be if none was provided to the object
  // this.event = event; // This should be obsoleted, because it will cause confusion
  global.settings.servers[self.installFolder] = self.settings;
  // Before we go any further, we should check to see if there are any previous PIDs associated with this server and kill them if necessary.
  // ###################
  // ###  SMART LOCK ### // TODO: Move this to the starter.js and make it asynchronous
  // ###################
  if (self.settings.hasOwnProperty("lockPIDs")) {
    var lockPIDs = [];
    if (self.settings.lockPIDs.length > 0 && ignoreLockFile == false) {
      lockPIDs = copyArray(self.settings.lockPIDs);
      for (let i = 0;i < lockPIDs.length;i++) {
        if (isPidAlive(lockPIDs[i])) {
          thisConsole.log("Existing server process found running on PID, '" + lockPIDs[i] + "'!");
          if (forceStart == true) {
            thisConsole.log("forceKill flag set!  Auto-killing PID!");
            response = "yes";
          } else {
            response = prompt("If you want to kill it, type 'yes': ").toLowerCase();
          }
          if (response == "yes") {
            thisConsole.log("TREE KILLING WITH EXTREME BURNINATION!");
            treeKill(lockPIDs[i], 'SIGTERM'); // TODO: resolve an error happening here
            // We should initiate a loop giving up to 5 minutes for it to shut down before sending a sig-kill.
            waitAndThenKillSync(300000, lockPIDs[i],{"console":thisConsole}); // MaxTimeToWait/PID/Options -- This uses SIGKILL
            sleepSync(1000); // Give the sigKILL time to complete if it was necessary.
            self.settings.lockPIDs = arrayMinus(self.settings.lockPIDs, lockPIDs[i]); // PID was killed, so remove it from the settings.json file.
          } else {
            thisConsole.log("Alrighty, I'll just let it run then.");
          }
        } else {
          thisConsole.log("Prior starmade.js wrapper PID (" + lockPIDs[i] + ") not running. Cool.");
          self.settings.lockPIDs = arrayMinus(self.settings.lockPIDs, lockPIDs[i]); // PID wasn't alive, so remove it from the settings.json file.
        }
      }
      thisConsole.log("");
      if (self.settings.lockPIDs.length > 0) {
        // TODO:  Find a different solution here.  It should simply
        // We never want to start the wrapper if any of the PIDs are still alive, unless the person started with the argument to ignore the lock file
        thisConsole.log("\nDANGER WILL ROBINSON!  There are " + self.settings.lockPIDs.length + " server processes still running!");
        thisConsole.log("We cannot start the server while an existing server might still be running!  Cancelling!");
        // thisConsole.log("NOTE: If you are 100% SURE that these the PIDs from the lock file are NOT from another server running, you can create the server object again with the option, {ignoreLockFile:true}.  This will ignore the old PIDs and delete them from the settings.json file.");
        // thisConsole.log("NOTE2: If you want to create this server object auto-killing any old PID's, you can use the {forceStart:true} option.");
        // process.exit(1);
        return false; // We don't want to kill the main process anymore.

      }
    } else if (self.settings.lockPIDs.length > 0) {
      var settingsBackupFile = path.join(self.installFolder, "settingsBackup.json");
      thisConsole.log("Ignoring existing server PIDs and deleting them from the settings.json file.  Saving a backup here: " + settingsBackupFile);
      writeJSONFileSync(settingsBackupFile, global.settings);
      self.settings.lockPIDs = [];
    }
  } else {
    // No lockPIDs set up for this server, so set it to an empty array.
    self.settings.lockPIDs = [];
  }
  this.lockPIDS = installObj.settings.lockPIDs;
  global.writeSettings(); // Write the global settings.json to the hard drive in case the lockPIDs were updated
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


  // this.log=installObj["log"]; // Obsoleteing to avoid confusion
  // ####################
  // ### FOLDER SETUP ###  - Set up any folders needed
  // ####################

  ensureFolderExists(self.installFolder);
  // ensureFolderExists(self.starMadeInstallFolder); // Obsoleting.  We should leave it to the StarMade installer to create the folder
  // ### Install folders
  this.logsFolder = path.join(self.installFolder, "logs");
  this.modsFolder = path.join(installObj.path, "mods"); 
  this.starMadeInstallFolder = path.join(self.installFolder, "StarMade");
  // ### StarMade subfolders and files
  this.starMadeLogFolder = path.join(self.starMadeInstallFolder, "logs"); // This is added because we have to parse the serverlog.0.log file for ship spawns
  this.starMadeJar = path.join(self.starMadeInstallFolder, "StarMade.jar");

    
  this.starMadeInstallerFilePath = global["starMadeInstallerFilePath"];
  this.serverCfgFilePath = path.join(self.starMadeInstallFolder, "server.cfg");

  //  We use a getter because we need to ensure the server has been installed before we pull the config
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
  this.blockTypePropertiesFilePath=path.join(self.starMadeInstallFolder, "data", "config","BlockTypes.properties");
  this.getblockTypePropertiesAsIniObj = function () { // callbackify and promisify this
    // This should only be ran AFTER a successful install has been performed
    if (typeof self.blockTypePropertiesObj == "object"){
      return self.blockTypePropertiesObj; // This is an iniObj.  This should get deleted when the server exits.
    }
    if (existsAndIsFile(self.blockTypePropertiesFilePath)) {
      self.blockTypePropertiesObj = ini.getFileAsObj(self.blockTypePropertiesFilePath); // This generates a new ini file object each time it's ran
      return self.blockTypePropertiesObj;
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
    // It seems the newest version of starmade is setting it to "mypassword34!"
    if ((/^mypassword.*/).test(superAdminPassword) || !superAdminPassword) { // "mypassword" is the default value upon install.  We do not want to keep this since it'd be a major security vulnerability.
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
      if (self.spawnStatus == "started"){
        thisConsole.log("Server is already installed and started!  Aborting!");
        return cb(null,false);
      }
      // TODO:  Switch to using asychronous methods only
      return spawnStarMadeInstallTo(self.installFolder,global["starMadeInstallerFilePath"],options,function(err,result){
        // No need to verify the install, the installer will generate configs.
        if (err){
          return cb(err,false);
        }
        if (result == true){
          // install succeeded
          var testCfgFile = self.getServerCfgAsIniObj();
          if (testCfgFile === null) { // This should never happen
            thisConsole.error("ERROR: Could not retrieve server.cfg file.  Was there an error during install?  Please try the install again!");
            return cb(new Error("Could not retreive server.cfg file.  Install corrupted?"), false);
          }
          self.getSuperAdminPassword(); // Set the super admin password
          return cb(null,true); // Install success!
        } else {
          // install failed
          return cb(new Error(`Install failed for server: ${installObj.path}`,false));
        }
      });
    }
    return simplePromisifyIt(self.install, options);
  }
  this.verifyInstall = function(options,cb){ // Generates config files if they don't exist
    if (typeof cb == "function"){
      return verifyInstall(self.installFolder,options,cb);
    }
    return simplePromisifyIt(self.verifyInstall,options);
  }
  this.isInstalled = function(options,cb){ // Returns true/false if installed
    if (typeof cb == "function"){
      return isInstalled(self.installFolder,options,cb);
    }
    return simplePromisifyIt(self.isInstalled,options);
  }
  this.bot = new BotObj(installObj.settings["botName"]); // Only has a few methods right now, but could be expanded on later to include the discord bot.

  // #### Settings
  this.ignoreLockFile = false;
  this.forceStart = false;

  this.buildBranch = installObj.settings["buildBranch"].toLowerCase().trim(); // Should be normal/dev/pre.  This value does not change if the setting is updated in memory till the server is restarted

  // Todo:  add stop(), kill(), forceKill(), isResponsive(), etc.
  // This might be useful for spawning:  this.spawn=spawn("java",this.javaArgs,{"cwd": this.settings["starMadeInstallFolder"]});

  // this.spawn=spawn("java",self.spawnArgs,{"cwd": self.starMadeInstallFolder}); // TEMP for testing
  this.spawnStatus = "stopped"; // By default the server is not spawned yet at this point in the scripting.
  this.spawnStatusWanted = "stopped"; // This is the end result of what the current process should be, such as if the status is "stopping", the wanted status is "stopped"
  this.runSimpleCommand=runSimpleCommand;
  this.starNet=starNet;
  this.starNetVerified=starNetVerified;
  this.sendDirectToServer=sendDirectToServer;
  
  this.start = function (options, cb) {
    if (typeof cb == "function") {
      // Set up the spawn arguments based on current settings
      // TODO: Add support for JVM arguments

      var baseJavaArgs = ["-Xms" + installObj.settings["javaMin"], "-Xmx" + installObj.settings["javaMax"], "-jar"]; // These run on any OS.  
      if (installObj.settings.hasOwnProperty("addionalJavaArgs")) { // If certain custom java args are used, such as modifying the way java garbage collection happens
        baseJavaArgs = installObj.settings.addionalJavaArgs.concat(baseJavaArgs);
      }
      var baseJavaArgsWindows = ["-Xincgc", "-Xshare:off"]; // These will run on windows only
      var baseSMJarArgs = [self.starMadeJar, "-server", "-port:" + installObj.settings["port"]];
      // TODO:  Remove the below commented section
      // I have no idea why I thought pre and dev were needed here.  That is only used for installs and updates..
      // if (self.buildBranch == "pre") {
      //   baseSMJarArgs.push("-pre");
      // } else if (self.buildBranch == "dev") {
      //   baseSMJarArgs.push("-dev");
      // }
      if (process.platform == "win32") {
        self.spawnArgs = baseJavaArgs.concat(baseJavaArgsWindows).concat(baseSMJarArgs);
      } else {
        self.spawnArgs = baseJavaArgs.concat(baseSMJarArgs);
      }
      // Will run like this java [spawnArgs]
      // [spawnArgs] includes [java arguments] -jar [starmade.jar arguments]

      // First check to see if the process already exists or not.
      if (self.hasOwnProperty("spawn")) { // If a spawn object has already been created, let's verify if it is running or not
        thisConsole.log("Attempting to start the server.."); // temp
        if (self.spawnStatus == "started") {
          thisConsole.log("ERROR: Cannot start server.  It is already started!");
          return cb(null, false);
        } else if (self.spawnStatus != "stopped") { // Server may be shutting down or in an error state
          thisConsole.log("ERROR: Cannot start server.  It has not been shut down yet!  If the server is in an error state, it must be stopped before started again!");
          return cb(null, false);
        }
      }
      // Before starting the server, make sure the superAdminPassword has been set up correctly.
      self.getSuperAdminPassword(); // This also reloads the ini file for server.cfg
      self.getblockTypePropertiesAsIniObj();  // this loads self.blockTypePropertiesObj
      thisConsole.log("Starting the server..");
      self.spawn = spawn("java", self.spawnArgs, {"cwd": self.starMadeInstallFolder}); // Spawn the server
      self.spawnStatus = "started";
      self.spawnStatusWanted= "started"; // This tells us if the server crashes or something, we know it should be restarted.
      event.emit("serverStart",self); // Provides the serverObj
      // global["servers"][self.installFolder]=self.spawn; // Old method, plus no need to add the spawn, since this adds it to the ServerObj
      self.addLockPID(self.spawn.pid);

      self.spawn.on('disconnect', function () {
        thisConsole.log("###### SPAWN STATUS SET TO:  disconnect");
        self.spawnStatus = "disconnected";
        event.emit("serverDisconnect",self.spawn);
        if (self.hasOwnProperty("spawnStatusCode")) {
          Reflect.deleteProperty(self, "spawnStatusCode");
        }
      });
      self.spawn.on('error', function (data) { // This happens when a process could not be spawned, killed, or sending a message to the child process failed.
        // Note:  This does not mean the spawn has exited, but it is possible that it did.  We will rely on the 'exit' event to remove the PID from the lock
        thisConsole.log("###### SPAWN STATUS SET TO:  error");
        self.spawnStatus = "serverError";
        event.emit("error",data);
        if (self.hasOwnProperty("spawnStatusCode")) {
          Reflect.deleteProperty(self, "spawnStatusCode");
        }
      });
      self.spawn.on('exit', function (code) { // I'm guessing if a non-zero code is given, it means the server errored out.
        thisConsole.log("###### SPAWN STATUS SET TO:  exited");
        self.spawnStatus = "stopped";
        event.emit("serverStop",code);
        self.removeLockPID(self.spawn.pid);
        thisConsole.log("Removed PID, '" + self.spawn.pid + "' from lockPIDs.");
        if (typeof toStringIfPossible(code) == "string") {
          thisConsole.log('Server instance exited with code: ' + code.toString());
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
        if (self.hasOwnProperty("blockTypePropertiesObj")) { // Same as above. The BlockType.properties file can change between reboots.
          Reflect.deleteProperty(self, "blockTypePropertiesObj");
        }
      });

      // Set up the listeners for the main process and for the serverlog
      // ####################
      // ###    WRAPPER   ###
      // ####################

      self.spawn.stdout.on('data', function (data) { // Displays the standard output from the starmade server
        let dataString = data.toString().trim(); // Clear out any blank lines
        if (dataString != "") {
          // Data chunks can have multiple lines, so let's split them up to process each line.
          let dataArray = dataString.replace("\r", "").split("\n"); // simplify to only new line characters and split to individual lines.
          for (let i = 0;i < dataArray.length;i++) {
            if (dataArray[i] != "") {
              if (self.settings.showStdout == true || self.settings.showAllEvents == true) {
                if (typeof self.settings.stdoutFilter == "object") {
                  if (self.settings.stderrFilter.test(dataArray[i])) {
                    thisConsole.log("STDOUT: " + dataArray[i]);
                  }
                } else {
                  thisConsole.log("STDOUT: " + dataArray[i]);
                }
              }
              processDataInput(dataArray[i]); // Process the line to see if it matches any events and then trigger the appropriate event
            }
          }
        }
      });

      self.spawn.stderr.on('data', function (data) { // Displays the error output from the starmade server
        let dataString = data.toString().trim(); // Clear out any blank lines
        if (dataString != "") {
          // Data chunks can have multiple lines, so let's split them up to process each line.
          let dataArray = dataString.replace("\r", "").split("\n"); // simplify to only new line characters and split to individual lines.
          for (let i = 0;i < dataArray.length;i++) {
            if (dataArray[i]) {
              if (self.settings.showStderr == true || self.settings.showAllEvents == true) {
                if (typeof self.settings.stderrFilter == "object") {
                  if (self.settings.stderrFilter.test(dataArray[i])) {
                    thisConsole.log("STDERR: " + dataArray[i]);
                  }
                } else {
                  thisConsole.log("STDERR: " + dataArray[i]);
                }
              }
              processDataInput(dataArray[i]); // Process the line to see if it matches any events and then trigger the appropriate event
            }
          }
        }
      });
      return cb(null, this.spawn);
    } else {
      return simplePromisifyIt(self.start, options);
    }
  }
  this.stop = function (duration, message, options, cb) {
    if (typeof cb == "function") {
      if (self.spawnStatus=="started"){
        thisConsole.log(`Stop function ran with duration: ${duration}  and message: ${message}`);
        event.emit("serverStopping");
        self.spawnStatus = "stopping";
        self.spawnStatusWanted="stopped";
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
            return runSimpleCommand("/start_countdown " + theDuration + " " + theMessage, options, async function (err, result) {
              if (err) {
                thisConsole.error("Shutdown command failed with an error when attempting to start a countdown!");
                self.spawnStatus = "started";
                return cb(err, null);
              }
              if (result) {
                await sleep(theDuration * 1000);
                return runSimpleCommand("/shutdown 1", options, function(err,result){
                  if (err){
                    thisConsole.log("Shutdown command failed with an error when attempting to start the one second shutdown!");
                    self.spawnStatus = "started";
                    return cb(err, null);
                  }
                  if (result){ // Should be true if the command succeeded.  The spawn.on("exit") will change the spawnStatus to stopped
                    return cb(null,result);
                  } else {
                    thisConsole.error("Shutdown command failed due to connection error!");
                    self.spawnStatus = "started";
                    return cb(new Error("Shutdown command failed due to connection error!"),null);
                  }
                });
              } else {
                thisConsole.error("Shutdown command failed due to connection error!");
                self.spawnStatus = "started";
                return cb(new Error("Shutdown command failed due to connection error!"), null);
              }
            });
          } else {
            thisConsole.log("No message given, so using default shutdown message..");
            return runSimpleCommand("/start_countdown " + theDuration + '" Server shutting down in.."', options, async function (err, result) {
              if (err) {
                thisConsole.log("Shutdown command failed with an error when attempting to start a countdown!");
                self.spawnStatus = "started";
                return cb(err, null);
              }
              if (result) {
                await sleep(theDuration * 1000);
                return runSimpleCommand("/shutdown 1", options, function(err,result){
                  if (err){
                    thisConsole.log("Shutdown command failed with an error when attempting to start the one second shutdown!");
                    self.spawnStatus = "started";
                    return cb(err, null);
                  }
                  if (result){ // Should be true if the command succeeded.  The spawn.on("exit") will change the spawnStatus to stopped
                    return cb(null,result);
                  } else { // This should never happen
                    thisConsole.error("Shutdown command failed due to connection error!");
                    self.spawnStatus = "started";
                    return cb(new Error("Shutdown command failed due to connection error!"),null);
                  }
                });
                // When the server is stopped, it will change the spawnStatus
              } else {
                thisConsole.error("Shutdown command failed due to connection error!");
                self.spawnStatus = "started";
                return cb(new Error("Shutdown command failed due to connection error!"), null);
              }
            });
          }
        } else {
          thisConsole.log("Shutting down immediately!");
          return runSimpleCommand("/shutdown 1", options, cb);
        }
      } else if (self.spawnStatusWanted=="stopping" || self.spawnStatusWanted=="forceStopping"){
        thisConsole.log("Server Stop attempted, but server is already stopping!  Please allow stop attempt to complete!");
        return cb(null,false);
      } else if (self.spawnStatusWanted=="stopped"){
        thisConsole.log("Server Stop attempted, but the server is already stopped!");
        return cb(null,false);
      } else if (self.spawnStatusWanted=="errored"){
        thisConsole.log("Server Stop attempted while server in error state!");
        // This should determine if the server has, in fact been shut down or not.
        return cb(null,false);
      }
      return cb(null,null);
    } else {
      return simplePromisifyIt(self.stop, options, duration, message);
    }
  }
  this.restart = function(duration,message,options,cb){
    if (typeof cb == "function"){
      return self.stop(duration,message,options,function(err,result){
        if (err){
          return cb(new Error("ERROR when attempting to stop server on restart!"),false);
        }
        if (result == true){
          return self.start(options,function(err,result){
            if (err){
              return cb(new Error("ERROR starting server on restart!"),false);
            }
            if (result == true){
              return cb(null,true);
            } else {
              return cb(null,false); //
            }
          });
        } else {
          return cb(new Error("Server failed to stop on restart!"),false);
        }
      });
    } else {
      return simplePromisifyIt(self.restart,options,duration,message);
    }
  }
  this.forceStop = function(options,cb){ 
    // This will guarantee a shutdown but may take up to 5 minutes to complete
    // This will kill any PIDs associated with this server, first with sigTERM, then with sigKILL after 5 minutes.
    // Note:  This does not attempt a /shutdown command and may be unsafe.
    if (typeof cb == "function"){
      if (self.spawnStatus == "stopped"){
        thisConsole.log("Server already stopped! Nothing to do!");
        return cb(null,false); // Returns false because there was nothing to stop
      }
      if (self.lockPIDs.length>0){
        thisConsole.log("Force stopping the server and any associated PIDs..");
        event.emit("serverStopping");
        self.spawnStatus = "forceStopping";
        self.spawnStatusWanted="stopped";
        var pidsArray=[];
        var lockPidsArrayCopy=copyArray(self.lockPIDs); // We use a copy because the main PID is removed if it dies
        for (let i=lockPidsArrayCopy.length-1;i>=0;i--){
          thisConsole.log(`KILLING PID #${i}: ${lockPidsArrayCopy[i]}`);
          treeKill(lockPidsArrayCopy[i], 'SIGTERM'); // Tree kill is overkill right now since the server doesn't spawn more than 1 PID, but hey maybe in the future it will.
          // Ensure the PID is killed, waiting up to 5 minutes before force killing it.
          pidsArray.push(waitAndThenKill(300000, lockPidsArrayCopy[i], {"console":thisConsole}).catch((err) => thisConsole.error(err)));
        }
        return Promise.all(pidsArray).then(function(resultsArray){ // once all PIDs should be dead.. make sure of the results
          var allDead=true;
          for (let i=0;i<resultsArray.length;i++){
            if (resultsArray[i] == true){
              self.removeLockPID(lockPidsArrayCopy[i]);
            } else {
              allDead=false;
            }
          }
          if (allDead){
            return cb(null,true);
          } else {
            return cb(null,false); // This should never happen, but if it does, the spawnStatus will be "forceStopping" forever
          }
        });
      } else {
        // No lockpids to kill.  Is the server running?
        thisConsole.log("ERROR:  Cannot force stop server, No lock pids to kill!");
        return cb(null,false);
      }

    }
    return self.forceStop(options);
  }
  this.kill = function (options, cb) {
    // only kills the server PID, not any others registered under the PIDs
    // This does NOT guarantee the process it shuts down, even if true is returned.

    // Returns (ErrorObject,null) if there is an error when attempting to send the kill signal to the PID
    // Returns (null,false) if the spawn previously was ran, but the PID is no longer active
    // returns (null,false) if the spawn object has no PID associated with it
    if (typeof cb == "function") {
      if (self.spawn.hasOwnProperty("pid")) {
        if (isPidAlive(self.spawn.pid)) {
          self.spawnStatus = "killing";
          try {
            return cb(null, self.spawn.kill()); // Sends SIGTERM
          } catch (err) {
            thisConsole.log("Error when attempting to kill server spawn (with TERM signal)!");
            return cb(err, null);
          }
        } else {
          thisConsole.log(`Spawn PID (${self.spawn.pid}) was not alive!  Cannot kill it!`);
          return cb(null, false);
        }
      } else {
        thisConsole.log("Cannot kill spawn.  There is no PID associated with it!");
        return cb(null, false);
      }
    } else {
      return simplePromisifyIt(self.kill, options);
    }
  }
  this.forcekill = function (options, cb) {
    // This is dangerous and will send a KILL signal to the process to immediately shut it down.
    // Returns (ErrorObject,null) if there is an error when attempting to send the kill signal to the PID
    // Returns (null,false) if the spawn previously was ran, but the PID is no longer active
    // returns (null,false) if the spawn object has no PID associated with it
    if (typeof cb == "function") {
      if (self.spawn.hasOwnProperty("pid")) {
        if (isPidAlive(self.spawn.pid)) {
          self.spawnStatus = "forceKilling";
          try {
            return cb(null, self.spawn.kill('SIGKILL')); // Sends SIGTERM
          } catch (err) {
            thisConsole.log("Error when attempting to kill server spawn (with KILL signal)!");
            return cb(err, null);
          }
        } else {
          thisConsole.log(`Spawn PID (${self.spawn.pid}) was not alive!  Cannot kill it!`);
          return cb(null, false);
        }
      } else {
        thisConsole.log("Cannot kill spawn.  There is no PID associated with it!");
        return cb(new Error(null, false));
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
      return getPlayerList(options, cb);
    } else {
      return simplePromisifyIt(self.onlinePlayers, options);
    }
  }
  // TODO:  Create a this.resolvePlayerName function, utilizing player files to find correct capitalization
  this.resolveOnlinePlayerName = function (playerName,options,cb){
    // Takes a playername of any caps and resolves to the correct caps for the online player
    // Returns PlayerObj if player found, false if not online, or null if there was an error
    // Does not resolve the player name if offline
    if (typeof cb == "function") {
      if (typeof playerName == "string"){
        return getPlayerList(options, function(err,results){
          if (err){
            return cb(err,results);
          }
          // TODO: FIX THIS.  Getting call stack size exceeded. I am guessing this is actually not returning an array or something. // temp
          for (let e=0;e<results.length;e++){
            if (i(results[e].name,playerName)){
              return cb(null,results[e]);
            }
          }
          return cb(null,false); // Name did not resolve to any online player
        });
      } else {
        return cb(new Error("Invalid input given as playerName.  Expects a string!"),null)
      }
    } else {
      return simplePromisifyIt(self.resolveOnlinePlayerName,options,playerName);
    }
  }

  this.getAdmins = function (options, cb) {
    if (typeof cb == "function") {
      return getAdminsList(options, cb);
    } else {
      return simplePromisifyIt(self.getAdmins, options);
    }
  };
  this.getBannedAccounts = function (options, cb) {
    if (typeof cb == "function") {
      return getBannedAccountsList(options, cb)
    } else {
      return simplePromisifyIt(self.getBannedAccounts, options);
    }
  };
  this.getBannedIPs = function (options, cb) {
    if (typeof cb == "function") {
      return getBannedIPList(options, cb);
    } else {
      return simplePromisifyIt(self.getBannedIPs, options);
    }
  };
  this.getBannedNames = function (options, cb) {
    if (typeof cb == "function") {
      return getBannedNameList(options, cb);
    } else {
      return simplePromisifyIt(self.getBannedNames, options);
    }
  };
  this.getWhitelistedAccounts = function (options, cb) {
    if (typeof cb == "function") {
      return getWhitelistedAccountsList(options, cb);
    } else {
      return simplePromisifyIt(self.getWhitelistedAccounts, options);
    }
  };
  this.getWhitelistedIPs = function (options, cb) {
    if (typeof cb == "function") {
      return getWhitelistedIPList(options, cb);
    } else {
      return simplePromisifyIt(self.getWhitelistedIPs, options);
    }
  };
  this.getWhitelistedNames = function (options, cb) {
    if (typeof cb == "function") {
      return getWhitelistedNameList(options, cb);
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
      return runSimpleCommand("/server_message_broadcast " + msgType + " '" + messageToSend.toString().trim() + "'", options, cb);
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
      return runSimpleCommand("/clear_system_ship_spawns_all", options, cb);
    } else {
      return simplePromisifyIt(self.clearShipSpawns, options);
    }
  }
  this.daytime = function (timeInHours, options, cb) {
    if (typeof cb == "function") {
      let timeToUse = toNumIfPossible(timeInHours);
      // Does not have success or fail messages
      if (typeof timeToUse == "number") {
        return runSimpleCommand("/daytime " + timeToUse, options, cb);
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
        return runSimpleCommand("/delay_save " + timeToUse, options, cb);
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
      return runSimpleCommand("/despawn_all \"" + partOfShipNameToUse + "\" " + usedToUse + " " + shipOnlyToUse, options, cb);
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
        return runSimpleCommand("/export_sector_bulk " + textFileToUse, options, cb);
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
        return runSimpleCommand("/import_sector_bulk " + textFileToUse, options, cb);
      }
      return cb(new Error("Invalid textFileToUse specified for Server.importSectorBulk"), null);
    } else {
      return simplePromisifyIt(self.importSectorBulk, options, textFileToUse);
    }
  }
  this.factionSanityCheck = function (options, cb) { // checks sanity of factions (removes leftover/invalid factions)
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand("/faction_check", options, cb);
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
          return runSimpleCommand("/faction_create_as " + factionNumberToUse + " " + factionNameToUse + " " + playerNameToUse, options, cb);
        }
        return runSimpleCommand("/faction_create " + factionNameToUse + " " + playerNameToUse, options, cb);
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
        return runSimpleCommand("/faction_create_amount " + factionNameToUse + " " + numberOfFactionsToUse, options, cb);
      }
      throw new Error("Invalid parameters given to Server.factionCreateAmount!");
    } else {
      return simplePromisifyIt(self.factionCreateAmount, options, factionName, factionName, numberOfFactions);
    }
  }
  this.factionPointTurn = function (options, cb) { // Forces the next faction point calculation turn
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand("/faction_point_turn", options, cb);
    } else {
      return simplePromisifyIt(self.factionPointTurn, options);
    }
  }
  this.factionReinstitute = function (options, cb) {
    // Does not have success or fail messages
    if (typeof cb == "function") {
      return runSimpleCommand("/faction_reinstitute", options, cb);
    } else {
      return simplePromisifyIt(self.factionReinstitute, options);
    }
  }
  this.fleetSpeed = function (timeInMs, options, cb) {
    // Does not have success or fail messages
    if (typeof cb == "function") {
      let numberToUse = toNumIfPossible(timeInMs);
      if (typeof numberToUse == "number") {
        return runSimpleCommand("/fleet_speed " + numberToUse, options, cb);
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
        return runSimpleCommand("/fog_of_war " + booleanToUse, options, cb);
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
        return runSimpleCommand("/ignore_docking_area " + booleanToUse, options, cb);
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
      thisConsole.log("Running force save..");
      return runSimpleCommand("/force_save", options, cb);
    } else {
      return simplePromisifyIt(self.forceSave, options);
    }
  }
  this.activateWhitelist = function (trueOrFalse, options, cb) { //  activates the whitelist, so only players listed in the whitelist.txt file can join the server.
    // Does not have success or fail messages
    if (typeof cb == "function") {
      let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      if (isTrueOrFalse(booleanToUse)) {
        return runSimpleCommand("/whitelist_activate " + booleanToUse, options, cb);
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
      return runSimpleCommand("/update_shop_prices", options, cb);
    } else {
      return simplePromisifyIt(self.updateShopPrices, options);
    }
  }
  this.sectorSize = function (sizeInM, options, cb) { // Resizes the sector for the server - writes to the server.cfg file
    // WARNING: Setting sector sizes to be smaller can cause some really bizarre issues if entities are now outside of the sector but still inside it!
    if (typeof cb == "function") {
      let numberToUse = toNumIfPossible(sizeInM);
      if (typeof numberToUse == "number") {
        return runSimpleCommand("/sector_size " + numberToUse, options, cb);
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
        return runSimpleCommand("/set_weapon_range_reference " + numberToUse, options, cb);
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
        return runSimpleCommand("/simulation_ai_enable " + booleanToUse, options, cb);
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
      return runSimpleCommand("/simulation_clear_all", options, cb);
    } else {
      return simplePromisifyIt(self.simulationClear, options);
    }
  }
  this.simulationSpawnDelay = function (timeInSeconds, options, cb) { // Not sure what this does.  If I had to guess what this is for, it's the delay before pirates come attack when near a pirate station or in void space?  I think the help for this command is wrong which is:  sets the time of the day in hours
    if (typeof cb == "function") {
      let timeToUse = toNumIfPossible(timeInSeconds);
      if (typeof timeToUse == "number") {
        return runSimpleCommand("/set_weapon_range_reference " + timeToUse, options, cb);
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
      return starNetVerified("/simulation_info", options, cb);
    } else {
      return simplePromisifyIt(self.simulationInfo, options);
    }
  }
  this.factionList = function (options, cb) { // Returns an array of FactionObj for all factions on the server.
    if (typeof cb == "function") {
      return starNetVerified("/faction_list", options, function (err, results) {
        if (err) {
          thisConsole.error("ERROR:  Could not obtain faction list for ServerObj.factionList!");
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
      return starNetVerified("/list_blueprints", options, function (err, results) {
        if (err) {
          thisConsole.error("ERROR: Could not obtain blueprint list for ServerObj.blueprintList!");
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
      return starNetVerified("/list_control_units", options, cb);
    } else {
      return simplePromisifyIt(self.listControlUnits, options);
    }
  }
  this.loadSectorRange = function (firstSector, SecondSector, options, cb) { // Allows any input that can create a CoordsObj, including any other Sector or Coords obj
    if (typeof cb == "function") {
      try {
        var sectorToUse1 = new CoordsObj(firstSector); // This will error if invalid input is given.
      } catch (err) {
        thisConsole.error("Invalid input given as 'firstSector' to ServerObj.loadSectorRange!");
        return cb(err, null);
      }
      try {
        var sectorToUse2 = new CoordsObj(SecondSector);
      } catch (err) {
        thisConsole.error("Invalid input given as 'SecondSector' to ServerObj.loadSectorRange!");
        return cb(err, null);
      }
      return runSimpleCommand("/load_sector_range " + sectorToUse1.toString() + " " + sectorToUse2.toString(), options, cb);
    } else {
      return simplePromisifyIt(self.loadSectorRange, options, firstSector, SecondSector);
    }
  }
  this.friendlyMissileFire = function (trueOrFalse, options, cb) { //  activates or deactivates friendly fire for missiles.
    if (typeof cb == "function") {
      let booleanToUse = trueOrFalse(trueOrFalse); // allows truthy values to convert to the words, "true" or "false"
      // Does not have success or fail messages
      if (isTrueOrFalse(booleanToUse)) {
        return runSimpleCommand("/missile_defense_friendly_fire " + booleanToUse, options, cb);
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
          return runSimpleCommand("/npc_fleet_loaded_speed " + numberToUse, options, cb);
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
      return runSimpleCommand("/npc_turn_all", options, cb);
    } else {
      return simplePromisifyIt(self.npcTurn, options);
    }
  }
  this.refreshServerMessage = function (options, cb) { // Refreshes the server message that players see upon joining the server from the "server-message.txt" located in the StarMade folder.
    if (typeof cb == "function") {
      return runSimpleCommand("/refresh_server_msg", options, cb);
    } else {
      return simplePromisifyIt(self.refreshServerMessage, options);
    }
  }
  this.restructAABB = function (options, cb) { // "Reconstructs the AABBs of all objects on the server"
    if (typeof cb == "function") {
      return runSimpleCommand("/restruct_aabb", options, cb);
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
            return runSimpleCommand("/start_countdown " + numberToUse, options, cb);
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
        return runSimpleCommand("/npc_spawn_faction_pos_fixed \"" + npcNameToUse + "\" \"" + npcFactionNameToUse + "\" \"" + npcDescriptionToUse + "\" " + initialGrowthToUse + " " + systemToUse.toString(), options, cb);
      } else {
        return runSimpleCommand("/npc_spawn_faction \"" + npcNameToUse + "\" \"" + npcFactionNameToUse + "\" \"" + npcDescriptionToUse + "\" " + initialGrowthToUse, options, cb);
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
        return starNetVerified("/search " + partOfEntityNameToUse, options, function (err, results) {
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
      return starNetVerified("/status", options, function (err, results) {
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
  this.sqlQuery = function (theQueryString,options,cb){
    if (typeof cb == "function"){
      return simpleSqlQuery(theQueryString,options,cb);
    } else {
      return simplePromisifyIt(self.sqlQuery,options,theQueryString);
    }
  }
  // shutdown(seconds,"message") // message is optional.  If given, a countdown timer will be used and then a 1 second shutdown when it is set to expire.
  // ip
  //

  // New Methods needed:

  // shutdown(TimeInSeconds,publicMessageString,CountdownMessageString) - No fields are required, but if no time is given, 10 seconds is default.  If a publicMessageString is given, an announcement is made to the public channel. If CountdownMessageString is provided, then a countdown starts with a message and 1 second before it ends, the actual shutdown is started.  This will allow the server to shut down without auto-restarting.
};
