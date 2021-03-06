// @ts-check

// Design fundamentals:

// SIMPLICITY IN USE
// Everything should be guided.  There should be the LEAST amount of input necessary from the user to get things going.
// All dependencies should be downloaded automatically, like StarNet.jar or any modules automagically.  IMPORTANT:  If downloading a dependency, it is IMPORTANT to ensure that agreement to the third-party license of use is confirmed before downloading!
// Any dependencies should be functional for LINUX, WINDOWS, AND MAC --> NO OS DEPENDENT MODULES.
// Any information that can be grabbed should be grabbed automatically, such as the "SUPERADMINPASSWORD" from the starmade server.cfg file.
// When information is missing, this scripting should ask the user and make changes where needed (such as asking for the SUPERADMINPASSWORD if not set already and then setting it).
// Assume a complete idiot is going to use this wrapper.  Everything should have safeguards to protect people from themselves.

// No GUI  - NUFF SAID - TEXT CONSOLE FTW
// The servers that should be using this should be headless, so if we want to create a GUI we should create it as a plugin web-app with focus on security.  Express is great for this sort of thing.

// MODDABILITY
// This wrapper will feature a high degree of moddability.  Everything will be event driven, so mods will be able to easily detect when events happen in game.
// There will be easy access to databases that both the wrapper and mods can maintain.  There will be "wrapper," "global", and "mod-level" databases.  By default, a mod should only have access to the "global" and "mod-level" databases, but we should have a specification for a "high level" mod that gets loaded in at the global scope so it can change the base functionality of the wrapper (if desired - AND ONLY WITH LOTS OF WARNINGS TO THE SERVER OWNER)
// I want a rich tapestry of built in methods that can perform functions such as grabbing the current faction of a specific player.  These should be able to send commands to the server, retrieve the data, parse it, and whittle it down to what is needed.  Sql queries will get special attention here, allowing the output to be easily parsable by mod scripting.

// DOCUMENTATION
// As features are FINALIZED, documentation should created.

// NODE.JS JAVASCRIPT - MOSTLY NATIVE CODE
// Code should be mostly native to node.js javascript using outside tools the least possible.  For example, downloading can be handled by javascript.  No needto use "wget" or similar tool.
// Where outside tools are used:  They MUST be includable or downloadable and freely usable on supported OS's, including linux, windows, and macosx.

// NPM "REQUIRES" ARE OK - NO NEED TO RE-INVENT WHEELS
// Provided a NPM package seems stable enough, we can use them to expand the functionality of our scripting and decrease production time.  Care must be taken to ensure that performance isn't decreased significantly though.  -- NO GHETTO PACKAGES PLZ


// ######################
// ###   EXIT CODES   ###
// ######################
// 0: The script exited with no problems.
// 1: Lock file existed. Possible other server running.  Cannot start.
// 4: StarNet.jar did not exist and download failed due to a socks error, such as a failed connection.
// 5. StarNet.jar did not exist and download failed with HTTP response from webserver.  The HTTP error code will be available in the last line output by this script.

// ############################
// ###    NATIVE REQUIRES   ### - Built-in nodejs modules that should never need to be installed.
// ############################
const http = require('http');
const fs = require('fs');
global["events"] = require('events');
const path = require('path'); // This is needed to build file and directory paths that will work in windows or linux or macosx.  For example, The / character is used in linu, but windows uses \ characters.  Windows also uses hard drive characters, wherease linux has mount points.  For example, in linux a path looks like "/path/to/somewhere", but in windows it looks like "c:\path\to\somewhere".  The path module takes care of this for us to build the path correctly.
// const stream   = require('stream'); // For creating streams.  Not used right now but may be later.

// ### Main Vars ### - Don't change these
console.log("Setting main vars..");
var mainFolder = path.dirname(require.main.filename); // This is where the starmade.js is.  I use this method instead of __filename because starmade.js might load itself or be started from another script
var binFolder = path.join(mainFolder, "bin");
var modsFolder = path.join(mainFolder, "mods-ServerDefaults"); // These are the mods used for new installs
global["mainFolder"] = mainFolder;
global["binFolder"] = binFolder;
global["modsFolder"] = modsFolder;
var operations = 0;

// #######################
// ### SCRIPT REQUIRES ###
// #######################
// path.resolve below builds the full path to "./bin/setSettings.js" in such a way that is compatible with both windows and linux/macosx, since it doesn't use / or \ characters.
console.log("Importing bin scripts..");
const miscHelpers = require(path.join(binFolder, "miscHelpers.js"));
const requireBin = miscHelpers["requireBin"]; // Simplifies requiring scripts from the bin folder..yes I am this lazy.
global["miscHelpers"] = miscHelpers;
global["requireBin"] = requireBin; // Obsoleting in favor of static requires.  May still be useful for servers

var objectCreator = require("./bin/objectCreator.js"); // These are ONLY wrapper objects, NOT server objects, which is very limited.  Right now it might only include an object for the StarMade server list.
const installAndRequire = require("./bin/installAndRequire.js"); // This is used to install missing NPM modules and then require them without messing up the require cache with modules not found (which blocks requiring them till an app restart).
const sleepSync = require("./bin/mySleep.js").softSleep; // Only accurate for 100ms or higher wait times.
const sleepPromise = require("./bin/mySleep.js").sleepPromise;
const ini = require("./bin/iniHelper.js"); // This will replace the current functionality of ini by wrapping it and modifying the ini package so that it works correctly for starmade config files and ini files that use # characters.
const objectHelper = require("./bin/objectHelper.js"); // This includes assistance handling of custom objects and conversions
const regExpHelper = require("./bin/regExpHelper.js"); // Contains common patterns, arrays, and pattern functions needed for the wrapper.
global["objectCreator"] = objectCreator;
global["installAndRequire"] = installAndRequire;
global["sleep"] = sleepPromise;
global["sleepSync"] = sleepSync;
global["ini"] = ini;
global["objectHelper"] = objectHelper;
global["regExpHelper"] = regExpHelper;

// #################################
// ### NPM DOWNLOADABLE REQUIRES ###
// #################################
console.log("Importing NPM requires, installing if need be..");
const isInvalidPath = installAndRequire("is-invalid-path", '^1.0.2'); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
const fsExtra = installAndRequire("fs-extra", "^9.0.0");
const treeKill = installAndRequire('tree-kill', "^1.2.2"); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes
const prompt = installAndRequire("prompt-sync", "^4.2.0")({"sigint": true}); // https://www.npmjs.com/package/prompt-sync This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
// var Tail = installAndRequire('tail', "^2.0.3").Tail; // https://github.com/lucagrulla/node-tail/blob/master/README.md For following the server log.  I forgot that the console output does NOT have everything.  This is NOT a perfect solution because whenever file rotation occurs, there is a 1 second gap in coverage.  Argh.
const exitHook = installAndRequire('exit-hook', "^2.2.0"); // https://github.com/sindresorhus/exit-hook Handles normal shutdowns, sigterm, sigint, and a "message=shutdown" event.  Good for ensuring the server gets shutdown.
const sqlite3 = installAndRequire("sqlite3","^4.2.0").verbose(); // Embedded sql database
const _ = installAndRequire("lodash", "^4.17.15"); // Useful javascript shortcuts http://zetcode.com/javascript/lodash/
global["isInvalidPath"]=isInvalidPath;
global["prompt"] = prompt;
global["fsExtra"] = fsExtra;
global["treeKill"] = treeKill;
// global["Tail"] = Tail;
global["exitHook"] = exitHook;
global['sqlite3'] = sqlite3;
global['_'] = _;


// ### Set up submodules and aliases from requires.


// Object aliases
var {
  isPidAlive,
  isDirectory,
  getDirectories,
  isFile,
  getFiles,
  log,
  existsAndIsFile,
  existsAndIsDirectory,
  trueOrFalse,
  getJSONFileSync,
  getJSONFile,
  writeJSONFileSync,
  writeJSONFile,
  getSimpleDate,
  getSimpleTime,
  i
} = miscHelpers; // Sets up file handling
var {
  repeatString,
  isInArray,
  getRandomAlphaNumericString,
  arrayMinus,
  copyArray,
  toStringIfPossible,
  toNumIfPossible,
  testIfInput,
  simplePromisifyIt,
  listObjectMethods,
  getParamNames,
  getOption
} = objectHelper;
var {customEvent,customConsole,customLog} = objectCreator;


// ######################
// #### EVENTS SETUP ####
// ######################
// This is more in line with the node.js documentation.  TODO: Only use one method of setting up events.




var globalEventUnmodified=customEvent(); // Events registered here will not be affected if global["event"].removeAllListeners() is called (for example, if reloading wrapper mods)
global["event"]=globalEventUnmodified.spawn();; // This can be cleared independently from any of the globalEvent for installs
var eventListenersToRemoveOnReload = []; // When a global call to reload mods happens, this array will be cycled through to remove the listeners one by one.


// #####################
// ###    SETTINGS   ###
// #####################

var dummySettings = { // example of settings
  // These settings will over-ride any settings for individual servers
  showStderr: null, // If no true or false value set, the server specific setting will be used
  stderrFilter: null,
  showStdout: null,
  stdoutFilter: null,
  showServerlog: null,
  serverlogFilter: null,
  showAllEvents: null,
  enumerateEventArguments: null,
  lockPIDs: [1234], // These should be specificically the wrapper process itself or subprocesses of the wrapper, not including servers
  "autoExit": false, // This makes the wrapper shut down when all servers have been shut down intentionally
  servers: {
    "c:\\coding\\starmade.js\\starmade": {
      // These settings are server specific, they should not contain anything that isn't writable to a json file
      showStderr: true, // Normally this would be true but can be turned to false if testing
      stderrFilter: null,
      showStdout: false,
      stdoutFilter: null,
      showServerlog: true,
      serverlogFilter: null,
      showAllEvents: false,
      enumerateEventArguments: false,
      lockPIDs: [1234, 2345, 5678], //  These should be specific to the server instance
      "javaMin": "512m",
      "javaMax": "4096m",
      "port": "5252",
      "commandOperator": "!",
      "installFolder": "c:\\coding\\starmade.js\\starmade",
      "starMadeInstallFolder": "c:\\coding\\starmade.js\\starmade\\StarMade",
      "botName": "Melvin",
      "smTermsAgreedTo": "yes",
      "buildBranch": "normal", // This can be "normal","dev", or "pre"
      "autoStart": true, // This starts this server on wrapper start
      "autoRestart": true // This restarts the server when it fails due to a crash.  Handles soft-crashes too.
    }
  }
}
global["installObjects"] = {}; // Will be filled later
  
global["asyncOperation"]=asyncOperation; // Allows wrapper mods to do async setup.

global["loadWrapperMods"]=loadWrapperMods;
global["unloadWrapperMods"]=unloadWrapperMods;
global["reloadWrapperMods"]=reloadWrapperMods;

global["loadServerMods"]=loadAllServerMods;
global["unloadServerMods"]=unloadServerMods;
global["reloadServerMods"]=reloadAllServerMods;


var mainConsole=customConsole("main", {invincible: true}); // This is a console that only displays if the "main" console is currently selected.  It is "invincible", so it will not be unloaded if the unloadListeners event happens.
global["mainConsole"] = mainConsole;

global["settingsFilePath"] = path.join(mainFolder, "settings.json");
global["settings"] = getSettings({ // These values will be overwritten by any existing settings.json file
  showStderr: true,
  stderrFilter: null,
  showStdout: true,
  stdoutFilter: null,
  showServerlog: false,
  serverlogFilter: null,
  showAllEvents: false, // This shows events such as PlayerDeath
  enumerateEventArguments: null,
  lockPIDs: [], // These should be specificically the wrapper process itself or subprocesses of the wrapper, NOT including servers or any subprocesses of server mods.
  "autoExit": false, // This makes the wrapper shut down when all servers have been shut down
  servers: {}
}); // This will grab the settings from the settings.json file if it exists, creating a new one if not, and returns the default values.
global["writeSettings"] = writeSettings; // This will write the main settings.json file
global["getSettings"] = getSettings; // This is used to get the settings.json file as it is currently written to the hard drive.

global["getServerObj"] = getServerObj; // This is used by mods to get the serverObj that they are a part of
global["getServerPath"] = getServerPath;
global["getInstallObj"] = getInstallObj; // This object contains the path to the install folder, serverObj (after it is registered), and other info.  See function for more info.
global["regServer"] = regServerObj;
var starNetJarURL = "http://files.star-made.org/StarNet.jar";
var starNetJar = path.join(binFolder, "StarNet.jar");

var forceStart = false; // Having this set to true will make the script kill any existing scripts and servers and then start without asking the user.
var ignoreLockFile = false; // If this is set to true, it will skip checking if previous PID's are running and start without killing them.  WARNING:  If any servers are running in the background, this will duplicate trying to run the server, which will fail because an existing server might already be running.
global["debug"] = false; // This enables debug messages
var os = process.platform;
global["serverMods"] = {}; // This is where all serverMods are placed, so they can be reloaded separately from wrapper mods.
global["log"] = log;

var starMadeStarter;
// TODO: Fix this to use the .exe file properly when doing installs.  Sure the Jar works, but might be a bad idea for some reason.
// Note that I SHOULD be able to re-enable this, but I need to ensure the starMadeStarter is not ran directly anywhere and instead uses the helper function, "smartSpawnSync" from miscHelpers.js
// if (os=="win32"){
//   starMadeStarter="StarMade-Starter.exe";
// } else {
starMadeStarter = "StarMade-Starter.jar"; // This handles linux and macOSX
// }
global["starMadeInstallerFilePath"] = path.join(binFolder, starMadeStarter);

var starMadeInstallerURL = "http://files.star-made.org/" + starMadeStarter;
// Windows: http://files.star-made.org/StarMade-starter.exe // Does not seem to actually work correctly with spawnSync and the -nogui option on windows.. Using the linux/macOSX jar installer does though!  wtf!
// macosx: http://files.star-made.org/StarMade-Starter.jar
// Linux: http://files.star-made.org/StarMade-Starter.jar

log("starmade.js launched.");

// ######################
// ### Random Helpers ###
// ######################
global["cls"] = function(){ process.stdout.write("\u001b[2J\u001b[0;0H") }; // Clears the screen and sets the cursor to the top.  Not sure how this will behave on a remote console or other OS's, but works on windows 10 cmd line.  Lots of options at the Source: https://stackoverflow.com/questions/9006988/node-js-on-windows-how-to-clear-console



// ##############################
// ### Command Line Arguments ###  -- Temporary solution is to prevent this script from running if lock file exists
// ##############################
if (process.argv[2]) {
  // Some command line argument was given
  var argumentsPassed = process.argv.slice(2);
  var argumentRoot;
  var argumentEqual;
  var argumentEqualLowerCase;
  for (let i = 0;i < argumentsPassed.length;i++) {
    // Set up each argument to grab before = and after =, so arguments can be given specific values.
    argumentRoot = toStringIfPossible(argumentsPassed[i].match(/^-[a-zA-Z]*/));
    if (typeof argumentRoot == "string") {
      argumentRoot = argumentRoot.toLowerCase();
      // console.log("Test result: " + argumentsPassed[i].indexOf("="));
      if (argumentsPassed[i].indexOf("=") == -1) {
        argumentEqual = null;
        argumentEqualLowerCase = null;
      } else {
        argumentEqual = argumentsPassed[i].match(/[^=]*$/).toString();
        argumentEqualLowerCase = argumentEqual.toLowerCase();
      }
      if (argumentRoot == "-help") {
        console.log("");
        console.log("The following command line arguments are currently supported:");
        console.log("-forcestart");
        console.log("-ignorelockfile");
        console.log("-debug");
        // console.log("-branch=[DEV/PRE/NORMAL]"); // normal/dev/pre
        log("Command line help given.");
        process.exit();
        // } else if ((/-branch=.*/).test(argumentRoot)){
        //   if ((/-branch=.+/).test(argumentRoot)){
        //     let argumentRootSplit=argumentRoot.split("=");
        //     if (argumentRootSplit.length==2){
        //       let theBranch=argumentRootSplit[1].toLowerCase().trim();
        //       if (theBranch == "normal" || theBranch == "dev" || theBranch == "pre"){
        //         settings["buildBranch"]=argumentRootSplit[1];
        //       } else {
        //         let theErr=new Error("Invalid Starmade branch type given, '" + argumentRootSplit[1] +"'!  You must specify either 'Normal', 'DEV', or 'PRE', without the quotes!")
        //         throw theErr;
        //       }
        //     } else {
        //       let theErr=new Error("Too many equals values given! When using the -branch argument, you MUST specify only ONE of the following: DEV, PRE, or NORMAL.  Example node starmade.js -branch=DEV");
        //       throw theErr;
        //     }
        //   } else {
        //     let theErr=new Error("When using the -branch argument, you MUST specify either DEV, PRE, or NORMAL!  Example: node starmade.js -branch=DEV");
        //     throw theErr;
        //   }

      } else if (argumentRoot == "-forcestart") {
        if (argumentEqualLowerCase == "true" || !argumentEqualLowerCase) {
          forceStart = true;
        } else if (argumentEqualLowerCase == "false") {
          forceStart = false;
        } else {
          console.log("Invalid setting for forceStart attempted.  Must be 'true' or 'false'!  Ignoring argument!")
        }
        console.log("Set 'forceStart' to " + forceStart + ".");

      } else if (argumentRoot == "-ignorelockfile") {
        console.log("Setting ignoreLockFile to true.");
        ignoreLockFile = true;

      } else if (argumentRoot == "-debug") {
        console.log("Turning debug messages on!");
        global["debug"] = true;
      } else {
        console.error("Error:  Unrecognized argument, '" + argumentsPassed[i] + "'!  Ignoring it and moving on!");
        log("StartupError:  Unrecognized argument, '" + argumentsPassed[i] + "'!  Ignoring it and moving on!")
      }
    } else {
      log("StartupError:  Invalid argument, '" + argumentsPassed[i] + "'!  Arguments must be preceded by a '-' character!  Aborting startup!");
      let theErr = new Error("Invalid argument given.  All arguments should be preceded by a '-' character!  Argument given: " + argumentsPassed[i]);
      throw theErr;
    }
  }
}


// ########################
// ### Smart Lock Check ###
// ########################

// TODO:  Separate the lock check for wrapper to here, and server PID checks in the server obj
if (global["settings"].lockPIDs.length > 0 && ignoreLockFile == false) {
  //todo if the lock file exists, we need to grab the PID from the file and see if the server is running.  If not, then we can safely remove the lock file, otherwise end with an error.
  mainConsole.log("Existing wrapper PIDs found!");
  var response = "";
  mainConsole.log("Checking if any of the prior wrapper PIDs are still running..");
  // Checking the main starmade.js process PID - We check this first because we run a treekill on it which will normally also bring down the individual server PID and prevent it from auto-restarting the server on abnormal exit
  var lockPIDs = [];
  if (global["settings"].lockPIDs.length > 0) {
    lockPIDs = copyArray(global["settings"].lockPIDs);
  }
  for (let i = 0;i < lockPIDs.length;i++) {
    if (isPidAlive(lockPIDs[i])) {
      mainConsole.log("Existing starmade.js wrapper process found running on PID, '" + lockPIDs[i] + "'.");
      if (forceStart == true) {
        mainConsole.log("forceKill flag set!  Auto-killing PID!");
        response = "yes";
      } else {
        response = prompt("If you want to kill it, type 'yes': ").toLowerCase();
      }
      if (response == "yes") {
        mainConsole.log("TREE KILLING WITH EXTREME BURNINATION!");
        treeKill(lockPIDs[i], 'SIGTERM');
        // We should initiate a loop giving up to 5 minutes for it to shut down before sending a sig-kill.
        miscHelpers.waitAndThenKill(300000, lockPIDs[i]);
        sleepSync(1000); // Give the sigKILL time to complete if it was necessary.
        global["settings"].lockPIDs = arrayMinus(global["settings"].lockPIDs, lockPIDs[i]); // PID was killed, so remove it from the settings.json file.
      } else {
        mainConsole.log("Alrighty, I'll just let it run then.");
      }
    } else {
      mainConsole.log("Prior starmade.js wrapper PID (" + lockPIDs[i] + ") not running. Cool.");
      global["settings"].lockPIDs = arrayMinus(global["settings"].lockPIDs, lockPIDs[i]); // PID wasn't alive, so remove it from the settings.json file.
    }
  }
  mainConsole.log("");
  if (global["settings"].lockPIDs.length > 0) {
    // We never want to start the wrapper if any of the PIDs are still alive, unless the person started with the argument to ignore the lock file
    mainConsole.log("\nDANGER WILL ROBINSON!  There are still " + global["settings"].lockPIDs.length + " processes still running!");
    mainConsole.log("We cannot continue while an existing wrapper might still be running!  Exiting!");
    mainConsole.log("NOTE: If you are 100% SURE that these the PIDs from the lock file are NOT from another starmade.js script or StarMade servers, you can restart this script with '-ignorelockfile' to ignore the old lock file and create a new one.");
    mainConsole.log("NOTE2: If you want to start this script auto-killing any old PID's, you can use the -forceStart argument.");
    process.exit(1);

  }
} else if (global["settings"].lockPIDs.length > 0) {
  // The server was ran with -ignorelockfile, so let's create a backup of the current settings.json file and delete the PIDs in the current one.
  var backupFileName = path.join(mainFolder, path.basename(global["settingsFilePath"]) + ".bak");
  writeJSONFileSync(backupFileName, global["settings"]);
  global["settings"].lockPIDs = [];
}
writeSettings();



// #########################
// ###     NEW SERVER    ###
// #########################
function setupNewServer() {
  // This is used to create a new server
  // We do not use the "mainConsole" because "prompt" is not compatible with the console system, so we want this to display everywhere.
  console.log("\nWhat installation folder should we use?");
  var serverFolder;
  console.log("By default, 'starmade' in the same folder as starmade.js is used. (recommended)");
  console.log("If that folder name is already used for an install, a number will be appended in ascending order.");
  while (typeof serverFolder == "undefined" || !serverFolder) {
    serverFolder = testStarMadeDirValue(prompt(": "));
  }
  console.log("Install Folder set to: " + serverFolder);
  // @ts-ignore
  if (!fs.existsSync(serverFolder)) {
    console.log("\nThat StarMade Install folder does not exist!");
    if (prompt("Press [ENTER] to create the folder or anything else to abort startup.")) {
      console.log("Something else was typed!  Abort ABORT!");
      process.exit(130);
    }
    try {
      if (miscHelpers.ensureFolderExists(serverFolder) != true) {
        throw new Error("Folder could not be created: " + serverFolder);
      }
      console.log("Successfully created directory: " + serverFolder);
    } catch (err) {
      console.error("Could not create folder! Please run this script again and choose a different install directory to use!");
      throw err;
    }
  }
  global["settings"]["servers"][serverFolder] = {"installFolder": serverFolder}; // This is just a bare bones directory of where to put the mods.  There are no default settings, because we leave this to the server to set these if they so choose.
  // copy the default mods over // If someone wants to install mods for a different server type, they can delete the mods and replace them.  If I grow support for other game types in the future, I'll change this behavior.
  // @ts-ignore

  // obsoleting in favor of self-healing mods folder
  // fsExtra.copySync(path.join(__dirname,"mods-ServerDefaults"),path.join(serverFolder,"mods")); // This creates the folder if it doesn't exist

}
function emitToAllInstalls(event) { // Instead of emitting on the global event emitter, this will emit to each individual server.  This is to make it so that mods do not need to listen to the global event emitter.
  var installsArray = Object.keys(global["installObjects"]);
  for (let i = 0;i < installsArray.length;i++) {
    if (global["installObjects"][installsArray[i]].hasOwnProperty("event")) {
      console.log("#############################");
      console.log(`############  Emitting event, '${event}', to install: ${installsArray[i]}`);
      console.log("#############################");
      global["installObjects"][installsArray[i]].event.emit(...arguments); // This will pass all arguments, including the event.
    }
  }
}

// ###################
// #### MODLOADER ####
// ###################


function requireServerMods(inputPath) { // Requires the path to the install
  // outputs an object with all the mods required.  Example
  // {
  //   "/path/to/install/mods/someModFolder/someScript.js":theRequireObject,
  //   "/path/to/install/mods/someModFolder/anotherScript.js":theRequireObject,
  //   "/path/to/install/mods/aDifferentModFolder/etc.js":theRequireObject
  // }
  // mainConsole.log("inputPath: " + inputPath + " typeof inputPath: " + typeof inputPath); // temp
  if (typeof inputPath != "string"){
    throw new Error("No path given to requireServerMods!  Expects a path to a server install!  Example: requireServerMods('/path/to/install')");
  }
  var modsFolder = path.join(inputPath, "mods");
  var returnObj={};
  // Obsoleted - TODO:  Remove the below commented section
  // var tempFolderName="";
  if (existsAndIsDirectory(modsFolder)) {
    var modFolders = getDirectories(modsFolder);
    if (modFolders.length > 0) {
      var fileList = [];
      for (var i = 0;i < modFolders.length;i++) {
        mainConsole.log("Mod Folder found: " + modFolders[i] + " Looking for scripts..");
        fileList = getFiles(modFolders[i]);
        for (var c = 0;c < fileList.length;c++) {
          if (fileList[c].match(/.\.js$/)) {
            mainConsole.log("Loading JS file: " + fileList[c]);
            try {
              // For each installObj, add an element which contains all the requires.  This is to delete their cache's later and reload them.  It could also be used just to inspect what files are loaded currently or even reload specific scripts for some reason.
              returnObj[fileList[c]] = require(fileList[c]);
            } catch (err) {
              mainConsole.log("Error loading mod: " + fileList[c], err);
              throw err;
            }
          }
        }
      }
    } else {
      mainConsole.log("Cannot load any mods. Mods folder contained no mods.  Server Path: " + inputPath);
    }
  } else {
    mainConsole.log("Cannot load any mods. No 'mods' folder found.  Server Path: " + inputPath);
    fsExtra.ensureDir(modsFolder);
  }
  // This can be uncommented out if we'd prefer to return an object with all the folders/requires for some reason.
  // returnObj[serverFoldersArray[e]]=global["installObjects"][serverFoldersArray[e]]["modRequires"];
  return returnObj;
}
function loadAllServerMods(inputPath) {
  if (typeof inputPath == "string" || typeof inputPath == "undefined"){
    // outputs to the global.installObjects["/path/to/mod"].modRequires object, which will look something like this:
    var serverFoldersArray = Object.keys(global["settings"].servers);
    for (let e = 0;e < serverFoldersArray.length;e++) { // Cycle through the install folders and require the respective mod files
      if ((typeof inputPath == "string" && inputPath == serverFoldersArray[e]) || typeof inputPath == "undefined"){
        global["installObjects"][serverFoldersArray[e]]["modRequires"]=requireServerMods(serverFoldersArray[e]);
      }
    }
    return true;
  } else {
    throw new Error("Invalid input given to loadAllServerMods!  Expects a string path or nothing!");
  }
}
function unloadServerMods(theInputPath,options) { 
  // This cycles through the list of modfiles and deletes their cache
  // if 'inputPath' is specified, it will ONLY unload mods for that specific install.  Note that this functionality should not be used till global event listeners are broken down somehow by mod.
  // This should unload server mods, except the ones in the default directory by default.
  var unloadDefaultDir=getOption(options,"unloadDefaultDir",false);
  var inputPath;
  if (typeof theInputPath == "string"){
    inputPath=path.resolve(__dirname,theInputPath); // If theInputPath is an incomplete path, use the starmade.js folder as the base path
  } else if (typeof inputPath != "undefined") {
    throw new Error("Invalid input given to function, 'unloadServerMods'! Expected nothing or a path string! Typeof inputPath: " + typeof inputPath);
  }
  // These have been replaced with the CustomEvent object methods
  // unloadServerEventListeners(theInputPath); // Unload listeners on the server level event
  // unloadGlobalEventListeners(theInputPath); // Unload listeners on the global.globalEvent event for each server
  
  var installFolders = Object.keys(global["installObjects"]);
  var loadedModsArray = [];
  var newKeys = [];
  var defaultDir="";
  var thisDir="";
  for (let i = 0;i < installFolders.length;i++) {
    if ((typeof inputPath == "string" && inputPath == installFolders[i]) || typeof inputPath == "undefined") {
      global["installObjects"][installFolders[i]].event.emit("unloadMods"); // This is for mods that need to do other cleanup when reloading
      console.log("################################################################");
      console.log("##### Removing all server and global event listeners for install: " + installFolders[i]);
      console.log("################################################################");
      global["installObjects"][installFolders[i]].event.removeAllListeners();
      global["installObjects"][installFolders[i]].globalEvent.removeAllListeners();


      loadedModsArray = Object.keys(global["installObjects"][installFolders[i]]["modRequires"]);
      for (let e = 0;e < loadedModsArray.length;e++) {
        // Check if it is a default mod or not.
        defaultDir=path.join(installFolders[i],"mods","default");
        thisDir=path.dirname(loadedModsArray[e]);
        mainConsole.debug(`Comparing ${defaultDir} to ${thisDir} and removing if not the same. unloadDefaultDir: ${unloadDefaultDir}`);
        if ((unloadDefaultDir == false && defaultDir != thisDir) || unloadDefaultDir == true){
          mainConsole.log("Unloading JS file: " + loadedModsArray[e]);
          Reflect.deleteProperty(global["installObjects"][installFolders[i]]["modRequires"], loadedModsArray[e]); // Delete the individual path entry for this require
          Reflect.deleteProperty(require.cache, require.resolve(loadedModsArray[e])); // Remove the require cache. Source: http://derpturkey.com/reload-module-with-node-js-require/ with some modification to use reflect.
        } else {
          mainConsole.log("Skipping default mod file: " + loadedModsArray[e]);
        }
      }
      newKeys = Object.keys(global["installObjects"][installFolders[i]]["modRequires"]);
      if (newKeys.length == 0) {
        Reflect.deleteProperty(global["installObjects"][installFolders[i]], "modRequires"); // Delete the entry for this server, but only if empty.
      }
    }
  }
}
function reloadAllServerMods(){ // This is invoked by the wrapper command line !reloadmods
  let installObjectKeys=Object.keys(global["installObjects"]);
  console.log("Reloading non-default mods for all servers..");
  for (let i=0;i<installObjectKeys.length;i++){
    console.log("Reloading mods for install: " + installObjectKeys[i]);
    global["installObjects"][installObjectKeys[i]].reloadMods({noInit:true}); // We don't want to run the init when reloading each mod, because we want the global init ran first for default mods
  }
  console.log("#########################################");
  console.log("####### EMITTING INIT for all servers on global and local events");
  console.log("#########################################");

  global["event"].emit("init"); // This is here because we only want it to emit once for all installs.
  emitToAllInstalls("init"); // emits to the server event for each install  
}

function reloadServerMods(inputPath,options) { // This function is meant to reload ALL mods.  Specificity is not possible right now.
  let noInit=getOption(options,"noInit",false);
  console.log("#########################################");
  console.log("####### RELOADING server mods for server: " + inputPath);
  console.log("#########################################");
  
  console.log("#########################################");
  console.log("####### DEREGISTERING CONSTRUCTORS for server: " + inputPath);
  console.log("#########################################");
  // if (global["installObjects"].hasOwnProperty(inputPath)){
  //   console.log("######## It had the install path!! inputPath:" + inputPath);
  //   console.dir(`global["installObjects"][${inputPath}]: ${global["installObjects"][inputPath]}`);
  // } else {
  //   console.log("######## It DID NOT have the install path!! inputPath: " + inputPath);
  // }
  global["installObjects"][inputPath].deregAllConstructors();

  console.log("#########################################");
  console.log("####### UNLOADING server mods for server: " + inputPath);
  console.log("#########################################");
  unloadServerMods(inputPath);


  // theThis.deregAllConstructors();
  console.log("#########################################");
  console.log("####### RE-REQUIRING server mods for server: " + inputPath);
  console.log("#########################################");
  loadAllServerMods(inputPath); // This will load new ones if they exist.

  mainConsole.log("Done reloading mods!");
  // Re-initialize all the scripts (including default mods)

  if (noInit == false){
    global["installObjects"][inputPath].event.emit("init");
    console.log("#########################################");
    console.log("####### EMITTING INIT for server: " + inputPath);
    console.log("#########################################");
  }
  // emits to the global Event, including each globalEvent for each server.
  // emitToAllInstalls("init"); // emits to the server event for each install
}


function loadWrapperMods() { // No inputPath here because there is only one folder
  // Cycle through the mods folders for this install and require each mod file in
  let modsFolder = path.join(__dirname, "mods-Wrapper");
  if (!global.hasOwnProperty("modRequires")){
    global["modRequires"] = {};
  }
  if (existsAndIsDirectory(modsFolder)) {
    var modFolders = getDirectories(modsFolder);
    if (modFolders.length > 0) {
      var fileList = [];
      for (var i = 0;i < modFolders.length;i++) {
        mainConsole.log("Wrapper Mod Folder found: " + modFolders[i] + " Looking for scripts..");
        fileList = getFiles(modFolders[i]);
        for (var c = 0;c < fileList.length;c++) {
          if (fileList[c].match(/.\.js$/)) {
            mainConsole.log("Loading JS file: " + fileList[c]);
            try {
              // For each installObj, add an element which contains all the requires.  This is to delete their cache's later and reload them.  It could also be used just to inspect what files are loaded currently or even reload specific scripts for some reason.
              global["modRequires"][fileList[c]] = require(fileList[c]);
            } catch (err) {
              mainConsole.log("Error loading mod: " + fileList[c], err);
              throw err;
            }
          }
        }
      }
    } else {
      mainConsole.log("No wrapper mods found.  Skipping..");
    }
  } else {
    mainConsole.log("No wrapper mods folder found!  Creating it, then skipping..");
    fsExtra.ensureDir(modsFolder);
  }
  return true;
}
function unloadWrapperMods() { // This cycles through the list of wrapper modfiles and deletes their cache
  global["event"].emit("unloadWrapperMods"); // Gives wrapper mods a chance to do any extra cleanup they may need done before the reload
  mainConsole.log("Removing any global event listeners registered by Wrapper mods..");
  global["event"].removeAllListeners(); // This needs to be redone, because default mods rely on it to reinitialize
  // unloadGlobalEventListeners(inputPath); // old method
  // TODO:  Wrapper level mods may very well emit to server mods, so these need to have their own record.. I guess I could put it on global["installObjects"][__dirname]
  objectCreator.deregAllConstructors();
  var newKeys = [];
  var loadedModsArray = Object.keys(global["modRequires"]);
  for (let e = 0;e < loadedModsArray.length;e++) {
    mainConsole.log("Unloading JS file: " + loadedModsArray[e]);
    Reflect.deleteProperty(global["modRequires"], loadedModsArray[e]); // Delete the individual path entry for this require
    Reflect.deleteProperty(require.cache, require.resolve(loadedModsArray[e])); // Remove the require entirely. Source: http://derpturkey.com/reload-module-with-node-js-require/ with some modification to use reflect.
  }
  newKeys = Object.keys(global["modRequires"]);
  if (newKeys.length == 0) {
    Reflect.deleteProperty(global, "modRequires"); // Delete the modRequires variable, but only if empty.  It should always be empty.  This is redundant.
  }
}
function reloadWrapperMods() { // This function is meant to reload ALL mods.  Specificity is not possible right now.
  mainConsole.log("Deleting the require cache's, removing listeners, and unregistering Constructors for Wrapper mods..");
  unloadWrapperMods();
  mainConsole.log("Re-requiring the Wrapper mods..");
  loadWrapperMods(); // This will load new ones if they exist.
  mainConsole.log("Done reloading Wrapper mods!");
}

function testStarMadeDirValue(theInstallDir) {
  mainConsole.log("typeof installDir: " + typeof theInstallDir + " theInstallDir: " + theInstallDir);
  var installDir=theInstallDir; // .trim();
  if (typeof installDir == "undefined" || installDir == "") {
    var defaultFolderName = "starmade";
    var returnPath = path.join(__dirname, defaultFolderName);

    // temp
    mainConsole.log("installDir: " + installDir);
    mainConsole.log("returnPath: " + returnPath);
    var counter = 1;
    while (global["settings"]["servers"].hasOwnProperty(returnPath)) { // Keep going till the install path does not exist in settings.  It is ok if the folder already exists. 
      counter++;
      returnPath = path.join(__dirname, defaultFolderName + counter);
    }
    if (counter > 1) {
      mainConsole.log(`Existing install already existed, appended ${counter} to  the default name, '${defaultFolderName}'.`);
    }
    return returnPath;
  }
  if (!isInvalidPath(installDir)) { // If the path provided was valid
    let resolvedInstallDir = path.resolve(__dirname, installDir); // This will resolve from right to left, so if the install dir is a full path, it will not use the main starmade directory as the first part.  Otherwise, it will be relative to the folder starmade.js is in.
    if (fs.existsSync(resolvedInstallDir)) { // If the path exists, check to see if it is a file or named pipe.  IF so, we cannot use it.
      if (fs.statSync(resolvedInstallDir).isFile()) {
        mainConsole.log("ERROR: '" + resolvedInstallDir + "' already exists as a filename.  Please choose a different directory path!");
        return false;
      } else if (fs.statSync(resolvedInstallDir).isFIFO()) {
        mainConsole.log("ERROR: '" + resolvedInstallDir + "' already exists as a named pipe.  Please choose a different directory path!");
        return false;
      } // If the path is already a directory, that is ok.
    }
    // The path specified was valid, so let's return it.  The next part of the scripting will then create it if it does not exist, making SURE this is the path intended.
    if (global["settings"]["servers"].hasOwnProperty(resolvedInstallDir)) {
      mainConsole.log("ERROR: There is already an install in that directory!  Please choose a different install path!");
      return false;
    }
    return resolvedInstallDir;
  }
  // The path was invalid, so throw crap at the person.
  mainConsole.log("ERROR: The path you specified is not valid!");
  mainConsole.log("Please enter the folder name OR full path to where you want your Server install to be.");
  mainConsole.log("Note:  If you simply press enter, we'll create a folder called 'starmade' within the same folder that starmade.js is in. (Recommended!)");
  return false;
}

// I'm removing these, because the functions actually emit these, which would cause a giant loop.  I added a .reload() method to the installObj.  TODO: Add a way for wrapper mods to initiate a reload.
// To allow loading, unloading, and reloading of mods, a mod should probably emit an event to trigger the event here, rather than run it within it's own process.
// globalEventUnmodified.on("loadServerMods", function (inputPath) {
//   loadAllServerMods(inputPath);
//   emitToAllInstalls("init");;
// });
// globalEventUnmodified.on("unloadServerMods", function (inputPath) {
//   unloadServerMods(inputPath);
// });
// globalEventUnmodified.on("reloadServerMods", function (inputPath) {
//   reloadServerMods(inputPath);
//   emitToAllInstalls("init");;
// });
// globalEventUnmodified.on("loadWrapperMods", function () {
//   loadWrapperMods();
//   globalEventUnmodified.emit("init");;
// });
// globalEventUnmodified.on("unloadWrapperMods", function () {
//   unloadWrapperMods();
// });
// globalEventUnmodified.on("reloadWrapperMods", function () {
//   reloadWrapperMods();
//   globalEventUnmodified.emit("init");
// });



//  No more variables should be added to the globalObject after this, since all the mods will be initialized NOW.  ie. global["whatever"]=whatever;


// This is changing so the init is instead emitted to each installObj.event individually
// globalEventUnmodified.emit("init"); // This event happens AFTER all the mods are loaded in through require.  Prerequisites should be done by now.

// #######################################
// ###    COMMAND LINE WRAPPER START   ###
// #######################################
// This will process user input at the console and either direct it to the server process or parse it as a command.
process.stdin.on('data', function (text) { // This runs for any console
  let theText = text.toString().trim();
  var theInstallObj;
  var serverObj;
  var theConsole;
  var consoleCommands;
  if (global["installObjects"].hasOwnProperty(global["consoleSelected"])){ // See if the currently selected console has an install object entry
    theInstallObj=global["installObjects"][global["consoleSelected"]];
    if (theInstallObj.hasOwnProperty("serverObj")){ // If it does, then is there a serverObj on it to send the data?
      serverObj=theInstallObj.serverObj;
    }
    if (theInstallObj.hasOwnProperty("console")){ // If it does, then is there a serverObj on it to send the data?
      theConsole=theInstallObj.console;
      if (theConsole.hasOwnProperty("commands")){ 
        consoleCommands=theConsole.commands; // This should be an object, whose elements are the names of the command.  Each element is an array with [category,function]
      }
    }
  }
  if (theText[0] == "!") {
    var theArguments = theText.split(/ +/); // Split with the + symbol so it splits by any amount of spaces
    var theCommand = theArguments[0].toLowerCase();
    theArguments.shift();
    var tempArray = theCommand.split("") // Remove the ! character from the start
    tempArray.shift();
    theCommand = tempArray.join("");
    var theProperCommand="";

    // TODO: Change console commands to be event driven, like playerCommands are.

    let commandResult=runConsoleCommand(theConsole,theCommand,theArguments,{}); // If no result, this will remain false. // Replaces below
    if (!commandResult){
      console.log("No command found for install, checking global commands.."); // temp
    }
    // if (typeof theConsole == "object"){
    //   if (theConsole.hasOwnProperty("commands")){
    //     // console.log("Commands found!"); // temp
    //     // Now we need to do a case insensitive search of the commands and get the corresponding command.
    //     let theCommands=Object.keys(theConsole.commands);
    //     for (let z=0;z<theCommands.length;z++){ // Find if any case insensitive match and then run the first one found.
    //       if (i(theCommands[z],theCommand)){
    //         theProperCommand=theCommands[z];
    //         // console.log("Registered command found!  Running it!"); // temp
    //         if (Array.isArray(theConsole.commands[theProperCommand])){
    //           if (typeof theConsole.commands[theProperCommand][1] == "function"){
    //             // console.log("Running command now!!"); // temp
    //             return theConsole.commands[theProperCommand][1](theArguments); // Runs the function associated with the command, providing the arguments, terminating with it.  This allows commands to replace wrapper commands.
    //           } else {
    //             throw new Error("ERROR: command was not registered properly!  Invalid input given as function!"); // This should never happen
    //           }
    //         } else {
    //           throw new Error("ERROR: command was not registered properly!  Expected an array!"); // This should never happen
    //         }
    //       }
    //     }
    //     console.log("No command found for install, checking global commands.."); // temp
    //   }
    // }
    if (i(theCommand, "help")) {
      var helpResult=false;
      // TODO: Add wrapper-level global command registering.
      if (theArguments.length > 0){
        if (typeof theArguments[0] == "string"){
          let theCommandToRun=theArguments[0];
          theArguments.pop();
          helpResult=runConsoleCommand(theConsole,theCommandToRun,theArguments,{help:true}); // If no result, this will remain false.
        }
      } else {
        console.log("Here are the current console commands:");
        if (typeof consoleCommands == "object"){ // This will be undefined if there were no commands for the console.
          var outputObject={};;
          var consoleCommandsArray=Object.keys(consoleCommands);
          var commandCategory="";
          if (consoleCommandsArray.length > 0){ // There is at least 1 command registered for this console.
            console.log(" -=Install Specific Commands=-");
            for (let i=0;i<consoleCommandsArray.length;i++){
              commandCategory=consoleCommands[consoleCommandsArray[i]][0];
              if (outputObject.hasOwnProperty(commandCategory)){ // Reorganize by categories for output display
                outputObject[commandCategory].push(consoleCommandsArray[i]);
              } else {
                outputObject[commandCategory]=[consoleCommandsArray[i]];
              }
            }
            var outputObjectKeys=Object.keys(outputObject);
            for (let e=0;e<outputObjectKeys.length;e++){ // Display everything based on category
              console.log(`-- ${outputObjectKeys[e]} --`);
              for (let f=0;f<outputObject[outputObjectKeys[e]].length;f++){ // This should be an array of all the commands in the category
                console.log(` !${outputObject[outputObjectKeys[e]][f]}`); // Read from the array of commands listed under this category
              }
            }
            console.log(" ");
          }
        }
  
        // console.log(  "-- Server Commands --")
        // console.log(" !status");
        // console.log(" !start");
        // console.log(" !stop");
        // console.log(" !kill");
        // console.log(" !forcekill");
        // console.log(" ");
        console.log(" -- Wrapper Commands --");
        console.log(" !quit"); // Quits the wrapper, closing any sub-processes.
        console.log(" !consoles");
        console.log(" !console [console #]");
        // console.log(" !stdout [on/off]");
        // console.log(" !stderr [on/off]");
        // console.log(" !stderrfilter RegExp");
        // console.log(" !serverlog [on/off]");
        console.log(" !debug [on/off]"); // Displays debug messages
        // console.log(" !enumerateevents [on/off]");
        console.log(" !reloadMods");
        // console.log(" !showallevents [on/off]");
        // console.log(" !listObjectConstructors");
        // console.log(" !listObjectConstructorElements [ObjectName(parameters)]");
        // console.log(" !listGlobal");
        // console.log(" !settings");
        // console.log(" !changesetting [setting] [newvalue]");
      }

    } else if (i(theCommand, "consoles")) {
      let consoleKeys = Object.keys(global["consoles"]);
      let currentConsoleNumber=0;
      if (consoleKeys.length > 0) {
        console.log("");
        console.log("Consoles available:");
        for (let i = 0;i < consoleKeys.length;i++) {
          console.log("  " + i + ": " + consoleKeys[i]);
          if (global["consoleSelected"] == consoleKeys[i]){
            currentConsoleNumber=i;
          }
        }
        console.log("");
        console.log(`Current Console: [${currentConsoleNumber}] ${global["consoleSelected"]}`)
        
        console.log("");
        console.log("To switch to another console, type: !console [#]");
        console.log("Example:  !console 0");
      } else {
        console.log("Well that's funny, there do not appear to be any consoles available!");
      }
    } else if (i(theCommand, "console")) {
      let consoleKeys = Object.keys(global["consoles"]);
      let theConsoleNum = toNumIfPossible(theArguments[0]);
      if (typeof theConsoleNum == "number") {
        if (consoleKeys.length < 1) {
          console.log("Well that's funny, there do not appear to be any consoles available!");
        } else {
          let theChoice = null;
          for (let i = 0;i < consoleKeys.length;i++) {
            if (i == theConsoleNum) {
              theChoice = consoleKeys[i];
            }
          }
          if (theChoice === null) {
            console.log("ERROR: That console number did not appear to exist!  Cannot switch to it!");
            console.log("To see a list of consoles available, type: !consoles");
          } else {
            // console.clear(); // Some say this doesn't work in windows.  There is a global.cls option which I may need to switch to.
            console.log("Switched to console number " + theConsoleNum + ", '" + theChoice + "'.");
            // global["consoleSelected"] = theChoice; // depreciated
            global["consoles"][theChoice]["console"].switchTo();
          }
        }
      } else {
        console.log("ERROR:  Please provide the number of console you wish to switch to!");
        console.log("You can type '!consoles' for a list of available consoles.");
      }


    } else if (i(theCommand, "reloadmods")) {
      globalEventUnmodified.emit("reloadMods");
      global["reloadServerMods"]();


    // } else if (i(theCommand, "listGlobal")) {
    //   let params;
    //   console.log("Enumerating elements from the global object:");
    //   var keyArray = [];
    //   for (let key in global) {
    //     if (global.hasOwnProperty(key)) {
    //       keyArray.push(key);
    //     }
    //   }
    //   keyArray = keyArray.sort(); // Alphabetize the list
    //   for (let i = 0;i < keyArray.length;i++) {
    //     if (typeof global[keyArray[i]] == "function") {
    //       params = getParamNames(global[keyArray[i]]);
    //       if (getParamNames.length > 0) {
    //         console.log(" (" + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i] + "(" + params + ")");
    //       } else {
    //         console.log(" (" + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i] + "()");
    //       }
    //     } else if (typeof global[keyArray[i]] == "object") {
    //       if (global[keyArray[i]] instanceof Array) {
    //         console.log(" (Array) \tglobal." + keyArray[i]);
    //       } else if (global[keyArray[i]] instanceof Map) {
    //         console.log(" (Map " + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i]);
    //       } else if (global[keyArray[i]] instanceof Date) {
    //         console.log(" (Date " + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i]);
    //       } else {
    //         console.log(" (" + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i]);
    //       }
    //     } else {
    //       console.log(" (" + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i]);
    //     }
    //   }


    //   // for (let key in global){
    //   //   if (global.hasOwnProperty(key)){
    //   //     if (typeof global[key] == "function"){
    //   //       params=getParamNames(global[key]);
    //   //       if (getParamNames.length > 0){
    //   //           console.log(" (" + typeof global[key] + ") \t" + key + "(" + params + ")");
    //   //       } else {
    //   //         console.log(" (" + typeof global[key] + ") \t" + key + "()");
    //   //       }
    //   //     } else {
    //   //       console.log(" (" + typeof global[key] + ") \t" + key);
    //   //     }
    //   //   }
    //   // }
    //   console.log(" ");

    } else if (i(theCommand, "listWrapperObjects")) {
      let keyArray;
      let keyUpperCase;
      console.log("Listing constructor objects:");
      let outputArray = [];
      for (let key in objectCreator) {
        if (objectCreator.hasOwnProperty(key)) {
          keyArray = key.split("");
          keyUpperCase = keyArray[0].toUpperCase();
          if (keyUpperCase === keyArray[0]) {
            outputArray.push(key + "(" + getParamNames(objectCreator[key]) + ")");
            // console.log(" - " + key + "(" + getParamNames(objectCreator[key]) + ")");
          }
        }
      }
      outputArray = outputArray.sort(); // alphabetize the list
      for (let i = 0;i < outputArray.length;i++) {
        console.log(" - " + outputArray[i]);
      }
      console.log(" ");
    } else if (i(theCommand, "listObjectConstructorElements")) {
      // This needs an example object to be created, so it will expect input to create an example object to then test
      // example:  PlayerObj("Test");

      if (testIfInput(theArguments[0])) {
        var input = theArguments[0].replace(/"/g, "'");
        var objName = toStringIfPossible(input.match(/^[^(]+/));
        if (typeof objName == "string") {
          var objArguments = toStringIfPossible(input.match(/(?<=\()[^(^)]+(?=\))/));
          if (typeof objArguments == "string") {
            var objArgumentsArray = objArguments.replace(/'/g, "").split(",");
            var paramNamesArray = getParamNames(objectCreator[objName]);
            var paramNames = paramNamesArray.join(",");
            if (objArgumentsArray.length == paramNamesArray.length) {
              if (objectCreator.hasOwnProperty(objName)) {
                console.log("Listing the elements for: " + objName + "(" + paramNames + ")");
                let valid = false;
                try {
                  var dummyObj = new objectCreator[objName](...objArgumentsArray);
                  valid = true;
                } catch (err) {
                  console.log("ERROR:  Invalid input given to constructor object!  Please provide the correct input.");
                  console.dir(err);
                }
                if (valid) {
                  var theArray = listObjectMethods(dummyObj);
                  theArray = theArray.sort(); // alphabetize the list
                  for (let i = 0;i < theArray.length;i++) {
                    console.log(" - " + theArray[i]);
                  }
                }

              } else {
                console.log("Constructor does not exist!  Please specify a valid object constructor.  Example: !listObjectMethods PlayerObj");
              }
            } else {
              console.log("Please provide a valid amount of arguments to create the dummy object to test.");
              console.log("The object constructor requires the following values: " + objName + "(" + paramNames + ")");
            }

          } else {
            console.log("Please provide arguments to produce a dummy object to test. Example: !listObjectMethods PlayerObj(\"SomePlayer\")");
          }
        } else {
          console.log("Please provide a valid object type.  Example: !listObjectMethods PlayerObj(\"SomePlayer\")");
        }
      } else {
        console.log("Please provide a valid object type.  Example: !listObjectMethods PlayerObj(\"SomePlayer\")");
      }
    } else if (i(theCommand, "quit")) {
      console.log("Exiting wrapper..");
      process.exit(); // Any listeners for the server exit will fire before the wrapper actually stops. 
    } else if (i(theCommand, "debug")) {
      if (theArguments[0] == "on") {
        console.log("Setting debug to true!");
        global["debug"] = true;
      } else if (i(theArguments[0], "off")) {
        console.log("Setting debug to false!");
        global["debug"] = false;
      } else {
        console.log("Debug is currently set to '" + global["debug"] + "'.  To turn debugging on or off, type !debug on/off");
      }
    } else {
      console.log("No such command found!");
    } 
  } else if (testIfInput(theText)) {
    // if (global["server"].spawnStatus == "started"){
    //   console.log("Sending text to console: " + theText);
    //   global["server"].spawn.stdin.write(theText + "\n");
    // console.log("Sending text is disabled till the console system is built.");
    if (typeof theInstallObj == "object"){
      console.log("Install found, looking for server object..");
      if (typeof serverObj == "object"){
        console.log("The installObj had a serverObj!  Sending text to server..");
        serverObj.sendDirectToServer(theText); // The serverObj should have a "SendDirectToServer" method for this.
      } else {
        console.log("The install did not have a serverObj registered!  Cannot send command to it!");
      }
    }
    


    // TODO: Build the console system.
    // } else {
    //   console.error("ERROR: Server does not appear to be running.  Cannot send text to console!");
    // }

    // global["server"].spawn.stdin.write(text.toString() + "\n");
    // global["server"].spawn.stdin.end();
  } // If blank, don't do anything.

  return true; // This does nothing except to make ESLint happy.

});

function runConsoleCommand(theConsoleObj,theCommandStr,theArgumentsArray,options){ // options is used for help on specific commands.
  // Example: runConsoleCommand(consoleObj,"whatever",["some","arguments"]);
  // Example2: runConsoleCommand(consoleObj,"whatever",["some","arguments"],{help:true});
  var theProperCommand="";
  if (typeof theConsoleObj == "object"){
    if (theConsoleObj.hasOwnProperty("commands")){
      // console.log("Commands found!"); // temp
      // Now we need to do a case insensitive search of the commands and get the corresponding command.
      let theCommands=Object.keys(theConsoleObj.commands);
      for (let z=0;z<theCommands.length;z++){ // Find if any case insensitive match and then run the first one found.
        if (i(theCommands[z],theCommandStr)){
          theProperCommand=theCommands[z];
          // console.log("Registered command found!  Running it!"); // temp
          if (Array.isArray(theConsoleObj.commands[theProperCommand])){
            if (typeof theConsoleObj.commands[theProperCommand][1] == "function"){
              // console.log("Running command now!!"); // temp
              theConsoleObj.commands[theProperCommand][1](theProperCommand,theArgumentsArray,options); // Runs the function associated with the command, providing the arguments, terminating with it.  This allows commands to replace wrapper commands.
              return true; // indicate that the command was ran.
            } else {
              throw new Error("ERROR: command was not registered properly!  Invalid input given as function!"); // This should never happen
            }
          } else {
            throw new Error("ERROR: command was not registered properly!  Expected an array!"); // This should never happen
          }
        }
      }
    }
  }
  return false; // No command to run
}

// #####################
// ###   EMITTERS   ####   These are registered ahead of time so when the time is ready, they call the associated functions.
// #####################   We use emitters to separate each stage so in the future, wrapper mods might be able to install themselves utilizing the global event Emitter events.
// We only want these to run once because they should already be finished if wrapper mods get reloaded
globalEventUnmodified.once('asyncStart', installDepsAsync);
globalEventUnmodified.once('syncStart', installDepsSync);
globalEventUnmodified.once('ready', goReady);


// ####################
// ###  FUNCTIONS  #### -- The standard practice for functions is first write in place, then make a multi-purpose function that handles what you need and can be used elsewhere, then bundle it in a require and change over functionality.  This is to keep the main script at a maintainable length and also have high re-usability value for code created.
// ####################

function regServerObj(installPath, serverObj) {
  if (typeof installPath == "string") {
    if (global["installObjects"].hasOwnProperty(installPath)) { // The installObjects object should have already been created at this point.
      if (typeof serverObj == "object") {
        global["installObjects"][installPath].serverObj = serverObj;
        // global["installObjects"][installPath].event.emit("start",serverObj); // I'll leave this to the starter.js script for the mod.
        mainConsole.log("Registered server object for install: " + installPath);
      } else {
        throw new Error("Invalid input given for 'serverObj' parameter invalid!  Requires a server object!  Usage: regInstall(installPath,serverObj)");
      }
    } else {
      throw new Error("No install for the path exists!  Path given: " + installPath);
    }
  } else if (typeof installPath == "undefined" || typeof installPath == "undefined") {
    throw new Error("No input given for 'installPath' or 'serverObj' parameter!  Usage: regInstall(installPath,serverObj)");
  } else {
    throw new Error("Invalid input given for 'installPath' parameter! Should be a string!  Usage: regInstall(installPathString,serverObj)");
  }
}

function getServerPath(pathToMod) { // mods will be in /installPath/mods/nameOfMod/, so all this does is remove /mods/nameOfMod/ from the path
  // This will recurivesly move down, trying on each path down till there is no path left.
  // Example (where c:\starmade.js\starmade is the install folder):
  // Where the script name is:  c:\starmade.js\starmade\mods\myMod\bin\someScript.js
  // First it sees if this is a server mod: c:\starmade.js\starmade\mods\
  // It is not, so then it will try:  c:\starmade.js\starmade\
  // This IS the registered install folder, so that is what it will return.
  if (typeof pathToMod == "string") {
    var pathArray = pathToMod.split(path.sep);
    if (pathArray.length > 3){ // All paths MUST BE at least 2 deep past the install folder. Example: /mods/MyMod
      pathArray.pop();
      pathArray.pop();
    } else {
      throw new Error("Invalid folder length given to getServerPath function!");
    }
    var pathArrayLength=pathArray.length; // This should be 1 or higher
    var tempPath="";
    for (let i=0;i<pathArrayLength;i++){ // Try up to the amount of folder paths listed.  For example C:\starmade\mods\myMod will have a 4 length.
      tempPath=pathArray.join(path.sep);
      if (global["installObjects"].hasOwnProperty(tempPath)) {
        return tempPath; // An install object exists for this path, so return this path.
      }
      pathArray.pop(); // If none of the paths were an install object, then the array will be empty after all cycles.
    }
    return null; // No install path found based on input
  }
  throw new Error("Invalid input given for pathToMod argument.  Usage: getServerPath(__dirname)");
}

function getInstallObj(pathToMod) {
  // This is used for a mod to grab the installObj of the server it is a part of.
  // Usage:  global.getInstallObj(__dirname);
  // Returns an object that contains event, path, modRequires, and serverObj (if it has been initialized).
  // If the install has not been registered to the global variable, it will return null
  if (typeof pathToMod == "string") {
    var serverPath=getServerPath(pathToMod);
    if (serverPath !== null){
      return global["installObjects"][serverPath];
    }
    return null;
  }
  throw new Error("Invalid input given for pathToMod argument.  Usage: getInstallObj(__dirname)");
}
function getServerObj(pathToMod) { // This is redundant since the serverObj is available on the installObj
  // This is used for a mod to grab the serverObj of the server it is a part of.
  // Usage:  global.getServer(__dirname);
  // Returns the object to the server for which the mod is a part of.  
  // If the server has not been registered to the global variable, it will return null
  var starMadeDir = getServerPath(pathToMod);
  if (global["installObjects"].hasOwnProperty(starMadeDir)) {
    if (global["installObjects"][starMadeDir].hasOwnProperty("serverObj")) {
      return global["installObjects"][starMadeDir].serverObj;
    }
  }
  return null;
}
function writeSettings() {
  var settingsFileName = path.basename(global["settingsFilePath"]);
  try {
    // var settingsFileStream=fs.createWriteStream(settingsFilePath); // Why use a stream?
    // settingsFileStream.write(JSON.stringify(settings, null, 4));
    // settingsFileStream.end();
    writeJSONFileSync(global["settingsFilePath"], global["settings"]);
    mainConsole.log("Updated '" + settingsFileName + "' file.");
    log("Updated '" + settingsFileName + "' file.");
  } catch (err) {
    mainConsole.error("ERROR: Could not write to the '" + settingsFileName + "' file!");
    log("ERROR: Could not write to the '" + settingsFileName + "' file!");
    throw err;
  }
}
function getSettings(defaultSettings) { // This grabs the settings from the settings.json file. defaultSettings is optional if the file has already been written and should be complete.
  var outputSettings = {};
  if (existsAndIsFile(global["settingsFilePath"])) {
    var theSettings = getJSONFileSync(global["settingsFilePath"]);
    if (typeof defaultSettings == "object") {
      outputSettings = Object.assign({}, defaultSettings, theSettings); // Combine the settings from the file with the default settings, in case a part was deleted for some reason.  This will prefer the settings from the file for existing elements.
    } else {
      outputSettings = theSettings;
    }
  } else if (typeof defaultSettings == "object") {
    mainConsole.log("No settings.json file existed, creating a new one!");
    writeJSONFileSync(global["settingsFilePath"], defaultSettings); // settings.json file has not been created, so let's create it.  This assumes the defaults have already been set at the top of this script.
    return defaultSettings; // This assumes default settings had been set up by this script.
  } else {
    throw new Error("No settings.json file existed and no default settings given!  Cannot load settings!");
  }
  return outputSettings;
}
var operationMessages = []; // This is unused for now, but it can be used to see the operations that completed and their order if they were named.
function asyncOperation(val) { // This controls when the start operation occurs.  All file reads, downloads, installs, etc, must be completed before this will trigger the "ready" event.
  // mainConsole.log("operations ongoing: " + operations + " Command given: " + val);
  var operationMessage = ".";
  if (arguments[1]) {
    operationMessage = ": " + arguments[1];
  }
  if (val == "start") { // Start is used when an asyncronous operation starts and end should be used when it's finished.
    operations++;
    // mainConsole.log("Operation started" + operationMessage);
  } else if (val == "end") {
    // mainConsole.log("Operation ended" + operationMessage);
    operationMessages.push("Operation ended" + operationMessage);
    if (operations > 1) {
      operations--;
    } else {
      mainConsole.log("Async operations finished.");
      global["event"].emit("syncStart");
    }
  }
}
function preDownload(httpURL, fileToPlace) { // This function handles the pre-downloading of files, such as StarNet.jar.  When all downloads are finished, the StarMade server is started by emitting the event signal, "ready".
  // Code adapted from: https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
  asyncOperation("start", "preDownload: " + fileToPlace);
  let tempFileToPlace = path.resolve(mainFolder, fileToPlace + ".tmp");
  miscHelpers.deleteFile(tempFileToPlace, {"quiet": true});
  let resolvedFileToPlace = path.resolve(mainFolder, fileToPlace);
  let baseFileToPlace = path.basename(resolvedFileToPlace);
  let baseDirForFile = path.dirname(resolvedFileToPlace);

  // Check to see if the file already exists or not.  If it does exist, then we can end this operation.
  // fs.accessSync(resolvedFileToPlace),fs.constants.F_OK); // Supposed to check if the file can be seen but it was not working for me for some reason.
  if (fs.existsSync(resolvedFileToPlace)) { // We can see that a file, directory, or symlink exists at the target path
    if (fs.statSync(resolvedFileToPlace).isFile()) {
      // mainConsole.log("'" + baseFileToPlace + "' existed.  Good!"); // File already exists, nothing to do.
      asyncOperation("end", "preDownload: " + fileToPlace);
      return true;
    } else if (fs.statSync(resolvedFileToPlace).isDirectory()) {
      throw new Error("ERROR: Cannot pre-download file: " + resolvedFileToPlace + "\nDirectory already exists with the name!  Please remove this directory and run this script again!");
    } else {
      throw new Error("ERROR: Cannot pre-download file: " + resolvedFileToPlace + "\nPath already exists with the name!  Please rectify this and then run this script again!");
    }
  } else { // If the file does not exist, let's download it.
    mainConsole.log("Downloading '" + baseFileToPlace + "' from: " + httpURL);
    miscHelpers.ensureFolderExists(baseDirForFile); // ensure the directory the file needs to be placed in exists before trying to write to the file.
    var file = fs.createWriteStream(tempFileToPlace); // Open up a write stream to the temporary file.  We are using a temporary file to ensure the file will only exist at the target IF the download is a success and the file write finishes.
    try {
      var request = http.get(httpURL, function (response) {
        // mainConsole.log("Status Code: " + response.statusCode);
        // When the file is downloaded with the "http.get" method, it returns an object from which you can get the HTTP status code.
        // 200 means it was successfully downloaded, anything else is a failure.  Such as 404.
        if (response.statusCode == 200) {
          response.pipe(file);
        } else {
          mainConsole.error("Error downloading file, '" + baseFileToPlace + "'!  HTTP Code: " + response.statusCode);
          process.exitCode = 5;
          throw new Error("Response from HTTP server: " + response.statusMessage);
        };
      });
      request.on('error', (e) => {
        process.exitCode = 4;
        throw new Error(`problem with request: ${e.message}`);
      });
    } catch (err) { // If there was any trouble connecting to the server, then hopefully this will catch those errors and exit the wrapper.
      mainConsole.log("ERROR:  Failed to download, '" + httpURL + "'!");
      process.exitCode = 4;
      throw err;
    }
    file.on('finish', function () {
      file.close();
      fs.rename(tempFileToPlace, resolvedFileToPlace, (err) => {
        if (err) {
          throw err;
        }
        mainConsole.log("'" + baseFileToPlace + "' downloaded successfully! :D");
        asyncOperation("end", "preDownload: " + fileToPlace); // We're using a function to keep track of all ongoing operations and only triggering the start event when all are complete.  So let's complete this operation.
      });
    });
  }
  return true;
}



// ##########################################
// ###  MAIN SCRIPT EXIT  - GLOBAL SCOPE ####
// ##########################################
exitHook(() => { // This will handle sigint and sigterm exits, errors, and everything.
  // Cleanup that needs to be done on the global scope should be done here.
  console.log("Global Exit event running using exitHook require..");
  emitToAllInstalls("processExit"); // This emits to each individual installObj.event
  // add global "processExit" emit
  global["event"].emit("processExit"); // This will emit to all the installObj.globalEvent emitters
  writeSettings(); // Always make sure the settings get written before exit, so any changes are recorded.
  writeAllJSONs(); // Write the data objects for every install, to ensure they are saved.
});

// ##############################
// ### CREATE NEEDED FOLDERS  ###
// ##############################


// Load any wrapper mods now that basic wrapper stuff is loaded in.
mainConsole.log("Loading any wrapper mods..");
loadWrapperMods();

// ###################################
// ### DEPENDENCIES AND DOWNLOADS  ###
// ###################################

// Check for dependencies, such as StarNet.jar and download/install if needed.
// When all dependency downloads/installs are finished, start the server!
mainConsole.log("Ensuring all dependencies are downloaded or installed..");
// ### Async downloads/installs that have no dependencies ### -- This sub-section is for all installs/downloads that can be done asynchronously to occur as quickly as possible.
global["event"].emit("asyncStart",asyncOperation); // Mods are given this function so they can "start" or "end" operations to signal the next phase to the wrapper start.

function installDepsAsync(){
  mainConsole.log("Starting asyncronous setup operations..");
  asyncOperation("start"); // This prevents the first async function from starting the wrapper if it finishes before the next one starts.
  preDownload(starNetJarURL, starNetJar); // This function handles the asyncronous downloads and starts the sync event when finished.
  preDownload(starMadeInstallerURL, global["starMadeInstallerFilePath"]); // When setting the install path for StarMade, we should have handled the terms and conditions, so it should be ok to download it.
  asyncOperation("end"); // this will emit the syncStart event, which calls installDepsSync
}

// ### Sync downloads/installs ### -- When async installs/downloads are finished, this function will be called.
function installDepsSync() { // This is called DIRECTLY by the when syncStart is emitted.
  // ### Only syncronous installs here ### e.g. await installRoutine();
  // None right now
  mainConsole.log("About to start server..");
  // ### Unimportant Async downloads/installs ### -- These should not be required by the server to run, but they may have depended on the first async install or sync installs before they could be run.
  // None right now
  global["event"].emit('ready'); // Signal ready to load the server mods, which are then responsible for starting their own servers.
}

// ##########################
// ### Start the servers  ###
// ##########################

function goReady(){ // This is called when the "ready" event is emitted globally
  // Check to see if any server has been set up yet in settings, if not, get the install path before loading the mods.
  // The mods should handle setting up the rest of the settings, installing, and starting
  if (Object.keys(global["settings"].servers).length < 1) {
    mainConsole.log("No server has been set up before!  Let's set one up!");
    setupNewServer();
  }
  // global["installObjects"]={
  //   "/some/path/here":{
  //     event:new EventEmitter(),
  //     path:"/some/path/here",
  //     settings:global["settings"].servers["/some/path/to/install"],
  //     serverObj:theServerObj // This is only available AFTER a mod has created the relevant serverObj and registered it
  //   }   
  // };
  var serverKeys = Object.keys(global["settings"].servers);
  // Create the installObj entries for each install in settings
  var modsFolder="";
  for (let i = 0;i < serverKeys.length;i++) {
    //check to see if a mods folder exists, and if not, copy the mods from the root folder over.  This will happen on new install and is self-healing
    modsFolder=path.join(serverKeys[i],"mods");
    if (!existsAndIsDirectory(modsFolder)) { 
      try {
        fsExtra.copySync(global["modsFolder"], modsFolder); // This creates the folder if it doesn't exist
        mainConsole.log("Copied mods folder from wrapper folder to starmade install folder: " + modsFolder);
      } catch (err){ // This should only happen is trying to install to a folder they don't have write permissions to, or maybe a failing hard drive or something?
        console.log("ERROR:  Could not copy mods folder over to install!  Does starmade.js have write permissions to the folder?  Folder: " + modsFolder);
        throw err;
      }
    }

    mainConsole.log("Creating Install Object for server: " + serverKeys[i]);
    // tempConsole=customConsole(serverKeys[i],{invincible: true}); // This needs to be fixed before I can use it.
    global["installObjects"][serverKeys[i]] = {
      "path": serverKeys[i],
      "log": customLog(serverKeys[i]),
      "console": customConsole(serverKeys[i],{invincible: true}), // This is a console that only displays when mods for this install use it.  It is "invincible", so it will not be unloaded if the unloadListeners event happens.  This is also used for registering commands for the wrapper.
      "defaultEvent": customEvent(), // This event does not reload on .reloadmods().  This should only be used for default mods, which also do not reload.
      "defaultGlobalEvent": global["event"].spawn(), // This should be used by mods instead of global["event"].emit.  This will catch global["event"].emit's and any emits from any other install or sub-spawn of this custom event object.
      "settings": global["settings"].servers[serverKeys[i]], // This is redundant, to make it easier to pull the info.
      "objects":{}, // Objects the server might use, such as PlayerObj.  These must be registered during the init phase, so they are ready by the start phase.
      "regConstructor":function(theConstructor){ return regConstructor(this.path,theConstructor) }, // Example: installObj.regObject("PlayerObj",PlayerObj)
      "deregConstructor":function(theConstructor){ return deregConstructor(this.path,theConstructor) },
      "deregAllConstructors":function(){ return deregAllConstructors(this.path) },
      "reloadMods": function(options){ return reloadServerMods(this.path,options) }, // Reloads the listeners and mods
      "JSONFileCache": {}, // Used for managing JSON files for mods
      "getJSON": function(modDirPath,nameOfJSONFile){ return getJSON(this.path,modDirPath,nameOfJSONFile) },  // Example of code in a mod: installObj.getJSON(__dirname,"whatever")
      "getJSONPath": function(modDirPath,nameOfJSONFile){ return getJSONPath(this.path,modDirPath,nameOfJSONFile) },  // Example of code in a mod: installObj.getJSON(__dirname,"whatever")
      "writeJSON": function(modDirPath,nameOfJSONFile){ return writeJSON(this.path,modDirPath,nameOfJSONFile) },  // Example of code in a mod:  installObj.writeJSON(__dirname, "whatever")
      "writeJSONFiles": function(){ return writeJSONs(this.path) } // Example: installObj.writeJSONFiles()
      // "serverObj":theServerObj // This should be added by the starter mod for the install.
    };
    global["installObjects"][serverKeys[i]]["event"]=global["installObjects"][serverKeys[i]]["defaultEvent"].spawn(); // Each install gets it's own modified event listener.  Prior to scripts being reloaded, event listeners should be removed using .removeAllListeners()
    global["installObjects"][serverKeys[i]]["globalEvent"]=global["installObjects"][serverKeys[i]]["defaultGlobalEvent"].spawn(); // These are events that are broadcast globally, accross all servers and wrapper.  Prior to scripts being reloaded, event listeners should be removed using .removeAllListeners()

    // Write config file with path to starmade.js to the wrapper folder so mod scripting can find their way back to the config files or bin folder if ran independently (such as with starnet.js).
    writeJSONFileSync(path.join(serverKeys[i],"wrapperInfo.json"),{"path":__dirname});

    global["installObjects"][serverKeys[i]]["modRequires"]=requireServerMods(serverKeys[i]); //  This loads in the mods.  This object is used when reloading the mods to be able to delete the cache and then re-require each file.
    // The mods are responsible for installation of the server, setting up extra settings, and starting the server.
    mainConsole.log(`Finished Install object for install: ${serverKeys[i]}!`);

    // ### Listeners for reloading basic structures of installObj
    global["installObjects"][serverKeys[i]]["defaultEvent"].on("unloadMods",function(){
      // Ensure cache is fresh upon reload
      console.log("Resetting the data file cache for installObj's..");
      global["installObjects"][serverKeys[i]].writeJSONFiles(); // Write the cache to the hard drive
      global["installObjects"][serverKeys[i]].JSONFileCache={}; // delete the cache
    });

    if (serverKeys.length == 1){ // if there is only one install, then switch to this console, otherwise stay on main.
      mainConsole.log("Only one install found, so switching to console for it.");
      global["installObjects"][serverKeys[i]].console.switchTo();
    }
  }
    
  // Now that all mods are loaded, let's emot init.  This indicates to mods that all other mods have been loaded, so if some mods need each other, now is the time to initialize
  global["event"].emit("init"); // emits to the global Event, including each globalEvent for each server.
  emitToAllInstalls("init"); // emits to the server event for each install
  // On init, there is a default mod that will create a serverObj and emit "start" on it's own server event emitter, providing the serverObj.  This is so other mods can then initialize with the serverObj.
};

// TODO:  Create system for reading and writing JSON files from the /installPath/data folder.

function getJSONPath(installPath,modPath,nameOfFile){ // installPath should always be given, modPath and nameOfFile are optional
  // For use with the installObj
  // If modPath and nameOfFile are not given, will return a global.json file object
  var theFolderPath="";
  var theFileName="data.json"; // This will be used if no nameOfFile given, but the mod folder is
  var modsDataFolderName="modsData";
  if (typeof modPath == "undefined" || modPath == "" || modPath === null){  // if no modpath specified
    theFolderPath=path.join(installPath,modsDataFolderName); // set path to modsData folder.
    if (typeof nameOfFile !== "string" || nameOfFile == "" || nameOfFile === null){
      theFileName="global.json"; // if no filename given, use the default
    }
  } else { // If mods folder given, resolve the modsData folderPath.
    theFolderPath=resolveFromTwoPaths(installPath,"modsData",modPath);
    // Example of resolution:  "/path/to/install/mods/MyMod" translates to "/path/to/install/modsData/MyMod"
  }
  if (typeof nameOfFile == "string"){ // Whether a global file or individual mod file, standardize the filename (this is important for linux)
    theFileName=nameOfFile.replace(/\.json$/i,"") + ".json";
  }
  return path.join(theFolderPath,theFileName);
}
function getJSON(installPath,modPath,nameOfFile){ // installPath should always be given, modPath and nameOfFile are optional
  // For use with the installObj
  // If modPath and nameOfFile are not given, will return a global.json file object
  var theFilePath=getJSONPath(installPath,modPath,nameOfFile);
  miscHelpers.ensureFolderExists(path.dirname(theFilePath));
  if (global["installObjects"][installPath]["JSONFileCache"].hasOwnProperty(theFilePath)){ // If cached,
    return global["installObjects"][installPath]["JSONFileCache"][theFilePath]; // Return the cached object
  }
  if (existsAndIsFile(theFilePath)){ // If the file exists, load it, cache it, and return it.
    global["installObjects"][installPath]["JSONFileCache"][theFilePath]=getJSONFileSync(theFilePath);
  } else { // if it doesn't exist, then write a blank JSON file and return a blank object.
    writeJSONFileSync(theFilePath,{});
    global["installObjects"][installPath]["JSONFileCache"][theFilePath]={};
  }
  return global["installObjects"][installPath]["JSONFileCache"][theFilePath]; // Will either be the file contents or {}
}
function writeJSON(installPath,modPath,nameOfFile){
  // Helper function for use with installObj.  Saves an individual JSON file.
  // installPath should always be given, modPath and nameOfFile are optional
  // If modPath and nameOfFile are not given, will save the global.json file
  var theFilePath=getJSONPath(installPath,modPath,nameOfFile);
  miscHelpers.ensureFolderExists(path.dirname(theFilePath));
  if (!global["installObjects"][installPath]["JSONFileCache"].hasOwnProperty(theFilePath)){ // If not cached,
    global["installObjects"][installPath]["JSONFileCache"][theFilePath]={}; // set blank Obj to write
  }
  console.log(`Writing file: ${theFilePath}`);
  // console.debug(global["installObjects"][installPath]["JSONFileCache"][theFilePath]); // temp
  return writeJSONFileSync(theFilePath,global["installObjects"][installPath]["JSONFileCache"][theFilePath]);
}

function writeJSONs(installPath){
  // Saves all cached JSON files for each individual mod and the global.json if it was retrieved before.
  let theKeys=Object.keys(global["installObjects"][installPath]["JSONFileCache"]); // each key is a full path to the file
  for (let i=0;i<theKeys.length;i++){
    console.log(`Writing file: ${theKeys[i]}`);
    writeJSONFileSync(theKeys[i],global["installObjects"][installPath]["JSONFileCache"][theKeys[i]]); // (pathToIndividualFile, cached object)
  }
  return true;
}

function resolveFromTwoPaths(firstPath,folderName,secondPath){
  // used with writeJSON and getJSON to mirror directories
  // Example: ("/path/to/starmade/install/"","modsData","/path/to/starmade/install/mods/myMod")
  // Should return "/path/to/starmade/install/modsData/myMod"
  // Example 2: ("/path/to/starmade/install/"","modsData","/path/to/starmade/install/mods/myMod/whatever")
  // Should return "/path/to/starmade/install/modsData/myMod/whatever"
  let dataPath=path.join(firstPath,folderName);
  var theReg=new RegExp(`${firstPath.replace(/\\/g,`\\${path.sep}`)}`); // To remove the firstPath from the secondPath.  TODO:  Needs to be tested in linux and mac
  let tempPartialPath=secondPath.replace(theReg,"");
  let tempPartialPathArray=tempPartialPath.split(path.sep);
  tempPartialPathArray.shift(); // Removes a blank value 
  tempPartialPathArray.shift(); // Remove the "mods" folder
  tempPartialPath=tempPartialPathArray.join(path.sep);
  return path.join(dataPath,tempPartialPath); // Build the full path
}


function regConstructor (installPath,theFunction) { // Overwrites any previously registered constructors by the same name
  if (typeof theFunction == "function") {
    if (theFunction.hasOwnProperty("name")) {
      var firstLetter = theFunction.name[0];
      var letterTest = firstLetter.toLowerCase();
      if (firstLetter === letterTest) {
        throw new Error("Unable to register constructor! Constructor functions should have an uppercase first letter! '" + theFunction.name + "' does not have an uppercase first letter! -- Source Server: " + installPath);
      } else {
        global["installObjects"][installPath].objects[theFunction.name] = theFunction;
        global["installObjects"][installPath].console.log(`Registered new Constructor, '${theFunction.name}'.`); // This does not make it a constructor.
        return true;
      }
    }
    throw new Error("Unable to register unnamed constructor!  Please only attempt to register VALID constructors!  Server: " + installPath);
  }
  throw new Error("Unable to register non-function constructor! typeof input given as theFunction: " + typeof theFunction);
}

function deregConstructor (installPath,theFunction) {
  var theFunctionTypeName = "";
  if (typeof theFunction == "function") {
    if (theFunction.hasOwnProperty("name")) {
      theFunctionTypeName = theFunction.name;
    } else {
      throw new Error("Invalid input given to deregConstructor!  Expects a named function or string! Server: " + installPath);
    }
  } else if (typeof theFunction == "string") {
    theFunctionTypeName = theFunction;
  } else {
    throw new Error("Invalid input given to deregConstructor!  Expects a named function or string! Server: " + installPath);
  }
  var deregged = false;
  if (global["installObjects"][installPath].objects.hasOwnProperty(theFunctionTypeName)) {
    deregged = true;
    global["installObjects"][installPath].console.log(`Deregistering object: '${theFunctionTypeName}'`);
    Reflect.deleteProperty(global["installObjects"][installPath].objects, theFunctionTypeName);
  }
  return deregged; // Returns true if successful, false if not found.
}

function deregAllConstructors(installPath) {
  global["installObjects"][installPath].console.log("Deregistering all constructors.."); // temp
  var deregged = false;
  const objectKeys = Object.keys(global["installObjects"][installPath].objects);
  for (let i = 0;i < objectKeys.length;i++) {
    if (global["installObjects"][installPath].deregConstructor(objectKeys[i])) { // If at least 1 constructor is deregistered, this will return true.
      deregged = true;
    }
  }
  return deregged; // Returns true if something was removed, false if not.
}

global["writeJSONFiles"]=writeAllJSONs;
function writeAllJSONs(){  // This will write all the JSON files for ALL installs.  This is intended to be ran on exit.
  var installKeys=Object.keys(global["installObjects"]);
  for (let i=0;i<installKeys.length;i++){ // For each install..
    mainConsole.log("Writing data objects to hard drive for install: " + installKeys[i]);
    global["installObjects"][installKeys[i]]["writeJSONFiles"](); // Write the global and mod specific jsons
  }
}
