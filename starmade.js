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
const http   = require('http');
const fs     = require('fs');
global["events"]=require('events');
const spawn  = require('child_process').spawn;
const path   = require('path'); // This is needed to build file and directory paths that will work in windows or linux or macosx.  For example, The / character is used in linu, but windows uses \ characters.  Windows also uses hard drive characters, wherease linux has mount points.  For example, in linux a path looks like "/path/to/somewhere", but in windows it looks like "c:\path\to\somewhere".  The path module takes care of this for us to build the path correctly.
// const stream   = require('stream'); // For creating streams.  Not used right now but may be later.

// ### Main Vars ### - Don't change these
console.log("Setting main vars..");
var mainFolder      = path.dirname(require.main.filename); // This is where the starmade.js is.  I use this method instead of __filename because starmade.js might load itself or be started from another script
var binFolder       = path.join(mainFolder,"bin");
var modsFolder       = path.join(mainFolder,"mods");
global["mainFolder"]=mainFolder;
global["binFolder"]=binFolder;
global["modsFolder"]=modsFolder;
var operations      = 0;
var serversRunning  = 0; // This is to count the server's running to manage the exit function and kill them when this main script dies.


// var lockFileObj = { // This will be used for the lock file, so if another instance of the script runs, it can parse the file and check PIDs, making decisions on what to do.
//   "mainPID": process.pid,
//   "serverSpawnPIDs": []
// }
console.debug=function (vals,sleepTime) { // for only displaying text when the -debug flag is set.  sleepTime is optional.
  if (debug==true){
    console.log(vals);
    if (sleepTime){
      sleepSync(sleepTime);
    }
  }
}
global["console"]=console;

// #######################
// ### SCRIPT REQUIRES ###
// #######################
// path.resolve below builds the full path to "./bin/setSettings.js" in such a way that is compatible with both windows and linux/macosx, since it doesn't use / or \ characters.
console.log("Importing bin scripts..");
const miscHelpers       = require(path.join(binFolder,"miscHelpers.js"));
const requireBin        = miscHelpers["requireBin"]; // Simplifies requiring scripts from the bin folder..yes I am this lazy.
global["miscHelpers"]=miscHelpers;
global["requireBin"]=requireBin;

console.log("Loading Objects..");
const installAndRequire = requireBin("installAndRequire.js"); // This is used to install missing NPM modules and then require them without messing up the require cache with modules not found (which blocks requiring them till an app restart).
const sleepSync             = requireBin("mySleep.js").softSleep; // Only accurate for 100ms or higher wait times.
const sleepPromise = requireBin("mySleep.js").sleepPromise;
const ini               = requireBin("iniHelper.js"); // This will replace the current functionality of ini by wrapping it and modifying the ini package so that it works correctly for starmade config files and ini files that use # characters.
const objectHelper      = requireBin("objectHelper.js"); // This includes assistance handling of custom objects and conversions
const regExpHelper      = requireBin("regExpHelper.js"); // Contains common patterns, arrays, and pattern functions needed for the wrapper.
// const smInstallHelpers = requireBin("smInstallHelpers.js");
global["installAndRequire"]=installAndRequire;
global["sleep"]=sleepPromise;
global["sleepSync"]=sleepSync;
global["ini"]=ini;
global["objectHelper"]=objectHelper;
global["regExpHelper"]=regExpHelper;

// #################################
// ### NPM DOWNLOADABLE REQUIRES ###
// #################################
console.log("Importing NPM requires, installing if need be..");
const isInvalidPath = installAndRequire("is-invalid-path",'^1.0.2'); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
const fsExtra=installAndRequire("fs-extra","^8.1.0");
const treeKill        = installAndRequire('tree-kill',"^1.2.1"); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes
// const iniPackage      = installAndRequire('ini'); // https://www.npmjs.com/package/ini Imports ini files as objects.  It's a bit wonky with # style comments (in that it removes them and all text that follows) and leaves // type comments, so I created some scripting to modify how it loads ini files and also created some functions to handle comments.
const prompt          = installAndRequire("prompt-sync","^4.1.7")({"sigint":true}); // https://www.npmjs.com/package/prompt-sync This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
global["prompt"]=prompt;
var Tail            = installAndRequire('tail',"^2.0.3").Tail; // https://github.com/lucagrulla/node-tail/blob/master/README.md For following the server log.  I forgot that the console output does NOT have everything.  This is NOT a perfect solution because whenever file rotation occurs, there is a 1 second gap in coverage.  Argh.
const exitHook        = installAndRequire('exit-hook',"^2.2.0"); // https://github.com/sindresorhus/exit-hook Handles normal shutdowns, sigterm, sigint, and a "message=shutdown" event.  Good for ensuring the server gets shutdown.
const sqlite3 = installAndRequire("sqlite3","^4.1.0").verbose(); // Embedded sql database
const _=installAndRequire("lodash","^4.17.15"); // Useful javascript shortcuts http://zetcode.com/javascript/lodash/
global["fsExtra"]=fsExtra;
global["treeKill"]=treeKill;
global["prompt"]=prompt;
global["Tail"]=Tail;
global["exitHook"]=exitHook;
global['sqlite3']=sqlite3;
global['_']=_;


// ### Set up submodules and aliases from requires.


// The eventEmitter records listeners as they are registered so these can have their caches can be deleted when mods are unloaded and reloaded.
var eventEmitter      = new global["events"].EventEmitter(); // This is for custom events
var eventListenersToRemoveOnReload=[];
var event=objectHelper.copyObj(eventEmitter);
event["on"]=eventOn;
function eventOn(eventName,theFunction){
  addEventsToRemoveOnModReload(eventName,theFunction);
  return eventEmitter.on(eventName,theFunction);
}
event["once"]=eventOnce;
function eventOnce(eventName,theFunction){
  addEventsToRemoveOnModReload(eventName,theFunction);
  return eventEmitter.once(eventName,theFunction);
}
global["event"]=event;
function addEventsToRemoveOnModReload(eventName,eventFunction){
  var theObj={};
  theObj[eventName]=eventFunction;
  eventListenersToRemoveOnReload.push(theObj);
}

// Object aliases
var {isPidAlive,isDirectory,getDirectories,isFile,getFiles,log,existsAndIsFile,existsAndIsDirectory,trueOrFalse,getJSONFileSync,getJSONFile,writeJSONFileSync,writeJSONFile}=miscHelpers;  // Sets up file handling
var {repeatString,isInArray,getRandomAlphaNumericString,arrayMinus,copyArray,toStringIfPossible,toNumIfPossible,testIfInput,simplePromisifyIt,listObjectMethods,getParamNames}=objectHelper;


// #####################
// ###    SETTINGS   ###
// #####################

// settings.json

var dummySettings={
  // These settings will over-ride any settings for individual servers
  showStderr:undefined, // If no true or false value set, the server specific setting will be used
  stderrFilter:undefined,
  showStdout:undefined,
  stdoutFilter:undefined,
  showServerlog:undefined,
  serverlogFilter:undefined,
  showAllEvents:undefined,
  enumerateEventArguments:undefined,
  lockPIDs:[1234], // These should be specificically the wrapper process itself or subprocesses of the wrapper, not including servers
  "autoExit": false, // This makes the wrapper shut down when all servers have been shut down intentionally
  servers:{
    "c:\\coding\\starmade.js\\starmade":{
      // These settings are server specific, they should not contain anything that isn't writable to a json file
      self:this,
      showStderr:true, // Normally this would be true but can be turned to false if testing
      stderrFilter:undefined,
      showStdout:false,
      stdoutFilter:undefined,
      showServerlog:true,
      serverlogFilter:undefined,
      showAllEvents:false,
      enumerateEventArguments:false,
      lockPIDs:[1234,2345,5678], //  These should be specific to the server instance
      "javaMin": "512m",
      "javaMax": "4096m",
      "port": "5252",
      "commandOperator": "!",
      "starMadeFolder": "c:\\coding\\starmade.js\\starmade",
      "starMadeInstallFolder":"c:\\coding\\starmade.js\\starmade\\StarMade",
      "botName": "Melvin",
      "smTermsAgreedTo": "yes",
      "buildBranch": "normal", // This can be "normal","dev", or "pre"
      "autoStart": true, // This starts this server on wrapper start
      "autoRestart": true // This restarts the server when it fails due to a crash.  Handles soft-crashes too.
    }
  }
}
var dummyServers={ // These are the server objects.  We are using the install directories as unique identifiers
  "c:\\coding\\starmade.js\\starmade":"serverObj"
}

var settingsFilePath = path.join(mainFolder, "settings.json");
var settings={ // These values will be overwritten by any existing settings.json file
  showStderr:null, // If no true or false value set, the server specific setting will be used
  stderrFilter:null,
  showStdout:null,
  stdoutFilter:null,
  showServerlog:null,
  serverlogFilter:null,
  showAllEvents:null,
  enumerateEventArguments:null,
  lockPIDs:[], // These should be specificically the wrapper process itself or subprocesses of the wrapper, not including servers
  "autoExit": false, // This makes the wrapper shut down when all servers have been shut down intentionally
  servers:{}
}
settings = getSettings(); // This will grab the settings from the settings.json file if it exists, creating a new one from the above settings if not.
global["settingsFilePath"]=settingsFilePath;
global["settings"]=settings;
global["writeSettings"]=writeSettings; // This will write the main settings.json file
global["getSettings"]=getSettings; // This will ensure the settings.json file exists, returning the settings object.
global["servers"]={};
global["getServerObj"]=getServerObj; // This is used by mods to get the serverObj that they are a part of
global["getServerPath"]=getServerPath;
var starNetJarURL             = "http://files.star-made.org/StarNet.jar";
var starNetJar                = path.join(binFolder,"StarNet.jar");

var forceStart                = false; // Having this set to true will make the script kill any existing scripts and servers and then start without asking the user.
var ignoreLockFile            = false; // If this is set to true, it will skip checking if previous PID's are running and start without killing them.  WARNING:  If any servers are running in the background, this will duplicate trying to run the server, which will fail because an existing server might already be running.
var debug                     = false; // This enables debug messages
var os                        = process.platform;

global["log"] = log;

var starMadeStarter;
// TODO: Fix this to use the .exe file properly when doing installs.  Sure the Jar works, but might be a bad idea for some reason.
// Note that I SHOULD be able to re-enable this, but I need to ensure the starMadeStarter is not ran directly anywhere and instead uses the helper function, "smartSpawnSync" from miscHelpers.js
// if (os=="win32"){
//   starMadeStarter="StarMade-Starter.exe";
// } else {
  starMadeStarter="StarMade-Starter.jar"; // This handles linux and macOSX
// }
global["starMadeInstallerFilePath"]=path.join(binFolder,starMadeStarter);

var starMadeInstallerURL  = "http://files.star-made.org/" + starMadeStarter;
// Windows: http://files.star-made.org/StarMade-starter.exe // Does not seem to actually work correctly with spawnSync and the -nogui option on windows.. Using the linux/macOSX jar installer does though!  wtf!
// macosx: http://files.star-made.org/StarMade-Starter.jar
// Linux: http://files.star-made.org/StarMade-Starter.jar

// TODO:  INCOMPLETE - Implement the console outputs for MAIN, server 1, server 2, etc., then set up recording on the main screen here.
var recording=false;
var recordingArray=[];
var recordFileName="record";
var recordingCounter=1;
var recordingFile=getRecordFileName();
function getRecordFileName(){
  if (miscHelpers.isSeen(recordingFile)){
    recordingCounter++;
    recordingFile=path.join(__dirname,recordFileName + recordingCounter + ".log");
    return getRecordFileName();
  } else {
    return path.join(__dirname,recordFileName + recordingCounter + ".log");
  }
}
function dumpToRecordFile(options,cb){
  if (typeof cb=="function"){
    var stringToWrite=recordingArray.join("\n");
    recordingArray=[];
    return fs.writeFile(getRecordFileName(),stringToWrite,cb);
  }
  return simplePromisifyIt(dumpToRecordFile,options);
}


log("starmade.js launched.");


// ##############################
// ### Command Line Arguments ###  -- Temporary solution is to prevent this script from running if lock file exists
// ##############################
if (process.argv[2]){
  // Some command line argument was given
  var argumentsPassed=process.argv.slice(2);
  var argumentRoot;
  var argumentEqual;
  var argumentEqualLowerCase;
  for (let i=0;i<argumentsPassed.length;i++){
    // Set up each argument to grab before = and after =, so arguments can be given specific values.
    argumentRoot=toStringIfPossible(argumentsPassed[i].match(/^-[a-zA-Z]*/));
    if (typeof argumentRoot=="string"){
      argumentRoot=argumentRoot.toLowerCase();
      // console.log("Test result: " + argumentsPassed[i].indexOf("="));
      if (argumentsPassed[i].indexOf("=") == -1){
        argumentEqual      = null;
        argumentEqualLowerCase = null;
      } else {
        argumentEqual      = argumentsPassed[i].match(/[^=]*$/).toString();
        argumentEqualLowerCase = argumentEqual.toLowerCase();
      }
      if (argumentRoot == "-help"){
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

      } else if  (argumentRoot == "-forcestart"){
        if (argumentEqualLowerCase == "true" || !argumentEqualLowerCase){
          forceStart = true;
        } else if (argumentEqualLowerCase == "false"){
          forceStart = false;
        } else {
          console.log("Invalid setting for forceStart attempted.  Must be 'true' or 'false'!  Ignoring argument!")
        }
        console.log("Set 'forceStart' to " + forceStart + ".");
  
      } else if (argumentRoot=="-ignorelockfile"){
        console.log("Setting ignoreLockFile to true.");
        ignoreLockFile=true;
  
      } else if (argumentRoot=="-debug"){
        console.log("Turning debug messages on!");
        debug=true;
      } else {
        console.error("Error:  Unrecognized argument, '" + argumentsPassed[i] + "'!  Ignoring it and moving on!");
        log("StartupError:  Unrecognized argument, '" + argumentsPassed[i] + "'!  Ignoring it and moving on!")
      }
    } else {
      log("StartupError:  Invalid argument, '" + argumentsPassed[i] + "'!  Arguments must be preceded by a '-' character!  Aborting startup!");
      let theErr=new Error("Invalid argument given.  All arguments should be preceded by a '-' character!  Argument given: " + argumentsPassed[i]);
      throw theErr;
    }
  }
}


// ########################
// ### Smart Lock Check ###
// ########################

// TODO:  Separate the lock check for wrapper to here, and server PID checks in the server obj
if (settings.lockPIDs.length > 0 && ignoreLockFile == false){
  //todo if the lock file exists, we need to grab the PID from the file and see if the server is running.  If not, then we can safely remove the lock file, otherwise end with an error.
  console.log("Existing wrapper PIDs found!");
  var response="";
  console.log("Checking if any of the prior wrapper PIDs are still running..");
  // Checking the main starmade.js process PID - We check this first because we run a treekill on it which will normally also bring down the individual server PID and prevent it from auto-restarting the server on abnormal exit
  var lockPIDs=[];
  if (settings.lockPIDs.length>0){
    lockPIDs=copyArray(settings.lockPIDs);
  }
  for (let i=0;i<lockPIDs.length;i++){
    if (isPidAlive(lockPIDs[i])){
      console.log("Existing starmade.js wrapper process found running on PID, '" + lockPIDs[i] + "'.");
      if (forceStart==true){
        console.log("forceKill flag set!  Auto-killing PID!");
        response= "yes";
      } else {
        response=prompt("If you want to kill it, type 'yes': ").toLowerCase();
      }
      if (response=="yes"){
        console.log("TREE KILLING WITH EXTREME BURNINATION!");
        treeKill(lockPIDs[i], 'SIGTERM');
        // We should initiate a loop giving up to 5 minutes for it to shut down before sending a sig-kill.
        miscHelpers.waitAndThenKill(300000,lockPIDs[i]);
        sleepSync(1000); // Give the sigKILL time to complete if it was necessary.
        settings.lockPIDs=arrayMinus(settings.lockPIDs,lockPIDs[i]); // PID was killed, so remove it from the settings.json file.
      } else {
        console.log("Alrighty, I'll just let it run then.");
      }
    } else {
      console.log("Prior starmade.js wrapper PID (" + lockPIDs[i] + ") not running. Cool.");
      settings.lockPIDs=arrayMinus(settings.lockPIDs,lockPIDs[i]); // PID wasn't alive, so remove it from the settings.json file.
    }
  }
  console.log("");
  if (settings.lockPIDs.length > 0){
    // We never want to start the wrapper if any of the PIDs are still alive, unless the person started with the argument to ignore the lock file
    console.log("\nDANGER WILL ROBINSON!  There are still " + settings.lockPIDs.length + " processes still running!");
    console.log("We cannot continue while an existing wrapper might still be running!  Exiting!");
    console.log("NOTE: If you are 100% SURE that these the PIDs from the lock file are NOT from another starmade.js script or StarMade servers, you can restart this script with '-ignorelockfile' to ignore the old lock file and create a new one.");
    console.log("NOTE2: If you want to start this script auto-killing any old PID's, you can use the -forceStart argument.");
    process.exit(1);

  }
} else if (settings.lockPIDs.length > 0){
  // The server was ran with -ignorelockfile, so let's create a backup of the current settings.json file and delete the PIDs in the current one.
  var backupFileName=path.join(mainFolder,path.basename(settingsFilePath) + ".bak");
  writeJSONFileSync(backupFileName,settings);
  settings.lockPIDs=[];
}
writeSettings(); 



// #########################
// ###    SERVER START   ###
// #########################
function setupNewServer(){
  console.log("\nWhat StarMade installation folder should we use?");
  var serverFolder;
  console.log("By default, 'starmade' in the same folder as starmade.js is used. (recommended)");
  while (typeof serverFolder == "undefined" || !serverFolder){
    serverFolder=testStarMadeDirValue(prompt(": "));
  }
  console.log("Install Folder set to: " + serverFolder);
  // @ts-ignore
  if (!fs.existsSync(serverFolder)){
    console.log("\nThe StarMade Install folder does not exist!");
    if (prompt("Press [ENTER] to create the folder.")){
      console.log("Something else was typed!  Abort ABORT!");
      process.exit(130);
    }
    try {
      if (miscHelpers.ensureFolderExists(serverFolder) != true) {
        throw new Error("Folder could not be created: " + serverFolder);
      }
      console.log("Successfully created directory: " + serverFolder);
    } catch (err) {
      console.error("Please run this script again and choose a different install directory to use!");
      throw err;
    }
  }
  global["settings"]["servers"][serverFolder]={starMadeFolder:serverFolder}; // This is just a bare bones directory of where to put the mods.

}

eventEmitter.on('ready', function() {
  // Check to see if any server has been set up yet in settings, if not, get the install path before loading the mods.
  // The mods should handle setting up the rest of the settings, installing, and starting
  if (Object.keys(global["settings"].servers).length < 1){
    console.log("No server has been set up before!  Let's set one up!");

  }

  try { // This is to catch an error if spawn cannot start the java process
    console.log("############## Loading Mods ###############");
    loadServerMods(); //  This loads in the mods.  They are responsible for setting up extra settings, installation, and starting the server.
  } catch (err) { // This does NOT handle errors returned by the spawn process.  This only handles errors actually spawning the process in the first place, such as if we type "javaBlah" instead of "java".  Cannot run "javaBlah" since it doesn't exist.
    console.error("Error when loading mods!");
    throw err;
  }
});

// initialize the objectCreator so it can send text directly to the server through "server".
//  IMPORTANT:  THIS MUST BE DONE BEFORE ANY OBJECTS ARE CREATED!

// The following is obsolete since we're using the global object now, which stores the server.
// console.log("############## INITIALIZING OBJECT CREATOR ###############");
// objectCreator.init(server,global);

// ###################
// #### MODLOADER ####
// ###################
global["serverMods"]={};
function loadServerMods(){ // done: 01-07-20
  var serverFoldersArray=Object.keys(global["settings"].servers);
  for (let e=0;e<serverFoldersArray.length;e++){
    let modsFolder=path.join(serverFoldersArray[e],"mods");
    if (existsAndIsDirectory(modsFolder)){
      var modFolders=getDirectories(modsFolder);
      if (modFolders.length>0){
        global["serverMods"][serverFoldersArray[e]]={};
        var fileList=[];
        for (var i = 0;i < modFolders.length;i++) {
          console.log("Mod Folder found: " + modFolders[i] + " Looking for scripts..");
          fileList=getFiles(modFolders[i]);
          // console.dir(fileList);
          for (var i=0;i<fileList.length;i++){
            if (fileList[i].match(/.\.js$/)) {
              console.log("Loading JS file: " + fileList[i]);
              try{
                global["serverMods"][serverFoldersArray[e]][fileList[i]]=require(fileList[i]);
              } catch (err){
                console.log("Error loading mod: " + fileList[i],err);
                throw err;
              }
            }
          }
        }
      } else {
        console.log("Cannot load any mods. Mods folder contained no mods.  Server Path: " + serverFoldersArray[e]);
      }
    } else {
      console.log("Cannot load any mods. No 'mods' folder found.  Server Path: " + serverFoldersArray[e]);
    }
  }
}
function unloadServerMods(inputPath){  // This cycles through the list of modfiles and deletes their cache
  // if 'inputPath' is specified, it will ONLY unload that specific path.
  if (typeof inputPath != "string" && typeof inputPath != "undefined"){
    throw new Error("Invalid input given to function, 'unloadServerMods'! Expected nothing or a path string! Typeof inputPath: " + typeof inputPath);
  }
  eventEmitter.emit("removeListeners"); // This is for mods that want to use their own event handler for some reason.
  var serverModFoldersArray=Object.keys(global["serverMods"]);
  var loadedModsArray=[];
  var newKeys=[];
  for (let i=0;i<serverModFoldersArray.length;i++){
    loadedModsArray=Object.keys(serverModFoldersArray[i]);
    for (let e=0;e<loadedModsArray.length;e++){
      if ((typeof inputPath == "string" && inputPath == loadedModsArray[e]) || typeof inputPath == "undefined"){
        console.log("Unloading JS file: " + loadedModsArray[e]);
        Reflect.deleteProperty(global["serverMods"][serverModFoldersArray[i]],loadedModsArray[e]); // Delete the individual path entry for this require
        Reflect.deleteProperty(require.cache,require.resolve(loadedModsArray[e])); // Remove the require entirely. Source: http://derpturkey.com/reload-module-with-node-js-require/ with some modification to use reflect.
      }
    }
    newKeys=Object.keys(global["serverMods"][serverModFoldersArray[i]]);
    if (newKeys.length = 0){
      Reflect.deleteProperty(global["serverMods"],serverModFoldersArray[i]); // Delete the entry for this server
    }
  }
}


function testStarMadeDirValue (installDir) {
  if (typeof installDir == "undefined") { return path.join(mainFolder, "starmade"); }
  if (!isInvalidPath(installDir)) { // If the path provided was valid
    let resolvedInstallDir=path.resolve(mainFolder,installDir); // This will resolve from right to left, so if the install dir is a full path, it will not use the main starmade directory as the first part.  Otherwise, it will be relative to the folder starmade.js is in.
    if (fs.existsSync(resolvedInstallDir)){ // If the path exists, check to see if it is a file or named pipe.  IF so, we cannot use it.
      if (fs.statSync(resolvedInstallDir).isFile()) {
        console.log("ERROR: '" + resolvedInstallDir + "' already exists as a filename.  Please choose a different directory path!");
        return false;
      } else if (fs.statSync(resolvedInstallDir).isFIFO()) {
        console.log("ERROR: '" + resolvedInstallDir + "' already exists as a named pipe.  Please choose a different directory path!");
        return false;
      } else {
        return resolvedInstallDir // The path existed and it was not a file or named pipe so we should be able to use it.. unless it's a symlink to a file.. but I figure if someone is using symlinks to a file they should be smart enough to know not to try to use it as their starmade install folder..
      }
    }
    // The path specified was valid, but did not exist, so let's just return it.  The next part of the scripting will then create it if it does not exist, making SURE this is the path intended.
    return resolvedInstallDir;
  }
  // The path was invalid, so throw crap at the person.
  console.log("ERROR: The path you specified is not valid!");
  console.log("Please enter the folder name OR full path to where you want your Server install to be.");
  console.log("Note:  If you simply press enter, we'll create a folder called 'starmade' within the same folder that starmade.js is in. (Recommended!)");
  return false;
}

function reloadServerMods(){ // This function is meant to reload ALL mods.  Specificity is not possible right now.
  console.log("Removing any event listeners registered by mods..");
  unloadServerModListeners(); // I do not think it is possible to specify only removing listeners for a specific mod..
  // console.log("Removing any registered Constructors for mods..");
  // objectCreator.deregAllConstructors(); // This is more for the to-be-created reloadWrapperMods() function
  console.log("Deleting the require cache's for mods..");
  unloadServerMods();
  console.log("Re-requiring the mods..");
  loadServerMods(); // This will load new ones if they exist.
  console.log("Done reloading mods!");
}

function unloadServerModListeners(inputPath){ // Presently there is no way to remove the listener of a specific mod.  I need to see if this is possible.
  for (let i=0;i<eventListenersToRemoveOnReload.length;i++){
    // eventListenersToRemoveOnReload[i] // This is an object with the event name and function
    for(var key in eventListenersToRemoveOnReload[i]) { // This should only run once.
      if (eventListenersToRemoveOnReload[i].hasOwnProperty(key)){ // Only run on non-prototype keys
        console.log("Removing listener: " + key);
        eventEmitter.removeListener(key,eventListenersToRemoveOnReload[i][key]);
      }
    }
  }
  eventListenersToRemoveOnReload=[]; // There should no longer be any events registered by mods.
}



// To allow loading, unloading, and reloading of mods, a mod should probably emit an event to trigger the event here, rather than run it within it's own process.
eventEmitter.on("loadMods", function(){
  loadServerMods();
  eventEmitter.emit("init");
});
eventEmitter.on("unloadMods", function(){
  unloadServerMods();
});
eventEmitter.on("reloadMods", function(){
  reloadServerMods();
  eventEmitter.emit("init");
});


//  No more variables should be added to the globalObject after this, since all the mods will be initialized NOW.  ie. global["whatever"]=whatever;



eventEmitter.emit("init"); // This event happens AFTER all the mods are loaded in through require.  Prerequisites should be done by now.

// #######################################
// ###    COMMAND LINE WRAPPER START   ###
// #######################################
// This will process user input at the console and either direct it to the server process or parse it as a command.


process.stdin.on('data', function(text){
  let theText=text.toString().trim();
  if (theText[0] == "!"){
    let theArguments = theText.split(/ +/); // Split with the + symbol so it splits by any amount of spaces
    let theCommand   = theArguments[0].toLowerCase();
    theArguments.shift();
    let tempArray    = theCommand.split("")
    tempArray.shift();
    theCommand=tempArray.join("");
    // console.log("Wrapper command detected: " + theCommand)
    // console.log("Full: " + theText);

    if (i(theCommand,"help")) {
      console.log("Here are the current console commands:");
      console.log(  "-- Server Commands --")
      console.log(" !status");
      console.log(" !start");
      console.log(" !stop");
      console.log(" !kill");
      console.log(" !forcekill");
      console.log(" ");
      console.log(" -- Wrapper Commands --");
      console.log(" !quit"); // Quits the wrapper, closing any sub-processes.
      console.log(" !stdout [on/off]");
      console.log(" !stderr [on/off]");
      console.log(" !stderrfilter RegExp");
      console.log(" !serverlog [on/off]");
      console.log(" !debug [on/off]"); // Displays debug messages
      console.log(" !enumerateevents [on/off]");
      console.log(" !reloadMods");
      console.log(" !record (stop)");
      console.log(" !showallevents [on/off]");
      console.log(" !listObjectConstructors");
      console.log(" !listObjectConstructorElements [ObjectName(parameters)]");
      console.log(" !listGlobal");
      console.log(" !settings");
      console.log(" !changesetting [setting] [newvalue]");
    } else if (i(theCommand,"reloadmods")) {
      console.log("Reloading mods..");
      eventEmitter.emit("reloadMods");
    } else if (i(theCommand,"listGlobal")) {
      let params;
      console.log("Enumerating elements from the global object:");
      var keyArray=[];
      for (let key in global){
        if (global.hasOwnProperty(key)){
          keyArray.push(key);
        }
      }
      keyArray=keyArray.sort(); // Alphabetize the list
      for (let i=0;i<keyArray.length;i++){
        if (typeof global[keyArray[i]] == "function"){
          params=getParamNames(global[keyArray[i]]);
          if (getParamNames.length > 0){
              console.log(" (" + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i] + "(" + params + ")");
          } else {
            console.log(" (" + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i] + "()");
          }
        } else if (typeof global[keyArray[i]] == "object"){
          if (global[keyArray[i]] instanceof Array){
            console.log(" (Array) \tglobal." + keyArray[i]);
          } else if (global[keyArray[i]] instanceof Map){
            console.log(" (Map " + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i]);
          } else if (global[keyArray[i]] instanceof Date){
            console.log(" (Date " + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i]);
          } else {
              console.log(" (" + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i]);
          }
        } else {
          console.log(" (" + typeof global[keyArray[i]] + ") \tglobal." + keyArray[i]);
        }
      }


      // for (let key in global){
      //   if (global.hasOwnProperty(key)){
      //     if (typeof global[key] == "function"){
      //       params=getParamNames(global[key]);
      //       if (getParamNames.length > 0){
      //           console.log(" (" + typeof global[key] + ") \t" + key + "(" + params + ")");
      //       } else {
      //         console.log(" (" + typeof global[key] + ") \t" + key + "()");
      //       }
      //     } else {
      //       console.log(" (" + typeof global[key] + ") \t" + key);
      //     }
      //   }
      // }
      console.log( " ");

    } else if (i(theCommand,"listObjectConstructors")) {
      let keyArray;
      let keyUpperCase;
      console.log("Listing constructor objects:");
      let outputArray=[];
      for (let key in objectCreator){
        if (objectCreator.hasOwnProperty(key)){
          keyArray=key.split("");
          keyUpperCase=keyArray[0].toUpperCase();
          if (keyUpperCase === keyArray[0]){
            outputArray.push(key + "(" + getParamNames(objectCreator[key]) + ")");
            // console.log(" - " + key + "(" + getParamNames(objectCreator[key]) + ")");
          }
        }
      }
      outputArray=outputArray.sort(); // alphabetize the list
      for (let i=0;i<outputArray.length;i++){
        console.log(" - " + outputArray[i]);
      }
      console.log( " ");
    } else if (i(theCommand,"listObjectConstructorElements")) {
      // This needs an example object to be created, so it will expect input to create an example object to then test
      // example:  PlayerObj("Test");

      if (testIfInput(theArguments[0])){
        var input=theArguments[0].replace(/"/g,"'");
        var objName=toStringIfPossible(input.match(/^[^(]+/));
        if (typeof objName == "string"){
          var objArguments=toStringIfPossible(input.match(/(?<=\()[^(^)]+(?=\))/));
          if (typeof objArguments == "string"){
            var objArgumentsArray=objArguments.replace(/'/g,"").split(",");
            // console.log("objArgumentsArray: " + objArgumentsArray);
            var paramNamesArray=getParamNames(objectCreator[objName]);
            var paramNames=paramNamesArray.join(",");
            // console.log("paramNames: " + paramNames);
            // console.log("typeof paramNames: " + typeof paramNames);
            // console.log("paramNamesArray:" + paramNamesArray);
            if (objArgumentsArray.length == paramNamesArray.length){
              if (objectCreator.hasOwnProperty(objName)){
                console.log("Listing the elements for: " + objName + "(" + paramNames + ")");
                let valid=false;
                try {
                  var dummyObj=new objectCreator[objName](...objArgumentsArray);
                  valid=true;
                } catch (err){
                  console.log("ERROR:  Invalid input given to constructor object!  Please provide the correct input.");
                  console.dir(err);
                }
                // console.log("Listing methods for: " + theArguments[0]);
                if (valid){
                  var theArray=listObjectMethods(dummyObj);
                  theArray=theArray.sort(); // alphabetize the list
                  for (let i=0;i<theArray.length;i++){
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
    } else if (i(theCommand,"quit")) {
        console.log("Exiting wrapper..");
        process.exit();
    } else if (i(theCommand,"status")) {
      if (global["server"].spawn){
        console.log("Server status: " + global["server"].spawnStatus);
        if (global["server"].spawn.hasOwnProperty("pid")){
          console.log("Stored PID:" + global["server"].spawn.pid);
        } else {
          console.log("No 'pid' element found on spawn object.");
        }

        if (global["server"].spawn.hasOwnProperty("killed")){
          console.log("Process killed status:" + global["server"].spawn.killed);
        } else {
          console.log("No 'killed' element found on spawn object.");
        }
        if (global["server"].spawn.hasOwnProperty("pid")){
          console.log("Is pid alive?: " + isPidAlive(global["server"].spawn.pid));
        } else {
          console.log("No PID found associated with spawn.");
        }
        
      } else {
        console.log("Server does not appear to be running!");
      }
    } else if (i(theCommand,"start")) {
        console.log("Starting server..");
        global["server"].start();
    } else if (i(theCommand,"stop")) {
      if (global["server"].spawn){
        console.log("Initiating server shutdown..");
        let theTime=theArguments.shift();
        let theArgumentsToUse=theArguments.join(" ");
        return global["server"].stop(theTime,theArgumentsToUse);
      } else {
        console.error("ERROR: Cannot stop server. Server does not appear to be running!");
        return false;
      }
    } else if (i(theCommand,"kill")) {
      if (global["server"].spawn){
        console.log("Initiating server kill (SIGTERM)..");
        return global["server"].kill();
      } else {
        console.error("ERROR: Cannot kill server! Server does not appear to be running!");
        return false;
      }
    } else if (i(theCommand,"forcekill")) {
      if (global["server"].spawn){
        console.log("Initiating server kill (SIGKILL)..");
        return global["server"].forcekill();
      } else {
        console.error("ERROR: Cannot kill server! Server does not appear to be running!");
        return false;
      }

    } else if (i(theCommand,"record")) {
      if (!theArguments[0] || i(theArguments[0],"start")){
        if (recording){
          console.log("Already recording!  Please stop the current recording to start a new one!  To stop recording, type: !record stop");
        } else {
          console.log("Starting to record outputs..  To dump to file (" + getRecordFileName() + "), type !record stop");
          recording=true;
        }
      } else if (i(theArguments[0],"stop")){
        if (recording){
          console.log("Stopping and saving recording to file..");
          recording=false;
          return dumpToRecordFile("",function(err){
            if (err){
              console.log("Error writing recording to file: " + recordingFile);
              console.dir(err);
            }
            console.log("SUCCESS:  Finished writing to record file: " + recordingFile);
          });
        } else {
          console.log("No recording is happening!  To start recording server output, please type:  !record");
        }
      } else {
        console.log("Invalid argument given to !record command.")
      }

    } else if (i(theCommand,"stdout")) {
      if (i(theArguments[0],"on")){
        console.log("Setting stdout to true!");
        showStdout=true;
      } else if (i(theArguments[0],"off")){
        console.log("Setting showStdout to false!");
        showStdout=false;
      } else {
        console.log("Invalid parameter.  Usage:  !stdout on/off")
      }
    } else if (i(theCommand,"stderr")) {
      if (theArguments[0] == "on"){
        console.log("Setting showStderr to true!");
        showStderr=true;
      } else if (i(theArguments[0],"off")){
        console.log("Setting Stderr to false!");
        showStderr=false;
      }
    } else if (i(theCommand,"stderrfilter")) {
      if (testIfInput(theArguments[0])){
        console.log("Finish this..");
      } else {
        console.log("ERROR:  Please specify a filter to use!  Example: \\[SPAWN\\]");
      }

    } else if (i(theCommand,"serverlog")) {
      if (theArguments[0] == "on"){
        console.log("Setting showServerlog to true!");
        showServerlog=true;
      } else if (theArguments[0] == "off"){
        console.log("Setting showServerlog to false!");
        showServerlog=false;
      }

    } else if (i(theCommand,"debug")) {
      if (theArguments[0] == "on"){
        console.log("Setting debug to true!");
        debug=true;
      } else if (i(theArguments[0],"off")){
        console.log("Setting debug to false!");
        debug=false;
      } else {
        console.log("Debug is currently set to: " + debug);
      }


    } else if (i(theCommand,"enumerateevents")) {
      if (theArguments[0] == "on"){
        console.log("Setting enumerateEventArguments to true!");
        enumerateEventArguments=true;
      } else if (theArguments[0] == "off"){
        console.log("Setting enumerateEventArguments to false!");
        enumerateEventArguments=false;
      }
    } else if (i(theCommand,"showallevents")) {
      if (theArguments[0] == "on"){
        console.log("Setting showAllEvents to true!");
        showAllEvents=true;
      } else if (i(theArguments[0],"off")){
        console.log("Setting showAllEvents to false!");
        showAllEvents=false;
      }
    // Settings will be specific to server, so these next few commands are now defunct
    // } else if (i(theCommand,"settings")) {
    //   if (!theArguments[0]){
    //     // const copy = Object.create(Object.getPrototypeOf(settings));
    //     console.log("\nHere are your current settings:")
    //     const propNames = Object.getOwnPropertyNames(settings);
    //     propNames.forEach(function(name){
    //       // console.log("Setting: " + name + " Value: " + Object.getOwnPropertyDescriptor(settings, name));
    //       if (name != "smTermsAgreedTo"){ console.log(" " + name + ": " + settings[name]); }
    //     });
    //     console.log("\nIf you would like to change a setting, try !changesetting [SettingName] [NewValue]");
    //   }
    // } else if (i(theCommand,"changesetting")) {
    //   var usageMsg="Usage: !changeSetting [Property] [NewValue]";
    //   if (theArguments[0]){
    //     // console.log("Result of checking hasOwnProperty with " + theArguments[0] + ": " + settings.hasOwnProperty(theArguments[0]));
    //     if (settings.hasOwnProperty(theArguments[0])){
    //       let oldSettings=miscHelpers.copyObj(settings);
    //       let settingNameToChange=theArguments.shift();
    //       let newSetting=theArguments.join(" ");
    //       if (newSetting){
    //         console.log("\nChanged setting from: " + oldSettings[settingNameToChange]);
    //         settings[settingNameToChange]=newSetting;
    //         console.log("Changed setting to: " + settings[settingNameToChange]);
    //         console.log("Settings update will take effect next time the server is restarted.")
    //         writeSettings();
    //       } else {
    //         console.log("ERROR: You need to specify WHAT you wish to change the setting, '', to!");
    //         console.log(usageMsg);
    //       }
    //     } else {
    //       console.log("ERROR:  Cannot change setting, '" + theArguments[0] + "'! No such setting: ");
    //     }
    //   } else {
    //     console.log("ERROR:  Please provide a setting to change!");
    //     console.log(usageMsg);
    //   }
    // } else if (testIfInput(theCommand)){
    //   console.log("ERROR: '" + theCommand + "' is not a valid command!  For a list of wrapper console commands, type: !help");
    }
  } else if (testIfInput(theText)){
    // if (global["server"].spawnStatus == "started"){
    //   console.log("Sending text to console: " + theText);
    //   global["server"].spawn.stdin.write(theText + "\n");
    console.log("Sending text is disabled till the console system is built.");
    // TODO: Build the console system.
    } else {
      console.error("ERROR: Server does not appear to be running.  Cannot send text to console!");
    }
    
    // global["server"].spawn.stdin.write(text.toString() + "\n");
    // global["server"].spawn.stdin.end();
  } // If blank, don't do anything.
  return true; // This does nothing except to make ESLint happy.
});

// This is great to have all the info show on the screen, but how does one turn off a pipe? No idea.  I'll use events instead.
// global["server"].spawn.stdout.pipe(process.stdout);
// global["server"].spawn.stderr.pipe(process.stdout);

// var stdinStream = new stream.Readable();


// #####################
// ###   EMITTERS   ####
// #####################
eventEmitter.on('asyncDone', installDepsSync);

// ####################
// ###  FUNCTIONS  #### -- The standard practice for functions is first write in place, then make a multi-purpose function that handles what you need and can be used elsewhere, then bundle it in a require and change over functionality.  This is to keep the main script at a maintainable length and also have high re-usability value for code created.
// ####################

// function getNextServerID(){
//   var returnID=1;
//   for (let i=0;installTrackerFile.length>0;i++){
//     if (installTrackerFile[i].hasOwnProperty("id")){
//       if (typeof installTrackerFile[i].id == "number"){
//         if (installTrackerFile[i].id>returnID){
//           returnID=installTrackerFile[i].id + 1;
//         }
//       }
//     }
//   }
//   return returnID; // Returns 1 if no other servers were previously registered
// }

// function regInstall(serverObj){
//   var trackerObj={
//     "ID":serverObj.settingsFile["ID"],
//     "autoRun":serverObj.settingsFile["autoStart"],
//     "pathToInstall":serverObj.settingsFile["starMadeFolder"],
//     "server":serverObj
//   };
//   var placed=false;
//   for (let i=0;i<installTrackerFile.length;i++){
//     if (installTrackerFile[i].hasOwnProperty("ID")){
//       if (installTrackerFile[i]["ID"] == serverObj.settingsFile["ID"]){
//         installTrackerFile[i]=trackerObj;
//         placed=true;
//       }
//     }
//   }
//   if (placed == false){
//     installTrackerFile.push(trackerObj);
//   }
//   writeInstallTrackerFile("",function(err){
//     if (err){
//       throw err;
//     }
//     console.log("Tracker file updated with new server ID: " + serverObj.settingsFile["ID"]);
//   });
// }

// function getInstallTrackerFile(options,cb){
//   if (typeof cb == "function"){
//     if (existsAndIsFile(installTrackerFilePath)){
//       return fs.readFile(installTrackerFilePath,'utf8',function(err,result){
//         if (err){
//           return cb(err,null);
//         }
//         let resultParsed=JSON.parse(result.toString());
//         installTrackerFile=resultParsed;
//         return cb(null,resultParsed);
//       });
//     }
//     return cb(null,null);
//   }
//   return simplePromisifyIt(getInstallTrackerFile,options);
// }

// function writeInstallTrackerFile(options,cb){
//   // This relies on the
//   if (typeof cb == "function"){
//     var contentsToWrite=JSON.stringify(installTrackerFile, null, 4);
//     return fs.writeFile(installTrackerFilePath,contentsToWrite,function(err){
//       if (err){
//         return cb(err,false);
//       }
//       return cb(null,true);
//     });
//   }
//   return simplePromisifyIt(writeInstallTrackerFile,options);
// }

function getServerPath(pathToMod){
  var pathArray=pathToMod.split(path.sep);
  pathArray.pop();
  pathArray.pop();
  var starMadeDir=pathArray.join(path.sep);
  return starMadeDir;
}
function getServerObj(pathToMod){ 
  // This is used for a mod to grab the serverObj of the server it is a part of.
  // Usage:  global.getServer(__dirname);
  // Returns the object to the server for which the mod is a part of.  
  // If the server has not been registered to the global variable, it will return null
  var starMadeDir=getServerPath(pathToMod);
  if (global["servers"].hasOwnProperty(starMadeDir)){
    return global["servers"][starMadeDir];
  }
  return null;
}

function writeSettings() {
  var settingsFileName=path.basename(settingsFilePath);
  try {
    // var settingsFileStream=fs.createWriteStream(settingsFilePath); // Why use a stream?
    // settingsFileStream.write(JSON.stringify(settings, null, 4));
    // settingsFileStream.end();
    writeJSONFileSync(settingsFilePath,settings);
    console.log("Updated '" + settingsFileName + "' file.");
    log("Updated '" + settingsFileName + "' file.");
  } catch (err) {
    console.error("ERROR: Could not write to the '" + settingsFileName + "' file!");
    log("ERROR: Could not write to the '" + settingsFileName + "' file!");
    throw err;
  }
}
function getSettings(){ // Be careful with this, as this can really screw up the settings file if a save didn't occur after changes!
  if (existsAndIsFile(settingsFilePath)){
    var theSettings = getJSONFileSync(settingsFilePath);
  } else {
    console.log("No settings.json file existed, creating a new one!");
    writeJSONFileSync(settingsFilePath,settings);  // settings.json file has not been created, so let's create it.  This assumes the defaults have already been set at the top of this script.
    return settings; // This assumes default settings had been set up by this script.
  }
  return theSettings;
}


var operationMessages=[]; // This is unused for now, but it can be used to see the operations that completed and their order if they were named.
function asyncOperation(val){ // This controls when the start operation occurs.  All file reads, downloads, installs, etc, must be completed before this will trigger the "ready" event.
  // console.log("operations ongoing: " + operations + " Command given: " + val);
  var operationMessage=".";
  if (arguments[1]){
    operationMessage=": " + arguments[1];
  }
  if (val == "start"){ // Start is used when an asyncronous operation starts and end should be used when it's finished.
    operations++;
    // console.log("Operation started" + operationMessage);
  } else if (val == "end"){
    // console.log("Operation ended" + operationMessage);
    operationMessages.push("Operation ended" + operationMessage);
    if (operations>1){
      operations--;
    } else {
      console.log("Async operations finished.");
      eventEmitter.emit('asyncDone');
    }
  }
}

function preDownload(httpURL,fileToPlace){ // This function handles the pre-downloading of files, such as StarNet.jar.  When all downloads are finished, the StarMade server is started by emitting the event signal, "ready".
  // Code adapted from: https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
  asyncOperation("start","preDownload: " + fileToPlace);
  let tempFileToPlace=path.resolve(mainFolder,fileToPlace + ".tmp");
  miscHelpers.deleteFile(tempFileToPlace,{"quiet":true});
  let resolvedFileToPlace=path.resolve(mainFolder,fileToPlace);
  let baseFileToPlace=path.basename(resolvedFileToPlace);
  let baseDirForFile=path.dirname(resolvedFileToPlace);

  // Check to see if the file already exists or not.  If it does exist, then we can end this operation.
  // fs.accessSync(resolvedFileToPlace),fs.constants.F_OK); // Supposed to check if the file can be seen but it was not working for me for some reason.
  if (fs.existsSync(resolvedFileToPlace)) { // We can see that a file, directory, or symlink exists at the target path
    if (fs.statSync(resolvedFileToPlace).isFile()){
      // console.log("'" + baseFileToPlace + "' existed.  Good!"); // File already exists, nothing to do.
      asyncOperation("end","preDownload: " + fileToPlace);
      return true;
    } else if (fs.statSync(resolvedFileToPlace).isDirectory()){
      throw new Error("ERROR: Cannot pre-download file: " + resolvedFileToPlace + "\nDirectory already exists with the name!  Please remove this directory and run this script again!");
    } else {
      throw new Error("ERROR: Cannot pre-download file: " + resolvedFileToPlace + "\nPath already exists with the name!  Please rectify this and then run this script again!");
    }
  } else { // If the file does not exist, let's download it.
    console.log("Downloading '" + baseFileToPlace + "' from: " + httpURL);
    miscHelpers.ensureFolderExists(baseDirForFile); // ensure the directory the file needs to be placed in exists before trying to write to the file.
    var file = fs.createWriteStream(tempFileToPlace); // Open up a write stream to the temporary file.  We are using a temporary file to ensure the file will only exist at the target IF the download is a success and the file write finishes.
    try {
      var request = http.get(httpURL, function(response) {
        // console.log("Status Code: " + response.statusCode);
        // When the file is downloaded with the "http.get" method, it returns an object from which you can get the HTTP status code.
        // 200 means it was successfully downloaded, anything else is a failure.  Such as 404.
        if (response.statusCode == 200){
          response.pipe(file);
        } else {
          console.error("Error downloading file, '" + baseFileToPlace + "'!  HTTP Code: " + response.statusCode);
          process.exitCode=5;
          throw new Error("Response from HTTP server: " + response.statusMessage);
        };
      });
      request.on('error', (e) => {
        process.exitCode=4;
        throw new Error(`problem with request: ${e.message}`);
      });
    } catch (err) { // If there was any trouble connecting to the server, then hopefully this will catch those errors and exit the wrapper.
      console.log("ERROR:  Failed to download, '" + httpURL + "'!");
      process.exitCode=4;
      throw err;
    }
    file.on('finish', function() {
      file.close();
      fs.rename(tempFileToPlace, resolvedFileToPlace, (err) => {
        if (err) { throw err; }
        console.log("'" + baseFileToPlace + "' downloaded successfully! :D");
        asyncOperation("end","preDownload: " + fileToPlace); // We're using a function to keep track of all ongoing operations and only triggering the start event when all are complete.  So let's complete this operation.
      });
    });
  }
  return true;
}

function i(input,input2){ // I use this to do easy case insensitive matching for commands since javascript is case sensitive
  if (typeof input == "string" && typeof input2 == "string"){
      return input.toLowerCase() === input2.toLowerCase();
  } else {
      return false;
  }
}


// ##########################################
// ###  MAIN SCRIPT EXIT  - GLOBAL SCOPE ####
// ##########################################

exitHook(() => { // This will handle sigint and sigterm exits, errors, and everything.
  // Cleanup that needs to be done on the global scope should be done here.
  console.log("Global Exit event running using exitHook require..");
});

// ##############################
// ### CREATE NEEDED FOLDERS  ###
// ##############################


// ###################################
// ### DEPENDENCIES AND DOWNLOADS  ###
// ###################################
// Check for dependencies, such as StarNet.jar and download/install if needed.
// When all dependency downloads/installs are finished, start the server!
console.log("Ensuring all dependencies are downloaded or installed..");

// ### Async downloads/installs that have no dependencies ### -- This sub-section is for all installs/downloads that can be done asynchronously to occur as quickly as possible.
asyncOperation("start"); // This prevents the first async function from starting the wrapper if it finishes before the next one starts.
preDownload(starNetJarURL,starNetJar); // This function handles the asyncronous downloads and starts the sync event when finished.
preDownload(starMadeInstallerURL,global["starMadeInstallerFilePath"]); // When setting the install path for StarMade, we should have handled the terms and conditions, so it should be ok to download it.
asyncOperation("end");


// ### Sync downloads/installs ### -- When async installs/downloads are finished, this function will be called.
async function installDepsSync() {
  // ### Only syncronous installs here ### e.g. await installRoutine();
  // None right now
  console.log("About to start server..");
  // ### Unimportant Async downloads/installs ### -- These should not be required by the server to run, but they may have depended on the first async install or sync installs before they could be run.
  // None right now
  eventEmitter.emit('ready'); // Signal ready to load the mods.  Mods are responsible for starting the server.
}
