// @ts-check

// TODO:  Create separate patterns for stderr, stdout, and tailing serverlog.0.txt
// TODO:  Finish the blueprint loading scripting and finalize how I want it to export.  I am thinking a custom object could be used, a modified entity object, or just a regular entity object (though this would not be very efficient since it wouldn't utilize some of the data available).

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
// var global={ }; // This will be used to pass variables to mods to be readily available
// var commands={ }; // This is offloaded to the commands.js default mod now.
var mainFolder      = path.dirname(require.main.filename); // This is where the starmade.js is.  I use this method instead of __filename because starmade.js might load itself or be started from another script
var binFolder       = path.join(mainFolder,"bin");
var modsFolder       = path.join(mainFolder,"mods");
// global["commands"]=commands; // Offloading this to the default mod commands.js
global["mainFolder"]=mainFolder;
global["binFolder"]=binFolder;
global["modsFolder"]=modsFolder;
var operations      = 0;
var serversRunning  = 0; // This is to count the server's running to manage the exit function and kill them when this main script dies.
var lockFileObj = { // This will be used for the lock file, so if another instance of the script runs, it can parse the file and check PIDs, making decisions on what to do.
  "mainPID": process.pid,
  "serverSpawnPIDs": []
}
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
console.log("setSettings..");
const setSettings       = requireBin("setSettings.js"); // This will confirm the settings.json file is created and the install folder is set up.
var settings            = setSettings(); // Import settings, including the starmade folder, min and max java settings, etc.  If the settings.json file does not exist, it will set it up.
global["miscHelpers"]=miscHelpers;
global["requireBin"]=requireBin;
global["settings"]=settings;

console.log("Loading Objects..");
const objectCreator     = requireBin("objectCreator.js");
const installAndRequire = requireBin("installAndRequire.js"); // This is used to install missing NPM modules and then require them without messing up the require cache with modules not found (which blocks requiring them till an app restart).
const sleepSync             = requireBin("mySleep.js").softSleep; // Only accurate for 100ms or higher wait times.
const sleepPromise = requireBin("mySleep.js").sleepPromise;
const patterns          = requireBin("patterns.js"); // Import the patterns that will be used to match to in-game events like deaths and messages.
var starNet           = requireBin("starNet.js"); // Performs sql queries and gets back a string result if successful
var starNetHelper       = requireBin("starNetHelper.js"); // needs testing
const sqlQuery          = requireBin("sqlQuery.js"); // Will be eliminating this in favor of creating SqlQuery objects.
const ini               = requireBin("iniHelper.js"); // This will replace the current functionality of ini by wrapping it and modifying the ini package so that it works correctly for starmade config files and ini files that use # characters.
const objectHelper      = requireBin("objectHelper.js"); // This includes assistance handling of custom objects and conversions
const regExpHelper      = requireBin("regExpHelper.js"); // Contains common patterns, arrays, and pattern functions needed for the wrapper.
const smInstallHelpers = requireBin("smInstallHelpers.js");
global["starNet"]=starNet; // not used here, but good to have on the global
global["starNetHelper"]=starNetHelper; // not used here, but good to have on the global
global["objectCreator"]=objectCreator;
global["installAndRequire"]=installAndRequire;
global["sleep"]=sleepPromise;
global["sleepSync"]=sleepSync;
global["sqlQuery"]=sqlQuery.simpleSqlQuery;
global["ini"]=ini;
global["objectHelper"]=objectHelper;
global["regExpHelper"]=regExpHelper;

// #################################
// ### NPM DOWNLOADABLE REQUIRES ###
// #################################
console.log("Importing NPM requires, installing if need be..");
const treeKill        = installAndRequire('tree-kill',"^1.2.1"); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes
// const iniPackage      = installAndRequire('ini'); // https://www.npmjs.com/package/ini Imports ini files as objects.  It's a bit wonky with # style comments (in that it removes them and all text that follows) and leaves // type comments, so I created some scripting to modify how it loads ini files and also created some functions to handle comments.
const prompt          = installAndRequire("prompt-sync","^4.1.7")({"sigint":true}); // https://www.npmjs.com/package/prompt-sync This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
var Tail            = installAndRequire('tail',"^2.0.3").Tail; // https://github.com/lucagrulla/node-tail/blob/master/README.md For following the server log.  I forgot that the console output does NOT have everything.  This is NOT a perfect solution because whenever file rotation occurs, there is a 1 second gap in coverage.  Argh.
const exitHook        = installAndRequire('exit-hook',"^2.2.0"); // https://github.com/sindresorhus/exit-hook Handles normal shutdowns, sigterm, sigint, and a "message=shutdown" event.  Good for ensuring the server gets shutdown.
const sqlite3 = installAndRequire("sqlite3","^4.1.0").verbose(); // Embedded sql database
const _=installAndRequire("lodash","^4.17.15"); // Useful javascript shortcuts http://zetcode.com/javascript/lodash/
global["treeKill"]=treeKill;
global["prompt"]=prompt;
global["Tail"]=Tail;
global["exitHook"]=exitHook;
global['sqlite3']=sqlite3;
global['_']=_;


// ### Set up submodules and aliases from requires.


// Customize the eventEmitter to record listeners as they are registered so these can have their caches deleted when mods are unloaded and reloaded.
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

var isPidAlive        = miscHelpers.isPidAlive;
var {isDirectory,getDirectories,isFile,getFiles,log}=miscHelpers;  // Sets up file handling

// Object aliases
var {BotObj,EntityObj,SectorObj,CoordsObj,FactionObj,MessageObj,BlueprintObj,PlayerObj,SMNameObj,ServerObj,regConstructor}=objectCreator;
var {repeatString,isInArray,getRandomAlphaNumericString,arrayMinus,toStringIfPossible,toNumIfPossible,testIfInput,simplePromisifyIt,listObjectMethods,getParamNames}=objectHelper;
var {getUIDfromName,getFactionNumberFromName,getFactionObjFromName}=starNetHelper;
global["regConstructor"]=regConstructor;


// #####################
// ###    SETTINGS   ###
// #####################
var lockFile                  = path.join(mainFolder,"server.lck");
var showStderr                = true; // Normally this would be true but can be turned to false if testing
var stderrFilter;
var showStdout                = false;
var stdoutFilter;
var showServerlog             = true;
var serverlogFilter;
var showAllEvents             = false;
var enumerateEventArguments   = false;
var pauseBeforeStartingServer = "1"; // Default: 2000 - After any sort of installs, config verifications, etc, how long should we wait before pulling the trigger on the server spawn in ms?
var settingsFile              = path.join(mainFolder, "settings.json");
console.log("Importing settings..");
var starNetJarURL             = "http://files.star-made.org/StarNet.jar";
var starMadeInstallFolder     = path.join(settings["starMadeFolder"],"StarMade");
var starMadeJar               = path.join(starMadeInstallFolder,"StarMade.jar");
var logFolder                 = path.join(starMadeInstallFolder,"logs"); // This is added because we have to parse the serverlog.0.log file for ship spawns
var serverLogFile             = path.join(logFolder,"serverlog.0.log");
var powershellPID; // This is necessary for windows because the javascript tail will not work correctly otherwise.  TODO: See if I can use a stream with powershell instead of tail.
var starNetJar                = path.join(binFolder,"StarNet.jar");
var starMadeServerConfigFile  = path.join(starMadeInstallFolder,"server.cfg");
var serverCfg                 = {}; // I'm declaring an empty array here initially because we don't want to try and load it till we are sure the install has been completed
var forceStart                = false; // Having this set to true will make the script kill any existing scripts and servers and then start without asking the user.
var ignoreLockFile            = false; // If this is set to true, it will behave as though the lock file does not exist, and will replace it when it starts again.  WARNING:  If any servers are running in the background, this will duplicate trying to run the server, which will fail because an existing server might already be running.
var debug                     = false; // This enables debug messages
var os                        = process.platform;
global["starMadeInstallFolder"]=starMadeInstallFolder;
global["starMadeServerConfigFile"]=starMadeServerConfigFile;
// global["debug"]=debug;
const botObj=new BotObj(settings["botName"]);
console.log("Created bot object:");
// console.dir(botObj);
global["bot"] = botObj;
global["log"] = log;




var starMadeStarter;
// TODO: Fix this to use the .exe file properly when doing installs.  Sure the Jar works, but might be a bad idea for some reason.
// Note that I SHOULD be able to re-enable this, but I need to ensure the starMadeStarter is not ran directly anywhere and instead uses the helper function, "smartSpawnSync" from miscHelpers.js
// if (os=="win32"){
//   starMadeStarter="StarMade-Starter.exe";
// } else {
  starMadeStarter="StarMade-Starter.jar"; // This handles linux and macOSX
// }
var starMadeInstallerFile = path.join(binFolder,starMadeStarter);
var starMadeInstallerURL  = "http://files.star-made.org/" + starMadeStarter;
// Windows: http://files.star-made.org/StarMade-starter.exe // Does not seem to actually work correctly with spawnSync and the -nogui option on windows.. Using the linux/macOSX jar installer does though!  wtf!
// macosx: http://files.star-made.org/StarMade-Starter.jar
// Linux: http://files.star-made.org/StarMade-Starter.jar
// Patterns - This will be to detect things like connections, deaths, etc.  I'm pushing to an array so it's easier to add or remove patterns.
// console output
var includePatternRegex = patterns.includes();
var excludePatternRegex = patterns.excludes();
// serverlog.0.log output
var includePatternServerLogRegex = patterns.serverLogIncludes();
var excludePatternServerLogRegex = patterns.serverLogExcluded();


log("starmade.js launched.");


// ##############################
// ### Command Line Arguments ###  -- Temporary solution is to prevent this script from running if lock file exists
// ##############################
if (process.argv[2]){
  // Some command line argument was given
  var argumentsPassed=process.argv.slice(2);
  var argumentRoot;
  var argumentEqual;
  var argumentEqualLower;
  for (let i=0;i<argumentsPassed.length;i++){
    // Set up each argument to grab before = and after =, so arguments can be given specific values.
    argumentRoot=toStringIfPossible(argumentsPassed[i].match(/^-[a-zA-Z]*/));
    if (typeof argumentRoot=="string"){
      argumentRoot=argumentRoot.toLowerCase();
      console.log("Test result: " + argumentsPassed[i].indexOf("="));
      if (argumentsPassed[i].indexOf("=") == -1){
        argumentEqual      = null;
        argumentEqualLower = null;
      } else {
        argumentEqual      = argumentsPassed[i].match(/[^=]*$/).toString();
        argumentEqualLower = argumentEqual.toLowerCase();
      }
      if (argumentRoot == "-forcestart"){
        if (argumentEqualLower == "true" || !argumentEqualLower){
          forceStart = true;
        } else if (argumentEqualLower == "false"){
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
        console.error("Error:  Unrecognized argument, '" + argumentsPassed[i] + "'!  Ignoring!")
      }
    }
  }
}


// ########################
// ### Smart Lock Check ###
// ########################
if (fs.existsSync(lockFile) && ignoreLockFile == false){
  //todo if the lock file exists, we need to grab the PID from the file and see if the server is running.  If not, then we can safely remove the lock file, otherwise end with an error.
  console.log("Existing Lock file found!");
  var response;
  var lockFileContents=fs.readFileSync(lockFile,'utf8').toString(); // Added .toString() to make ESLinter happy since it was saying this was a string when using JSON.parse on it.
  if (typeof lockFileContents == "string"){
    let lockFileContentsTest=lockFileContents.replace(/[\n\r\t ]+/g,"").trim(); // Ignore any return characters, tabs, or spaces
    if (lockFileContentsTest.length > 0){
      console.log("Parsing lock file to determine if server or dependent processes are still running..");
      try {
        var lockFileObject=JSON.parse(lockFileContents);
      } catch (err){
        console.log(`ERROR:  Could not parse lock file (${lockFile})!  Is the file invalid?  If the file is NOT in json format, it cannot be parsed.  Please edit the file and fix it, or otherwise delete the file to start the server!`);
        throw err;
      }
      // Checking the main starmade.js process PID - We check this first because we run a treekill on it which will normally also bring down the individual server PID and prevent it from auto-restarting the server on abnormal exit
      if (lockFileObject.hasOwnProperty("mainPID")){
        if (lockFileObject["mainPID"]){
          // console.log("Main PID found: " + lockFileObject["mainPID"]);
          if (isPidAlive(lockFileObject["mainPID"])){
            console.log("Existing starmade.js process found running on PID, '" + lockFileObject["mainPID"] + "'.");
            if (forceStart==true){
              console.log("forceKill flag set!  Auto-killing PID!");
              response= "yes";
            } else {
              response=prompt("If you want to kill it, type 'yes': ").toLowerCase();
            }
            if (response=="yes"){
              console.log("TREE KILLING WITH EXTREME BURNINATION!");
              treeKill(lockFileObject["mainPID"], 'SIGTERM');
              // We should initiate a loop giving up to 5 minutes for it to shut down before sending a sig-kill.
              miscHelpers.waitAndThenKill(300000,lockFileObject["mainPID"]);
              sleepSync(1000); // Give the sigKILL time to complete if it was necessary.
            } else {
              console.log("Alrighty, I'll just let it run then.");
            }
          } else {
            console.log("Prior starmade.js script not running. Cool.");
          }
        }
      }
      console.log("");
      // Checking the array of potential server that are running.
      if (lockFileObject.hasOwnProperty("serverSpawnPIDs")){
        if (lockFileObject.hasOwnProperty("serverSpawnPIDs")){
          var serverPIDS=lockFileObject["serverSpawnPIDs"];
          for (let i=0;i<serverPIDS.length;i++){
            if (isPidAlive(serverPIDS[i])){
              console.log("Running StarMade Server found on PID: " + serverPIDS[i]);
              if (forceStart==true){
                console.log("forceKill flag set!  Auto-killing PID!");
                response= "yes";
              } else {
                response=prompt("If you want to kill it, type 'yes': ").toLowerCase();
              }
              if (response == "yes"){
                console.log("KILLING IT WITH FIRE! (SIGTERM)")
                process.kill(serverPIDS[i],'SIGTERM');
                miscHelpers.waitAndThenKill(300,serverPIDS[i]);
                sleepSync(1000); // Giving the SIGKILL time to complete.
                // We should initiate a loop giving up to 5 minutes for it to shut down before sending a sig-kill.
              } else {
                console.log("Alrighty then, I'll just let it keep running.")
              }
            } else {
              console.log("Verified that server PID, '" + serverPIDS[i] + "' was not running!");
            }
          }
        }
      } else {
        console.log("No server PID's found.  Continuing..");
      }
      if (countActiveLockFilePids(lockFileObject) > 0){ // This should always be 0 after a -forceStart
        console.log("\nDANGER WILL ROBINSON!  There are still " + countActiveLockFilePids(lockFileObject) + " processes still running!");
        console.log("We cannot continue while an existing server might still be running!  Exiting!");
        console.log("NOTE: If you are 100% SURE that these the PIDs from the lock file are NOT from another starmade.js script or StarMade servers, you can restart this script with '-ignorelockfile' to ignore the old lock file and create a new one.");
        console.log("NOTE2: If you want to start this script auto-killing any old PID's, you can use the -forceStart argument.");
        process.exit(1);
      } else {
        // None of the processes from the lock file are still running, so we can just delete the lock file and continue.
        if (fs.existsSync(lockFile)){
          try {
            console.log("Deleting old lock file..");
            fs.unlinkSync(lockFile);
          } catch (err){
            // Every now and then it is POSSIBLE that the first check will show it existing, but when trying to delete it, it won't exist.  So we can just run another check to be 100% sure that this is a bonafide error.
            if (fs.existsSync(lockFile)) {
              console.error("ERROR: Could not delete old lock file!  Please ensure this script has access to delete files from it's own folder!");
              if (err){
                console.error("Error info: " + err);
              }
              throw err;
            }
          }
          console.log("Blamo!");
        } else {
          console.log("server.lck went poof on it's own!  Wonderful! Continuing..");
        }
        sleepSync(200); // Temp
      }
    } else {
      console.log("Lock file was empty. Prior starmade.js script does not appear to be running.  Continuing..");
    }
  } else {
    console.log("Lock file was empty. Prior starmade.js script does not appear to be running.  Continuing..");
  }
} else if (fs.existsSync(lockFile)){
  console.log("Ignored existing lock file!");
  try {
    var lockBackupFile=path.join(lockFile,".bak");
    if (fs.existsSync(lockBackupFile)){ // If a backup of the lock file already exists, remove it
      fs.unlinkSync(lockBackupFile);
    }
    fs.renameSync(lockFile,lockBackupFile);
    console.log("Moved server.lck to server.lck.bak!");
  } catch (err) {
    console.error("ERROR:  There was a problem renaming the server.lck file to server.lck.bak!");
    throw err; // This should only ever happen if a directory was created called server.lck.bak or if the person doesn't have delete rights on the folder..
  }
}


// #########################
// ###    SERVER START   ###
// #########################
eventEmitter.on('ready', function() { // This won't fire off yet, it's just being declared so later on in the script it can be started.  I can modify this later if I want to allow more than one instance to be ran at a time.

  serverCfg = ini.getFileAsObj(starMadeServerConfigFile); // Import the server.cfg values to an object.  These should be the final values.  Any settings changes to the file should be completed before this is loaded.  Note that this KEEPS comments in the value!
  // Use Ini functions from the iniHelperjs to handle the the ini object.  See bottom of the file for the full list.
  if (serverCfg){
    console.log("Server config loaded: " + starMadeServerConfigFile);
    global["serverCfg"]=serverCfg;
  }

  console.log("Starting server..");

  // #####  PLAYER MESSAGES  #####  TODO:  Remove this section since the modloader is working now.

  // temp:  This has been disabled by renaming the event it listens for from 'message' to 'message2'.  It should be handled by a default mod now.



  // todo: Support for JVM arguments on the command line.
  // Build the java arguments, separating by java arguments and arguments passed to StarMade.jar
  var baseJavaArgs=["-Xms" + settings["javaMin"], "-Xmx" + settings["javaMax"],"-jar"]; // This can have -JVM flags added to it later
  var baseJavaArgsWindows=["-Xincgc","-Xshare:off"]; // These will run on windows only
  var baseSMJarArgs=[starMadeJar,"-server", "-port:" + settings["port"]];
  var javaArgs=[];
  if (os == "win32"){
    javaArgs=baseJavaArgs.concat(baseJavaArgsWindows).concat(baseSMJarArgs);
  } else {
    javaArgs=baseJavaArgs.concat(baseSMJarArgs);
  }
  // Taken from https://stackoverflow.com/questions/10232192/exec-display-stdout-live
  // Running the starmade server process
  try { // This is to catch an error if spawn cannot start the java process
    // console.debug("Starting server with arguments: " + javaArgs,2000);

    //  // var server;
    //  // if (os == "win32"){
    //  //   server = spawn("java", ["-Xms" + settings["javaMin"], "-Xmx" + settings["javaMax"],"-Xincgc","-Xshare:off","-jar", starMadeJar,"-server", "-port:" + settings["port"]], {"cwd": starMadeInstallFolder});
    //  // } else {
    //  //   server = spawn("java", ["-Xms" + settings["javaMin"], "-Xmx" + settings["javaMax"],"-jar", starMadeJar,"-server", "-port:" + settings["port"]], {"cwd": starMadeInstallFolder});
    //  // }
    // console.log("starMadeInstallFolder: " + starMadeInstallFolder); // temp
    // global["serverSpawn"] = spawn("java",javaArgs,{"cwd": starMadeInstallFolder});
    // // global["serverSpawn"]=server;
    // var server=global["serverSpawn"];
    // global["server"]=new ServerObj(global["serverSpawn"]);
    console.log("############## Loading Mods ###############");
    loadMods();

    console.log("############## Starting Server ###############");
    global["server"]=new ServerObj(settings); // This object starts the server.
    // global["serverSpawn"]=global["server"].spawn; // temporary, we should reference the server object in the future, to be clear of the source.

  } catch (err) { // This does NOT handle errors returned by the spawn process.  This only handles errors actually spawning the process in the first place, such as if we type "javaBlah" instead of "java".  Cannot run "javaBlah" since it doesn't exist.
    console.error("ERROR: Could not spawn server!")
    if (err.message) { console.error("Error Message: " + err.message.toString()); }
    if (err.code) { console.error("Error Code: " + err.code.toString()); }
    process.exitCode=130;
    throw new Error("Server spawn fail.");
  }

  // initialize the objectCreator so it can send text directly to the server through "server".
  //  IMPORTANT:  THIS MUST BE DONE BEFORE ANY OBJECTS ARE CREATED!

  // The following is obsolete since we're using the global object now, which stores the server.
  // console.log("############## INITIALIZING OBJECT CREATOR ###############");
  // objectCreator.init(server,global);

    // ###################
    // #### MODLOADER ####
    // ###################
    function loadMods(){
      var modFolders=getDirectories(modsFolder)
      global["modFolders"]=modFolders;
      // Testing for loading mods  TODO: Change the way it loads to use a map instead, with each directory name being paired with the require
      // Require all scripts found in mod folders
      var fileList=[];
      var mods=[];
      var modFiles=[];
      for (var i = 0;i < modFolders.length;i++) {
        // console.log("Mod Folder found: " + modFolders[i] + " Looking for scripts..");
        fileList=getFiles(modFolders[i]);
        // console.dir(fileList);
        for (var e=0;e<fileList.length;e++){
          if (fileList[e].match(/.\.js$/)) {
            console.log("Loading JS file: " + fileList[e]);
            modFiles.push(fileList[e]);
            try{
              mods.push(require(fileList[e])); // This will load and run the mod
            } catch (err){
              console.log("Error loading mod: " + fileList[e],err);
              throw err;
            }
          }
        }
      }
      // console.dir(mods);
      global["modFiles"]=modFiles;
      global["mods"]=mods;
    }

    function reloadMods(){ // This function is meant to reload ALL mods.  Specificity is not possible right now.
      console.log("Removing any event listeners registered by mods..");
      unloadModListeners(); // I do not think it is possible to specify only removing listeners for a specific mod..
      console.log("Removing any registered Constructors for mods..");
      objectCreator.deregAllConstructors();
      console.log("Deleting the require cache's for mods..");
      unloadMods();
      console.log("Re-requiring the mods..");
      loadMods(); // This will load new ones if they exist.
      console.log("Done reloading mods!");
    }

    function unloadModListeners(inputPath){ // Presently there is no way to remove the listener of a specific mod.  I need to see if this is possible.
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

    function unloadMods(inputPath){  // This cycles through the list of modfiles and deletes their cache
      // if 'inputPath' is specified, it will ONLY unload that specific path.
      eventEmitter.emit("removeListeners"); // This is for mods that want to use their own event handler for some reason.

      let fileList=global["modFiles"];
      var inputPathToUse;
      if (inputPath){
        inputPathToUse=path.resolve(inputPath);
      }
      for (var e=0;e<fileList.length;e++){
        if (inputPathToUse){
          if (inputPathToUse == fileList[e]){
            console.log("Unloading JS file: " + fileList[e]);
            global["modFiles"]=arrayMinus(global["modFiles"],fileList[e]); // This should work
            global["mods"]=arrayMinus(global["mods"],require(fileList[e])); // I have no idea if this will actually work since it's an array of objects.  Can they be directly compared? // TODO:  This should not work, comparing objects directly cannot work, but since things seem to be working.. I'll leave this be for now.
            // The above might need: require.cache[require.resolve(fileList[e])]
            Reflect.deleteProperty(require.cache,require.resolve(fileList[e])); // Source: http://derpturkey.com/reload-module-with-node-js-require/ with some modification to use reflect.
          }
        } else {
          console.log("Unloading JS file: " + fileList[e]);
          Reflect.deleteProperty(require.cache,require.resolve(fileList[e])); // // Source: http://derpturkey.com/reload-module-with-node-js-require/ with some modification to use reflect.
        }
      }
      if (!inputPathToUse){
        global["modFiles"]=[]; // Only clear the mod file list if it is supposed to be empty.
        global["mods"]=[];
      }
    }

    // To allow loading, unloading, and reloading of mods, a mod should probably emit an event to trigger the event here, rather than run it within it's own process.
    eventEmitter.on("loadMods", function(){
      loadMods();
      eventEmitter.emit("init");
    });
    eventEmitter.on("unloadMods", function(){
      unloadMods();
    });
    eventEmitter.on("reloadMods", function(){
      reloadMods();
      eventEmitter.emit("init");
    });





    //  No more variables should be added to the globalObject after this, since all the mods will be initialized NOW.  ie. global["whatever"]=whatever;


    // Instead of running any "init" function in a mod, we can just have an "init" event..
    // for (i=0;i<mods.length;i++){
    //   if (mods[i].hasOwnProperty("init")){  // Only run the init function for scripts that have it
    //     mods[i].init(eventEmitter,global);
    //   }
    // }
    eventEmitter.emit("init"); // This event happens AFTER all the mods are loaded in through require.  Prerequisites should be done by now.


    //    process.exit();

    //  Temp:  Loads an individual, pre-made test.js
    // var testModFolder=path.join(modsFolder,"testMod");
    //console.log("Loading: " + path.join(testModFolder,"test.js"));
    //var modTest = require(path.join(testModFolder,"test.js"));
    //modTest.init(eventEmitter,server);

    console.log("#####  MODS LOADED #####");
  var tailOptions = {
    "fsWatchOptions": {"persistent": false},
    "follow": true,
    "fromBeginning": false
  };
  console.log("Initializing tail of serverlog.0.log");
  miscHelpers.touch(path.join(starMadeInstallFolder,"logs","serverlog.0.log")); // Ensure the file exists before we tail it.

  var powershell; // TODO:  See if there is a cleaner workaround than using a powershell instance to force the serverTail to be faster..  It does not handle errors well.  I believe it will crash when log rotation happens.
  if (process.platform == "win32" ){
    console.log("#########   Windows detected, running powershell listener.  #########");
    //  powershell type -wait -Tail 0 .\serverlog.0.log  <-- this will force it to refresh  Source: https://serverfault.com/questions/1845/how-to-monitor-a-windows-log-file-in-real-time
    var powershellArgs=["type","-wait","-Tail 0",serverLogFile];
    console.log("Set Powershell arguments to: " + powershellArgs)
    powershell = spawn("powershell",powershellArgs,{"cwd": logFolder});
    powershellPID=powershell.pid;
    console.log("Powershell started with PID: " + powershellPID);
    addServerPID(powershellPID); // This is to ensure the PID is killed if the server is started again and was not successfully shut down.  I am also adding a treekill to the global exit listener.
  }

  var serverTail = new Tail(path.join(starMadeInstallFolder,"logs","serverlog.0.log"),tailOptions); // TODO:  This seems broken
  // serverTail.watch(); // TEMPORARY
  // process.exit(); // TEMPORARY

  addServerPID(global["server"].spawn.pid); // Adds the PID to the lockfile PID tracker for servers and writes the file
  serversRunning++; // Increment the number of servers running.
  console.log('Spawned server process with PID:' + global["server"].spawn.pid);

  // ####################
  // ###    WRAPPER   ###
  // ####################


  function processDataInput(dataInput){ // This function is run on every single line that is output by the server console.
    if (testMatch(dataInput)) { // Check to see if the message fits any of the regex patterns

      // TODO:  There needs to be a separate processing for the serverlog.0.log file, console, and stdout since there are some duplicates between the console.  This would also be faster.

      if (showAllEvents == true) {
        console.log("Event found!: " + dataInput + "Arguments: " + arguments.length);
      }
      let theArguments=arguments[0].split(" "); // This is to allow easier parsing of each individual word in the line

      // enumerateEventArguments=true; // Temporary
      if (enumerateEventArguments == true){
        for (let i=0;i<theArguments.length;i++){ 
          console.log("stderr--theArguments[" + i + "]: " + theArguments[i]); 
        }
      }
      // ### Player Messages ###
      if (theArguments[0] == "[CHANNELROUTER]"){ // This is for all messages, including commands.
        let sender            = dataInput.match(/\[sender=[A-Za-z0-9_-]*/).toString().replace(/^\[sender=/,"");
        let receiver          = dataInput.match(/\[receiver=[A-Za-z0-9_-]*/).toString().replace(/^\[receiver=/,"");
        let receiverType      = dataInput.match(/\[receiverType=[A-Za-z0-9_-]*/).toString().replace(/^\[receiverType=/,"");
        let message           = dataInput.match(/\[message=.*(?=\]$)/).toString().replace(/^\[message=/,"");
        //arguments[0]: [CHANNELROUTER] RECEIVED MESSAGE ON Server(0): [CHAT][sender=Benevolent27][receiverType=CHANNEL][receiver=all][message=words]
        // console.log("Message found: ");
        // console.log("sender: " + sender);
        // console.log("receiver: " + receiver);
        // console.log("receiverType: " + receiverType);
        // console.log("message: " + message);
        eventEmitter.emit('playerMessage',new MessageObj(sender,receiver,receiverType,message));

      } else if ((/^\[SERVER\]\[SPAWN\] SPAWNING NEW CHARACTER FOR/).test(dataInput)){
        
          // STDERR: [SERVER][SPAWN] SPAWNING NEW CHARACTER FOR PlS[Weedle [Benevolent27]*; id(2)(1)f(10001)]

          // Event found!: [SERVER][SPAWN] SPAWNING NEW CHARACTER FOR PlS[Benevolent27 ; id(2)(1)f(0)]Arguments: 1
          // theArguments[0]: [SERVER][SPAWN]
          // theArguments[1]: SPAWNING
          // theArguments[2]: NEW
          // theArguments[3]: CHARACTER
          // theArguments[4]: FOR
          // theArguments[5]: PlS[Benevolent27
          // theArguments[6]: ;
          // theArguments[7]: id(2)(1)f(0)]


        console.debug("Parsing possible player spawn.  dataInput: " + dataInput);
        if (/PlS\[.*/.test(theArguments[5].toString())){
          let playerName=theArguments[5].split("[").pop();
          if (typeof playerName == "string") {
            // console.log("Player Spawned: " + playerName);
            if (settings["announceSpawnsToMainChat"] == "true") {
              let mMessage="/server_message_broadcast plain " + "'" + playerName + " has spawned.'";
              global["server"].spawn.stdin.write(mMessage.toString().trim() + "\n");
            }
            let theReg=new RegExp(("(?<=PlS\\[" + playerName + " \\[)[^\\]]+"));
            let playerSMName=toStringIfPossible(dataInput.match(theReg));
            let playerObj = new PlayerObj(playerName);
            let playerSMNameObj;
            if (typeof playerSMName == "string"){
              playerSMNameObj=new SMNameObj(playerSMName);
            }
            playerObj["spawnTime"]=Math.floor((new Date()).getTime() / 1000);
            eventEmitter.emit('playerSpawn',playerObj,playerSMNameObj);
          }
        }
          // Event found!: [SERVER] Object Ship[Benevolent27_1523388998134](355) didn't have a db entry yet. Creating entry!Arguments: 1
          // theArguments[0]: [SERVER]
          // theArguments[1]: Object
          // theArguments[2]: Ship[Benevolent27_1523388998134](355)
          // theArguments[3]: didn't
          // theArguments[4]: have
          // theArguments[5]: a
          // theArguments[6]: db
          // theArguments[7]: entry
          // theArguments[8]: yet.
          // theArguments[9]: Creating
          // theArguments[10]: entry!

      // ### New Ship or Base Creation (not blueprints) ###
      } else if (theArguments[0].match(/\[BLUEPRINT\].*/)) { // Various Blueprint events
        if (theArguments[0] == "[BLUEPRINT][BUY]"){ // New Ship spawn from blueprint
          // Event found!: [BLUEPRINT][BUY] Benevolent27 bought blueprint from metaItem: "Isanth-VI" as "Isanth-VI1523389134208"; Price: 194625; to sector: (2, 2, 2) (loadTime: 80ms, spawnTime: 0ms)
          // [SERVER][META] removing metaID: 100320Arguments: 1
          // theArguments[0]: [BLUEPRINT][BUY]
          // theArguments[1]: Benevolent27
          // theArguments[2]: bought
          // theArguments[3]: blueprint
          // theArguments[4]: from
          // theArguments[5]: metaItem:
          // theArguments[6]: "Isanth-VI"
          // theArguments[7]: as
          // theArguments[8]: "Isanth-VI1523389134208";
          // theArguments[9]: Price:
          // theArguments[10]: 194625;
          // theArguments[11]: to
          // theArguments[12]: sector:
          // theArguments[13]: (2,
          // theArguments[14]: 2,
          // theArguments[15]: 2)
          // theArguments[16]: (loadTime:
          // theArguments[17]: 80ms,
          // theArguments[18]: spawnTime:
          // theArguments[19]: 0ms)
          // [SERVER][META]
          // theArguments[20]: removing
          // theArguments[21]: metaID:
          // theArguments[22]: 100320

          console.log("Some blueprint buy event happened."); // This might only be relevant if a server uses credits to buy blueprints?






        } else if (theArguments[0] == "[BLUEPRINT][LOAD]"){ // New ship from load - possibly /spawn_mobs command
          // TODO:  Figure out why this isn't firing off on the first blueprint spawn.  It is ALWAYS the second blueprint spawn and all later spawns for some strange reason.
          console.log("Some blueprint load event happened.");
          let theUser=theArguments[1];
          console.log("theUser:" + theUser);
          var spawnType;
          if (theUser=="<admin>"){
            spawnType="admin"
          } else if (theUser=="<system>"){
            spawnType="massSpawn"
          } else {
            spawnType="player"
          }
          console.log("spawnType:" + spawnType);

          let bluePrintName=dataInput.match(/loaded .*as "/)[0].replace(/^loaded /,"").replace(/ as "$/,"");
          console.log("bluePrintName:" + bluePrintName);
          let shipName=dataInput.match(/".*"/)[0].replace(/"/g,"");
          console.log("shipName:" + shipName);
          let coordsArray=dataInput.match(/\(.*\)/)[0].replace(/[()]/g,"").split(', ');
          console.log("coordsArray:" + coordsArray);
          console.log("X:" + coordsArray[0]);
          console.log("Y:" + coordsArray[1]);
          console.log("Z:" + coordsArray[2]);
          let factionNumber=dataInput.match(/(\d+)$/)[0];
          console.log("factionNumber:" + factionNumber);
          console.log(" ");
          console.log(" ");



          // starNetHelper.getUIDfromName(shipName)
          return getUIDfromName(shipName,"",function(err,result){
            if (err){
              console.log("Error getting entity UID from name!",err);
            } else {
              let entityObj=new EntityObj(result);
              console.dir(entityObj);
              console.log("Creating new coordsObj with: " + coordsArray);
              let coordsObj=new CoordsObj(coordsArray);
              console.dir(coordsObj);
              let sectorObj=new SectorObj(coordsObj.x,coordsObj.y,coordsObj.z);
              console.dir(sectorObj);
              // let coordsObj=new CoordsObj(coordsArray[0],coordsArray[1],coordsArray[2]);

              let playerObj;
              if (spawnType=="player"){
                playerObj=new PlayerObj(theUser);
                playerObj.msg("The playerObj was successful: " + shipName);
                // playerObj.msg("entityObj.loaded:" + entityObj.loaded);
              }
              console.dir(playerObj);

              let blueprintObj=new BlueprintObj(bluePrintName);
              console.dir(blueprintObj);

              let factionObj=new FactionObj(factionNumber);
              console.dir(factionObj);

              eventEmitter.emit('blueprintSpawn',spawnType,playerObj,blueprintObj,entityObj,sectorObj,factionObj); // playerObj will be undefined if the blueprint was spawned by admin or mass spawned
            }
          });



          // Examples:
          // Filling blueprint and spawning as player
          // [BLUEPRINT][LOAD] Benevolent27 loaded Isanth Type-Zero B- as "This is the ship" in (1000, 1000, 1000) as faction 10001

          // Admin loading:
          // [BLUEPRINT][LOAD] <admin> loaded Isanth Type-Zero B- as "Isanth Type-Zero B-_1561352308449" in (1000, 1000, 1000) as faction 10001

          // Using "Mass Spawn Ships" as an admin
          // [BLUEPRINT][LOAD] <system> loaded Isanth Type-Zero Cb as "MOB_Isanth Type-Zero Cb_1561353688999_0" in (1000, 1000, 1000) as faction 0

          // Event found!: [BLUEPRINT][LOAD] <admin> loaded Isanth-VI as "Isanth-VI_1523389201663" in (2, 2, 2) as faction 0Arguments: 1
          // theArguments[0]: [BLUEPRINT][LOAD]
          // theArguments[1]: <admin>
          // theArguments[2]: loaded
          // theArguments[3]: Isanth-VI
          // theArguments[4]: as
          // theArguments[5]: "Isanth-VI_1523389201663"
          // theArguments[6]: in
          // theArguments[7]: (2,
          // theArguments[8]: 2,
          // theArguments[9]: 2)
          // theArguments[10]: as
          // theArguments[11]: faction
          // theArguments[12]: 0



        }
          // Player Disconnects
          // Event found!: [SERVER][DISCONNECT] Client 'RegisteredClient: Benevolent27 (1) connected: true' HAS BEEN DISCONNECTED . PROBE: false; ProcessorID: 0Arguments: 1
          // theArguments[0]: [SERVER][DISCONNECT]
          // theArguments[1]: Client
          // theArguments[2]: 'RegisteredClient:
          // theArguments[3]: Benevolent27
          // theArguments[4]: (1)
          // theArguments[5]: connected:
          // theArguments[6]: true'
          // theArguments[7]: HAS
          // theArguments[8]: BEEN
          // theArguments[9]: DISCONNECTED
          // theArguments[10]: .
          // theArguments[11]: PROBE:
          // theArguments[12]: false;
          // theArguments[13]: ProcessorID:
          // theArguments[14]: 0


          // Event found!: [SERVER][PLAYERMESSAGE] received message request from PlS[Benevolent27 ; id(2)(1)f(0)] for 10 messagesArguments: 1
          // theArguments[0]: [SERVER][PLAYERMESSAGE]
          // theArguments[1]: received
          // theArguments[2]: message
          // theArguments[3]: request
          // theArguments[4]: from
          // theArguments[5]: PlS[Benevolent27
          // theArguments[6]: ;
          // theArguments[7]: id(2)(1)f(0)]
          // theArguments[8]: for
          // theArguments[9]: 10
          // theArguments[10]: messages

      } else if (dataInput.match(/^\[SERVER\] PlayerCharacter\[.*/) || dataInput.match(/^\[SERVER\] Ship\[.*/) || dataInput.match(/^\[SERVER\] ManagedAsteroid\(.*/) || dataInput.match(/^\[SERVER\] Planet\(.*/)) {
        // console.log("Sector change detected: " + dataInput);
        var excerptArray=dataInput.match(/has players attached. Doing Sector Change for PlS.*/);
        // console.log("excerptArray: ");
        // console.dir(excerptArray);
        if (excerptArray){
          var excerpt=excerptArray[0];
          var whittled=excerpt.replace(/^has players attached. Doing Sector Change for PlS\[/,"");
          var whittledArray=whittled.split(" ");
          // Example line: Weedle [Benevolent27]*; id(1712)(8)f(10533)]: Sector[2067](665, 666, 666) -> Sector[1960](666, 666, 666)
          var playerNameCaptured=whittledArray[0];
          // var playerSMNameCaptured=whittledArray[1].replace(/[\[\]\*;]/g,""); // Working
          var playerSMNameCaptured=whittledArray[1].replace(/[[\]*;]/g,""); // Making ESLINT Happy

          var coordsArray=excerpt.match(/Sector\[[0-9]+\]\([-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+\)/g);
          // [ 'Sector[2067](665, 666, 666)', 'Sector[1960](666, 666, 666)' ]
          var cleanCoordsArray=[];
          for (let i=0;i<coordsArray.length;i++){
            cleanCoordsArray.push(coordsArray[i].match(/[-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+/)[0].split(","))
          }
          // console.log("Coords:");
          // console.dir(cleanCoordsArray); // First set is the sector starting in, second is going to
          // console.log("Player Name: " + playerNameCaptured);
          // console.log("Player SM Name:" + playerSMNameCaptured);


          var startingCoords=new SectorObj(cleanCoordsArray[0]);
          var endingCoords=new SectorObj(cleanCoordsArray[1]);
          var player=new PlayerObj(playerNameCaptured);
          var playerSMName=new SMNameObj(playerSMNameCaptured);

          // TODO:  Test this to see if it works
          console.log("Sector change detected for player, '" + player.toString() + "', with registry name, '" + playerSMName.toString() + "', from sector, '" + startingCoords.toString() + "', to sector, '" + endingCoords.toString() + "'.");
          eventEmitter.emit('playerSectorChange',player,startingCoords,endingCoords,playerSMName); // playerObj will be undefined if the blueprint was spawned by admin or mass spawned
        }
        // Bash scripting:  (needs converting to javascript)
        // tempVar=$(echo "${@}" | grep -o "has players attached. Doing Sector Change for PlS.*")
        // if [ "w${tempVar}" != "w" ]; then
        //   theInfo=$(echo "${tempVar}" | sed 's/^has players attached. Doing Sector Change for PlS\[//g')
        //   set -- ${theInfo}
        //   playerName="${1//\[}"
        //   playerSMName="$(echo "${2}" | tr -d '[]*;')"
        //   set -- $(echo ${theInfo} | grep -Po "(?<=Sector\[)[0-9]*\]\([-]{0,1}[0-9]*, [-]{0,1}[0-9]*, [-]{0,1}[0-9]*" | sed 's/^[0-9]*\][(]//g' | tr -d ',')
        //   startingSector="${1}, ${2}, ${3}"
        //   endingSector="${4}, ${5}, ${6}"
        // fi


      } else if (theArguments[0] == "[FACTION]"){ // Player joined a faction
        // STDERR: [FACTION] Added to members Benevolent27 perm(4) of Faction [id=10004, name=TheFaction, description=Faction name, size: 1; FP: 100] on Server(0)
        if (theArguments[1] == "Added"){
          console.debug("Player left faction.  dataInput: " + dataInput);
          let name=theArguments[4];
          let factionID=toStringIfPossible(dataInput.match(/(?<=Faction \[id=)[-]{0,1}[0-9]+/));
          let factionNameString=toStringIfPossible(dataInput.match(/(?<=name=)[^,]+/));
          let playerObj=new PlayerObj(name);
          let factionObj=new FactionObj(factionID);
          eventEmitter.emit('playerFactionJoin',playerObj,factionObj,factionNameString);
        }

      } else if (theArguments[0] == "[FACTIONMANAGER]"){ // Player left a faction
        // STDERR: [FACTIONMANAGER] removing member: Benevolent27 from Faction [id=10003, name=whatever, description=Faction name, size: 1; FP: -142]; on Server(0)
        if (theArguments[1] == "removing"){
          console.debug("Player joined faction.  dataInput: " + dataInput);
          let name=theArguments[3];
          let factionID=toStringIfPossible(dataInput.match(/(?<=Faction \[id=)[-]{0,1}[0-9]+/));
          let factionName=toStringIfPossible(dataInput.match(/(?<=name=)[^,]+/));
          let nameObj=new PlayerObj(name);
          let factionObj=new FactionObj(factionID);
          eventEmitter.emit('playerFactionLeave',nameObj,factionObj,factionName);
        }
      } else if (theArguments[0] == "[SEND][SERVERMESSAGE]"){ // player connect
        // STDERR: [SEND][SERVERMESSAGE] [SERVERMSG (type 0): [484, Weedle]] to RegisteredClient: Weedle (5) [Benevolent27]connected: true
        console.debug("Possible player connection: " + dataInput);
        if ((/connected: true$/).test(dataInput)){
          let playerName=dataInput.match(/(?<=RegisteredClient: )[^ ]+/);
          if (playerName !== null){
            playerName=playerName.toString();
          }
          let playerSMName=dataInput.match(/[^[]+(?=]connected: true)/);
          if (playerSMName !== null){
            playerSMName=playerSMName.toString();
          }
          let playerObj=new PlayerObj(playerName);
          let playerSmNameObj=new SMNameObj(playerSMName);
          eventEmitter.emit('playerConnect',playerObj,playerSmNameObj);
        }

      } else if (theArguments[0] == "[SERVER][DISCONNECT]"){ // Player left a faction
        // Player disconnect
        // STDERR: STDERR: [SERVER][DISCONNECT] Client 'RegisteredClient: Weedle (8) [Benevolent27]connected: true' HAS BEEN DISCONNECTED . PROBE: false; ProcessorID: 25
        let playerName=dataInput.match(/(?<=RegisteredClient: )[^ ]+/);
        if (playerName !== null){
          playerName=playerName.toString();
        }
        let playerSMName=dataInput.match(/[^[]+(?=]connected: true)/);
        if (playerSMName !== null){
          playerSMName=playerSMName.toString();
        }
        let playerObj=new PlayerObj(playerName);
        let playerSmNameObj=new SMNameObj(playerSMName);
        eventEmitter.emit('playerDisconnect',playerObj,playerSmNameObj);
      } else if (dataInput.match(/^\[SERVER\] MAIN CORE STARTED DESTRUCTION/)){
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SHIP_overheatingShip] (666, 666, 666) in 60 seconds - 
      // started 1568254747519 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SHIP_overheatingShip] (666, 666, 666) in 60 seconds - started 1568254747519 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
        
        // Pirates in a ship
        // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SPACESTATION_stoppedOverHeated] (666, 666, 666) in 60 seconds - started 1568339467031 caused by null
        let entityUID=toStringIfPossible(dataInput.match(/(?<=^.*DESTRUCTION \[)[^\]]+/));
        
        console.debug("entityUID: " + entityUID);
        let theCoords=toStringIfPossible(dataInput.match(/(?<=\] \()[-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+/));
        console.debug("theCoords: " + theCoords);
        let theCoordsArray=theCoords.split(", ");
        console.debug("theCoordsArray: " + theCoordsArray);
        let theSeconds=toNumIfPossible(toStringIfPossible(dataInput.match(/(?<=\) in )[0-9]+/)));
        console.debug("theSeconds: " + theSeconds);
        let thePlayerString=toStringIfPossible(dataInput.match(/(?<=PlS\[)[^[ ]+/));
        console.debug("thePlayerString: " + thePlayerString);
        let thePlayerSmName=toStringIfPossible(dataInput.match(/(?<=PlS\[[^\]]+\[)[^\]]+/));
        console.debug("thePlayerSmName: " + thePlayerSmName);

        let entityObj=new EntityObj(entityUID);
        return entityObj.exists("",function(err,result){
          if (err){
            return err;
          }
          if (result){
            let sectorObj=new SectorObj(...theCoordsArray);
            // theSeconds
            if (typeof thePlayerString == "string"){
              var playerObj=new PlayerObj(thePlayerString);
            }
            if (typeof thePlayerSmName == "string"){
              var playerSMNameObj=new SMNameObj(thePlayerSmName);
            }
            return eventEmitter.emit('entityOverheat',entityObj,sectorObj,playerObj,playerSMNameObj);
            // the playerObj and playerSMNameObj are of the player who caused the overheat to occur
    
          } // If the entity does not exist, this must be the duplicate overheat that occurs when an entity is destroyed
          return false; // This is to make ESLint happy
        });

      } else if (theArguments[0] == 'Server(0)'){
        // STDERR: Server(0) Ship[destroyThisShip](19) STOPPED OVERHEATING
        console.debug("Possible overheat stop..");
        log("Possible overheat stop: " + dataInput); // temp
        if ((/STOPPED OVERHEATING$/).test(dataInput)){
          console.debug("Overheat stop confirmed!");
          // STDERR: Server(0) Ship[newNameStopped](186) STOPPED OVERHEATING
          // STDERR: Server(0) SpaceStation[ENTITY_SPACESTATION_oldNameBase(187)] STOPPED OVERHEATING
          let theType=toStringIfPossible(dataInput.match(/(?<=Server\(0\) )[^[]*/));
          console.debug("theType: " + theType);
          
          if (theType == "Ship"){
            var theName=toStringIfPossible(dataInput.match(/(?<=^Server\(0\) Ship\[)[^\]]+/));
            console.debug("theName: " + theName);
            return getUIDfromName(theName,"",function(err,theUID){
              if (err){
                console.log("There was an error!",err);
                return err;
              }
              console.debug("ship theUID: " + theUID);
              if (testIfInput(theUID)){
                let theEntityObj=new EntityObj(theUID);
                return eventEmitter.emit("entityOverheatStopped",theEntityObj);
              }
              return false;
            })
          } else if (theType == "SpaceStation"){
            let theUID=toStringIfPossible(dataInput.match(/(?<=Server\(0\) SpaceStation\[)[^(]+/));
            console.debug("spacestation theUID: " + theUID);
            if (testIfInput(theUID)){
              let theEntityObj=new EntityObj(theUID)
              return eventEmitter.emit("entityOverheatStopped",theEntityObj);
            }
          } else {
            console.debug("Invalid entity type detected for overheat: " + theType);
          }
        }
      }

      // Ship death
      // STDERR: [SERVER][DESTROY] CORE OVERHEATED COMPLETELY: KILLING ALL SHIP CREW Ship[dyingShip](1184)
      // STDOUT: [SEGMENTCONTROLLER] ENTITY Ship[dyingShip](1184) HAS BEEN DESTROYED...
      // STDERR: [SERVER] Core AT 0 HP destroyed for Ship[dyingShip](1184), which is in new power system, is not docked, and has no active reactor (-> death on core destruction)
      // STDERR: [SERVER] Overheating triggered for Ship[dyingShip](1184)
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SHIP_dyingShip] (666, 666, 666) in 60 seconds - started 1568254505636 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
      // base death
      // STDERR: [SERVER][DESTROY] CORE OVERHEATED COMPLETELY: KILLING ALL SHIP CREW SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]
      // STDOUT: [SEGMENTCONTROLLER] ENTITY SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)] HAS BEEN DESTROYED...
      // STDERR: [SERVER] Overheating triggered for SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SPACESTATION_overheatedBase] (666, 666, 666) in 60 seconds - started 1568255108412 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
      // STDERR: [ENTITIES] removed object from loaded state SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]; 1188
      // STDERR: [DELETE][Server(0)] Sendable 1188(SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]) Physically DELETING DONE and Notified!
      // STDERR: [SERVER][SEGMENTCONTROLLER] PERMANENTLY DELETING ENTITY: ENTITY_SPACESTATION_overheatedBase.ent
      // STDERR: [ENTITIES] removed object from loaded state obfuscated.asP@5ba10ef6; 1188
      // STDERR: [DELETE][Server(0)] Sendable 1188(obfuscated.asP@5ba10ef6) Physically DELETING DONE and Notified!


      // Ship OVERHEATED
      // STDERR: [SERVER] Overheating triggered for Ship[overheatingShip](1186)
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SHIP_overheatingShip] (666, 666, 666) in 60 seconds - started 1568254747519 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
      // base OVERHEATED
      // STDERR: [SERVER] Overheating triggered for SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SPACESTATION_overheatedBase] (666, 666, 666) in 60 seconds - started 1568255048394 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]

      // Ship stopped overheating
      // STDERR: Server(0) Ship[shipStoppedOverHeating](1187) STOPPED OVERHEATING
      // Base stopped overheating by placing block on it and then rebooting it when asked:
      // STDERR: Server(0) SpaceStation[ENTITY_SPACESTATION_stoppedOverHeated(1189)] STOPPED OVERHEATING
      // STDERR: [SERVER] Overheating triggered for SpaceStation[ENTITY_SPACESTATION_stoppedOverHeated(1189)]
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SPACESTATION_stoppedOverHeated] (666, 666, 666) in 60 seconds - started 1568255234685 caused by
      // STDERR: Server(0) SpaceStation[ENTITY_SPACESTATION_stoppedOverHeated(1189)] STOPPED OVERHEATING





    }
    return false; // this is just to make ESLint happy
  }

  // For serverlog.0.log
  var lastMessage; // Used for player deaths since the console gets spammed with multiple death messages per player when more than 1 output of a weapon exists, which was responsible for the player's death.
  function processServerlogDataInput(dataInput){ // This function is run on every single line that is output by the server log.
    if (testMatchServerLog(dataInput)) { // Check to see if the message fits any of the regex patterns
      let theArguments=arguments[0].split(" "); // This is to allow easier parsing of each individual word in the line
      // enumerateEventArguments=true; // Temporary
      if (enumerateEventArguments == true){
        for (let i=0;i<theArguments.length;i++){ console.log("theArguments[" + i + "]: " + theArguments[i]); }
      }
      // ### New Ship or Base Creation (not blueprints) ###
      if (theArguments[0] == "[SPAWN]") {
        // Event found!: [SERVER] Object Ship[Benevolent27_1523387756157](1447) didn't have a db entry yet. Creating entry!Arguments: 1
        console.log("Parsing possible ship or base spawn: " + theArguments.join(" ").toString());
        var playerName=theArguments[1];
        var playerObj=new PlayerObj(playerName);
        console.dir(playerObj); // temp
        // var shipName=arguments[0].match(/spawned new ship: "[0-9a-zA-Z _-]*/);
        var shipName=arguments[0].match(/spawned new ship: ["][0-9a-zA-Z _-]*/);
        if (shipName){
          console.log("Temp shipName: " + shipName);
          shipName=shipName.toString().replace(/^spawned new ship: ["]/,'');
          // shipName=shipName.toString().split(":").pop();
          console.log("Temp shipName: " + shipName);
          return getUIDfromName(shipName,"",function(err,result){
            if (err){
              console.log("Error getting entity UID from name!",err);
            } else {
              let entityObj=new EntityObj(result);
              entityObj.spawnTime=Math.floor((new Date()).getTime() / 1000);
              console.dir(entityObj); // temp
              eventEmitter.emit('shipSpawn',playerObj,entityObj);
            }
          });
        } else {
          // var baseName=arguments[0].match(/spawned new station: "[0-9a-zA-Z _-]*/);
          var baseName=arguments[0].match(/spawned new station: ["][0-9a-zA-Z _-]*/);
          if (baseName){
            // baseName=baseName.split(":").pop();
            baseName=baseName.toString().replace(/^spawned new station: ["]/,'');

            // baseNameArray=baseName.split()
            return getUIDfromName(baseName,"",function(err,result){
              if (err){
                console.log("Error getting entity UID from name!",err);
              } else {
                let entityObj=new EntityObj(result);
                entityObj.spawnTime=Math.floor((new Date()).getTime() / 1000);
                eventEmitter.emit('baseSpawn',playerObj,entityObj);
              }
            });
          }
        }
      } else if (theArguments[0] == "[DEATH]"){
        // Post 2.0 weapons update:
        // [2018-07-15 13:21:05] [DEATH] TheDerpGamer has been killed by 'Responsible: Mine//1342'; controllable: Mine [id=1342, sectorPos=(22, 28, 36), mineType=MINE_TYPE_MISSILE, active=true(5)]
        // [2018-07-15 10:17:31] [DEATH] Starjet1 has been killed by 'Killer: Starjet1 (0.0/120.0 HP left)'; controllable: PlS[Starjet1 [Starjet]; id(2704)(15)f(0)]
        // [2018-07-15 21:04:33] [DEATH] WARLOCKZIKE has been killed by 'Killer: WARLOCKZIKE (0.0/120.0 HP left)'; controllable: PlS[WARLOCKZIKE [WARLOCKZIKE]; id(27544)(80)f(0)]
        // [2018-07-15 21:33:48] [DEATH] jacknickels2 has been killed by 'Responsible: Small Cargo Shitrl80[Phantomhive]'; controllable: Ship[Small Cargo Shitrl80](97)
        // [2018-07-15 21:36:15] [DEATH] Spongy9698 has been killed by 'Responsible: MASS REMOVERrl00[V I R U S]'; controllable: Ship[MASS REMOVERrl00](4120)
        // [2018-07-15 22:45:58] [DEATH] Danger89 committed suicide
        // [2018-07-15 22:45:58] [DEATH] Danger89 has been killed by 'Killer: Danger89 (0.0/120.0 HP left)'; controllable: PlS[Danger89 [Danger89]*; id(17964)(55)f(0)]
        // [2018-07-16 00:01:30] [DEATH] Eidolon2 has been killed by 'Responsible: Pirate-Tok-Jake_Forager-OT-H-2 85-0[Pirates]'; controllable: Ship[Pirate-Tok-Jake_Forager-OT-H-2 85-0](31790)


        var person=toStringIfPossible(dataInput.match(/(?<=\[DEATH\] )[^ ]+(?= has been killed by.*)/));
        if (person){
          var personObj=new PlayerObj(person);
          var theCurrentDate=new Date();
          var theMonth;
          theMonth=theCurrentDate.getMonth() + 1;
          if (theMonth < 10){
            theMonth="0" + theMonth.toString();
          }
          var theDay;
          theDay=theCurrentDate.getDate()+1;
          if (theDay < 10){
            theDay="0" + theDay;
          }

          var theYear=theCurrentDate.getFullYear();
          var theDate= theMonth + "-" + theDay + "-" + theYear;

          var theHour;
          theHour=theCurrentDate.getHours();
          if (theHour < 10){
            theHour="0" + theHour;
          }
          var theMinute;
          theMinute=theCurrentDate.getMinutes();
          if (theMinute < 10){
            theMinute="0" + theMinute;
          }
          var theSeconds;
          theSeconds=theCurrentDate.getSeconds();
          if (theSeconds < 10){
            theSeconds="0" + theSeconds;
          }
          var theTime=theHour + ":" + theMinute + ":" + theSeconds;

          var message=`[${theDate}] [${theTime}]: ${person}`
          // There are TWO very different ways that both the entity and player name might show up in a death message

          // We gotta see if "responsible" is a "sun" or other sort of entity first before even trying to see if it's a player or ship
          // responsible=$(echo $b | grep -o "'Responsible: .*;" | sed "s/'Responsible: //g" | sed "s/';//g" ) // | sed 's/\[.*//g')

          // Updating after weapons 2.0
          var responsible=toStringIfPossible(dataInput.match(/(?<=Responsible: )[^']+(?='.*)/));
          // Shipyard:  D_1508536985403 (design)
          var deathType;
          var responsibleEntity;
          if ( responsible == "Sun"){
            deathType="star"
          } else if (responsible == "Black Hole"){
            deathType="blackhole"
          } else if (responsible == "Floating Rock <can be harvested>"){
            deathType="asteroid"
          } else if (responsible == "PlanetSegment(Planet);"){
            deathType="planetSegment"
          }else if ((/\(design\)/).test(responsible)){
            deathType="shipyarddesign"
          } else {
            var killer=toStringIfPossible(dataInput.match(/(?<='Killer: )[^(]*(?= \()/));
            if (typeof killer == "string"){ // will be null if no killer
              if (person == killer){
                // This probably should be broadened to include suiciding via their own ship
                message=`[${theDate}] [${theTime}]: ${person} killed themselves.`
                deathType="suicide"
              } else {
                responsibleEntity=toStringIfPossible(dataInput.match(/(?<=controllable: Ship\[)[^\]]*/));
                if (responsibleEntity){
                  // Since we know the killer's name and also the entity, set to having been perpetrated by a person in an entity
                  message=`[${theDate}] [${theTime}]: ${person} was killed by ${killer}, in entity ${responsibleEntity}`
                  deathType="personInShip"

                  // Let's look up the responsible faction, if there is one.
                  // responsibleFaction=$(echo "$responsible" | sed -E 's/((^.*\[)|(\]$))//g')
                  var responsibleFaction=toStringIfPossible(responsible.match(/(?<=\[)[^\]]+/));
                  if (testIfInput(responsibleFaction)){
                    message=`${message}, of the faction, '${responsibleFaction}'`
                  }
                } else {
                  message=`[${theDate}] [${theTime}]: ${person} was killed by ${killer}.`
                  deathType="person"
                }
              }
            } else {
              // killer=$(echo "$b" | grep -o "'Killer: [^(]*" | sed "s/^'Killer:[ ]*//g" | sed 's/ $//g')
              // If no killer found by first check, then check for the entity name and person's name via the "responsible entity"
              // Gotta figure out why removing the ] fucks up the responsible faction..
              // echo "No Killer found.. Running secondary check.."
              killer=toStringIfPossible(responsible.match(/(?<=<)[^>]*(?=>.*)/));
              // console.log(`killer: ${killer}`);
              if (person == killer){
                // This probably should be broadened to include suiciding via their own ship
                message=`${message} killed themselves.`
                deathType="suicide"
              } else if (responsible){
                if (killer){
                  message=`${message} was killed by ${killer}`
                  deathType="person"
                } else {
                  // If no killer was found with the first or second check, then we have to assume an entity will be found, but we'll double check anyhow.
                  deathType="entity"
                }

                // Trying to remove the potential name info prevents this from working.  I need a workaround
                // responsibleEntity=$(echo "${responsible}" | sed -E 's/([^\[]*$)//g' | sed -E 's/((\[$)|(\<.*))//g')

                // This will only work IF there are [ brackets ], such as a faction name in there, so I need to branch out here as well
                responsibleEntity=responsible.replace(/(\[.*$|<.*$)/g,"");
                // responsibleEntity=$(echo "${responsible}" | sed -E 's/([^\[]*$)//g' | sed 's/\[$//g' | sed 's/<.*//g')

                // Ths needs to work for entities that have no controlling person.. hmm
                // [2017-10-20 16:29:44] [DEATH] Benevolent327 has been killed by 'Responsible: Benevolent327_1508531362205'; controllable: Ship[Benevolent327_1508531362205](25109)

                // echo 'Destroyer_Drone_Less_Missiles-V2_5-Compliant_15085rl00[The Rebuilders]' | sed -E 's/([^\[]*$)//g' | sed 's/\[$//g'
                // Destroyer_Drone_Less_Missiles-V2_5-Compliant_15085rl00



                // echo "responsibleEntity: ${responsibleEntity}"
                if (testIfInput(responsibleEntity)){
                  // responsibleFaction=$(echo "$responsible" | grep -o '[\[].*' | sed 's/[\[\]]//g')
                  responsibleFaction=toStringIfPossible(responsible.match(/(?<=\[)[^\]]*(?=\].*$)/));
                  // echo "responsibleFaction: ${responsibleFaction}"
                  if (testIfInput(responsibleFaction)){
                    message=`${message} of the faction, '${responsibleFaction}'`;
                  }
                  message=`${message}, via the entity, '${responsibleEntity}'`;
                  if (testIfInput(killer)){
                    // We know an entity was found and also a person, so set the death type to being killed by a person in a ship
                    deathType="personInShip";
                  } else {
                    // Since there was no killer, but there was a responsible entity, set to entity only
                    deathType="entity";
                  }

                // Here we double check to ensure the deathType is reset if no responsible entity was found
                } else if (!testIfInput(killer)){
                  // player died, but no responsible entity nor killer was found!  This should never happen!"
                  deathType="mystery";
                }
              } else {
                // no responsible found!  This should never happen!"
                deathType="mystery";
              }

            // We have a 'killer' type death, so we need to look for the entity now if not a suicide.


            }
          }
          if (killer){
            var killerObj=new PlayerObj(killer);
          }
          if (responsibleEntity){
            var responsibleEntityObj=new EntityObj(responsibleEntity);
          }
          // Cannot create a faction object here since we only have the name to work with.  We have to run an async function to get that FactionObj at the time of emitting


          // Need to fix sun damage
          // [DEATH] Benevolent327 has been killed by 'Responsible: Sun'; controllable: Sector[21240](8, 8, 8)


          // todo: When a death is caused by different weapons of the same entity, it will oftentimes spam a bunch of death messages in the logs - this prevents most duplicates from getting through, but really there needs to be a 5 second counter or something applied per name to make it more accurate


          // For troubleshooting duplicates
          // "${scriptDir}log.sh" "lastMessage: |${lastMessage}|"
          // "${scriptDir}log.sh" "message: |${message}|"


          if (lastMessage == String(message)){
            // "${scriptDir}log.sh" "Duplicate Death: ${message}"
            console.debug("### SKIPPING DUPLICATE DEATH MESSAGE ###: " + lastMessage);
            // echo "##### SKIPPED INFOS ######"
            // echo "# theDate: ${theDate}  theTime: ${theTime}  deathType: ${deathType}"
            // echo "# responsibleEntity: ${responsibleEntity}"
            // echo "# killer: ${killer}  responsibleFaction: ${responsibleFaction}"
            // echo "#### END SKIPPED INFOS #####"

          } else {
            // "${scriptDir}log.sh" "# PROCESSING DEATH TEXT: $@"

            console.log(message);
            lastMessage=String(message); // This is needed to filter out any duplicate death messages, such as when a weapon has several outputs and they all killed a player at the same time.  Note we do not want to link to the "message" variable, but rather set a new string based on it.
            console.log("##### INFOS ######");
            // console.log("# Everything: ${b}"
            console.log(`# theDate: ${theDate}  theTime: ${theTime}  deathType: ${deathType}`);
            console.log(`# responsibleEntity: ${responsibleEntity}`);
            console.log(`# killer: ${killer}  responsibleFaction: ${responsibleFaction}`);
            console.log(`#### END INFOS #####`);
            console.log(" ");
            if (deathType == "suicide"){
              // "${scriptDir}wrapper/melvin_public_chat.sh" "Haw haw, ${person} totally just killed themselves."
              // runPlayerDeath "${person}" "${deathType}"
              eventEmitter.emit('playerDeath',personObj,deathType);
             } else if (deathType == "person"){
              // TODO:  Fix this
              // "${scriptDir}wrapper/melvin_public_chat.sh" "Whaaat!  ${killer} just WHACKED ${person}!  :D"
              console.debug(`${killer} killed ${person}.`);
              // runPlayerDeath "${person}" "${deathType}" "${killer}"
              eventEmitter.emit('playerDeath',personObj,deathType,killerObj);
            } else if (deathType == "personInShip"){
              var ofTheFaction="";
              if (testIfInput(responsibleFaction)){
                ofTheFaction=`, of the faction '${responsibleFaction}',`
              }
              // TODO:  Fix this
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${killer}${ofTheFaction} just WHACKED ${person} while piloting the entity, '${responsibleEntity}'!  :D"
              console.log(`${killer}${ofTheFaction} killed ${person} while piloting the entity, '${responsibleEntity}'.`);
              // unset ofTheFaction
              // runPlayerDeath "${person}" "${deathType}" "${killer}" "${responsibleEntity}"
              if (testIfInput(responsibleFaction)){
                return getFactionObjFromName(responsibleFaction,"",function(err,responsibleFactionObj){
                  if (err){
                    console.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!",err);
                  } else {
                    // runPlayerDeath "${person}" "${deathType}" "${responsibleEntity}" "${responsibleFaction}"
                    eventEmitter.emit('playerDeath',personObj,deathType,responsibleEntityObj,responsibleFactionObj,killerObj);
                  }
                });
              } else {
                eventEmitter.emit('playerDeath',personObj,deathType,responsibleEntityObj,"",killerObj);
              }
            } else if (deathType == "entity"){
              if (testIfInput(responsibleFaction)){
                // TODO:  Fix this
                // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} was PWNED by an entity, '${responsibleEntity}', from the faction, ${responsibleFaction}!  Muwhaha!"
                console.log(`${person} was killed by an entity, '${responsibleEntity}', from the faction, ${responsibleFaction}.`);
                //# Run Mod Scripts
                // "${scriptDir}log.sh" "DEBUGGING PARSER: ${responsibleEntity}"
                return getFactionObjFromName(responsibleFaction,"",function(err,responsibleFactionObj){
                  if (err){
                    console.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!",err);
                  } else {
                    // runPlayerDeath "${person}" "${deathType}" "${responsibleEntity}" "${responsibleFaction}"
                    eventEmitter.emit('playerDeath',personObj,deathType,responsibleEntityObj,responsibleFactionObj,killerObj);
                  }
                });

              } else {
                // runPlayerDeath "${person}" "${deathType}" "${responsibleEntity}"
                console.log(`${person} was killed by an entity, '${responsibleEntity}'.`);
                eventEmitter.emit('playerDeath',personObj,deathType,responsibleEntityObj,"",killerObj);
                // TODO:  Fix this
                // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} was PWNED by an entity, '${responsibleEntity}'!"
              }
            } else if (deathType == "blackhole"){
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} was spaghettified!  :D"
              console.log(`${person} was killed by a black hole.`);
              // runPlayerDeath "${person}" "${deathType}" "${responsible}"
              eventEmitter.emit('playerDeath',personObj,deathType);

            } else if (deathType == "star"){
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} was burned alive by a star!  Praise the sun!"
              // runPlayerDeath "${person}" "${deathType}" "${responsible}"
              console.log(`${person} was killed by a star.`);
              eventEmitter.emit('playerDeath',personObj,deathType);
            } else if (deathType == "asteroid"){
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} just got ROCKED by an asteroid!"
              // runPlayerDeath "${person}" "${deathType}" "${responsible}"
              console.log(`${person} was killed by an asteroid.`);
              eventEmitter.emit('playerDeath',personObj,deathType);
            } else if (deathType == "planetSegment"){
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} couldn't handle planet life.  Goodbye world!"
              // runPlayerDeath "${person}" "${deathType}" "${responsible}"
              console.log(`${person} was killed by a planet segment.`);
              eventEmitter.emit('playerDeath',personObj,deathType,responsibleEntityObj); // responsibleEntityObj will be undefined if no EntityObj was given.  //TODO: This needs to be tested.
            } else if (deathType == "planetCore"){ // This is currently not used.  If functional, this would be for planet cores.
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} just got their skin melted off by molten lava!  D:"
              // runPlayerDeath "${person}" "${deathType}" "${responsible}"
              console.log(`${person} was killed by a planet core.`);
              eventEmitter.emit('playerDeath',personObj,deathType,responsibleEntityObj);
            } else if (deathType == "shipyarddesign"){
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} just lived the impossible dream!  Death by design!  :DDDDD"
              // runPlayerDeath "${person}" "${deathType}" "${responsible}"
              console.log(`${person} was killed by a shipyard design.  How did that happen?!`);
              eventEmitter.emit('playerDeath',personObj,deathType);
              // This should never happen, but knowing StarMade it will.  I think if a player suicides before spawning in, this will happen.  So this needs to be fixed.
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} seems to have died from mysterious circumstances.."
              //# Run Mod Scripts - This will likely be broken and this will need to be fixed.
              // runPlayerDeath "${person}" "${deathType}" "${responsibleEntity}" "${responsibleFaction}"
            } else if (testIfInput(responsibleFaction)){
              // TODO:  Fix this
              // "${scriptDir}wrapper/melvin_public_chat.sh" "${person} was PWNED by an entity, '${responsibleEntity}', from the faction, ${responsibleFaction}!  Muwhaha!"
              //# Run Mod Scripts
              // "${scriptDir}log.sh" "DEBUGGING PARSER: ${responsibleEntity}"
              return getFactionObjFromName(responsibleFaction,"",function(err,responsibleFactionObj){
                if (err){
                  console.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!",err);
                } else {
                  // runPlayerDeath "${person}" "${deathType}" "${responsibleEntity}" "${responsibleFaction}"
                  console.log(`${person} was killed ${killer}, in the entity, ${responsibleEntity}, from the faction, ${responsibleFaction}.`);
                  eventEmitter.emit('playerDeath',personObj,deathType,responsibleEntityObj,responsibleFactionObj,killerObj);
                }
              });
            } else {
              // runPlayerDeath "${person}" "${deathType}" "${responsibleEntity}"
              console.log(`${person} was killed.  Deathtype was: ${deathType} --Responsible entity was: ${responsibleEntity}.`);
              eventEmitter.emit('playerDeath',personObj,deathType,responsibleEntityObj,"",killerObj);
            }
          }
          
          // Here is where I need to run any sort of default death scripts, if desired.
        }
      }
    }
    return true; // added to make ESLint happy
  }

  global["server"].spawn.stdout.on('data', function (data) { // Displays the standard output from the starmade server
    let dataString=data.toString().trim(); // Clear out any blank lines
    if (dataString){
      let dataArray=dataString.replace("\r","").split("\n"); // simplify to only new line characters and split to individual lines.
      for (let i=0;i<dataArray.length;i++){
        if (dataArray[i]){
          if (showStdout == true || showAllEvents == true) {
            if (typeof stdoutFilter == "object"){
              if (stderrFilter.test(dataArray[i])){
                console.log("STDOUT: " + dataArray[i]);
              }
            } else {
              console.log("STDOUT: " + dataArray[i]);
            }
          }
          if (recording){ // For the wrapper console command "!recording"
            recordingArray.push("STDOUT: " + dataArray[i]);
          }
          processDataInput(dataArray[i]); // Process the line to see if it matches any events and then trigger the appropriate event
        }
      }
    }
  });

  global["server"].spawn.stderr.on('data', function (data) { // Displays the error output from the starmade server
    let dataString=data.toString().trim(); // Clear out any blank lines
    if (dataString){
      let dataArray=dataString.replace("\r","").split("\n"); // simplify to only new line characters and split to individual lines.
      for (let i=0;i<dataArray.length;i++){
        if (dataArray[i]){
          if (showStderr == true || showAllEvents == true) {
            if (typeof stderrFilter == "object"){
              if (stderrFilter.test(dataArray[i])){
                console.log("STDERR: " + dataArray[i]);
              }
            } else {
              console.log("STDERR: " + dataArray[i]);
            }
          }
          if (recording){ // For the wrapper console command "!recording"
            recordingArray.push("STDERR: " + dataArray[i]);
          }
          processDataInput(dataArray[i]); // Process the line to see if it matches any events and then trigger the appropriate event
        }
      }
    }
  });

  serverTail.on('line', function(data) { // This is unfortunately needed because some events don't appear in the console output.  I do not know if the tail will be 100% accurate, missing nothing.
    // console.log("Processing serverlog.0.log line: " + data.toString().trim());
    // There needs to be a separate processor for serverlog stuff, since there can be duplicates found in the console and serverlog.0.log file.  This should also be faster once streamlined.
    // let dataString=data.toString().trim().replace(/^\[[^\[]*\] */,''); // This was throwing ESLINTER areas I guess.
    let dataString=data.toString().trim().replace(/^\[[^[]*\] */,''); // This removes the timestamp from the beginning of each line so each line looks the same as a console output line, which has no timestamps.
    if (dataString){ // Do not process empty lines
      let dataArray=dataString.replace("\r","").split("\n"); // simplify to only new line characters and split to individual lines.
      for (let i=0;i<dataArray.length;i++){
        if (dataArray[i]){ // Do not process empty lines
          if (showServerlog == true || showAllEvents == true) {
            if (typeof serverlogFilter == "object"){
              if (serverlogFilter.test(dataArray[i])){
                console.log("serverlog.0.log: " + dataArray[i]);
              }
            } else {
              console.log("serverlog.0.log: " + dataArray[i]);
            }
          }
          if (recording){ // For the wrapper console command "!recording"
            recordingArray.push("serverlog.0.log: " + dataArray[i]);
          }
          processServerlogDataInput(dataArray[i]); // Process the line to see if it matches any events and then trigger the appropriate event
        }
      }
    }
  });

  process.on('exit', function() { // This is scoped so that it can terminate the starmade server when the main script ends.
    // This should kill the server, but ONLY if there is a server running.
    console.log("Scoped exit event running..");
    if (serversRunning>0){
      // Kill the processes, including all decendent processes.  For example, if we set the starmade server to actually be a script, then this will kill the script + the server.
      if (global["server"].spawn.pid){
        console.log("Killing server PID, '" + global["server"].spawn.pid + "' and all process descendants.");
        treeKill(global["server"].spawn.pid, 'SIGTERM');
      }
      // We don't decrement the serversRunning value, because the "exit" event for the server process should do it.
    }
  });

  global["server"].spawn.on('exit', function (code) { // This handles When the server child process ends, abormally or not.
    serversRunning--;
    delServerPID(global["server"].spawn.pid); // This updates the lock file
    if (code){
      process.exitCode=code;
      // if (code.hasOwnProperty("message")){  // Commenting out to make ESLinter happy
      //     console.log('Server instance exited with message: ' + code.message.toString());
      // }
      console.log('Server instance exited with code: ' + code.toString());
    }
    console.log("serverTail:");
    console.dir(serverTail.listeners());
    console.log("Shutting down server log tail..");
    serverTail.unwatch();

    // exitNow(code); // This is temporary, we don't necessarily want to kill the wrapper when the process dies.  For example, maybe we want to respawn it?  Ya know?!
    process.exit(); // This is necessary for now because something is holding up the natural exit of the script

  });
  global["server"].spawn.on('error', function (code) {
    // This runs is the java process could not start for some reason.
    console.error("ERROR:  Could not launch server process!")
    if (code.hasOwnProperty("message")){
        console.log('Error Message: ' + code.message.toString());
    }
    console.log('Error: ' + code.toString()); // This should provide details of the error starting the server
    // process.exitCode=code; // There does not seem to be a code provided to an error Object, so the exit code cannot be created
    // TODO:  Set error codes for launch fails.  This will require parsing the error thrown.
    throw new Error("Server launch fail!"); // This should kill the server and dump the text to the console.
  });



  // #######################################
  // ###    COMMAND LINE WRAPPER START   ###
  // #######################################
  // This will process user input at the console and either direct it to the server process or parse it as a command.
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

  var recording=false;
  var recordingArray=[];
  var recordFileName="record";
  var recordingCounter=1;
  var recordingFile=getRecordFileName();

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
          var objName=input.match(/^[^(]+/);
          if (objName){
            objName=objName.toString();
            var objArguments=input.match(/(?<=\()[^(^)]+(?=\))/);
            if (objArguments){
              objArguments=objArguments.toString();
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
      } else if (i(theCommand,"settings")) {
        if (!theArguments[0]){
          // const copy = Object.create(Object.getPrototypeOf(settings));
          console.log("\nHere are your current settings:")
          const propNames = Object.getOwnPropertyNames(settings);
          propNames.forEach(function(name){
            // console.log("Setting: " + name + " Value: " + Object.getOwnPropertyDescriptor(settings, name));
            if (name != "smTermsAgreedTo"){ console.log(" " + name + ": " + settings[name]); }
          });
          console.log("\nIf you would like to change a setting, try !changesetting [SettingName] [NewValue]");
        }
      } else if (i(theCommand,"changesetting")) {
        var usageMsg="Usage: !changeSetting [Property] [NewValue]";
        if (theArguments[0]){
          // console.log("Result of checking hasOwnProperty with " + theArguments[0] + ": " + settings.hasOwnProperty(theArguments[0]));
          if (settings.hasOwnProperty(theArguments[0])){
            let oldSettings=miscHelpers.copyObj(settings);
            let settingNameToChange=theArguments.shift();
            let newSetting=theArguments.join(" ");
            if (newSetting){
              console.log("\nChanged setting from: " + oldSettings[settingNameToChange]);
              settings[settingNameToChange]=newSetting;
              console.log("Changed setting to: " + settings[settingNameToChange]);
              console.log("Settings update will take effect next time the server is restarted.")
              writeSettings();
            } else {
              console.log("ERROR: You need to specify WHAT you wish to change the setting, '', to!");
              console.log(usageMsg);
            }
          } else {
            console.log("ERROR:  Cannot change setting, '" + theArguments[0] + "'! No such setting: ");
          }
        } else {
          console.log("ERROR:  Please provide a setting to change!");
          console.log(usageMsg);
        }
      } else if (testIfInput(theCommand)){
        console.log("ERROR: '" + theCommand + "' is not a valid command!  For a list of wrapper console commands, type: !help");
      }
    } else if (testIfInput(theText)){
      console.log("Running Command: " + theText);
      global["server"].spawn.stdin.write(theText + "\n");
      // global["server"].spawn.stdin.write(text.toString() + "\n");
      // global["server"].spawn.stdin.end();
    } // If blank, don't do anything.
    return true; // This does nothing except to make ESLint happy.
  });

  // This is great to have all the info show on the screen, but how does one turn off a pipe? No idea.  I'll use events instead.
  // global["server"].spawn.stdout.pipe(process.stdout);
  // global["server"].spawn.stderr.pipe(process.stdout);

  // var stdinStream = new stream.Readable();

});

// #####################
// ###   EMITTERS   ####
// #####################
eventEmitter.on('asyncDone', installDepsSync);

// ####################
// ###  FUNCTIONS  #### -- The standard practice for functions is first write in place, then make a multi-purpose function that handles what you need and can be used elsewhere, then bundle it in a require and change over functionality.  This is to keep the main script at a maintainable length and also have high re-usability value for code created.
// ####################

function writeSettings() {
  var settingsFileName=path.basename(settingsFile);
  try {
    var settingsFileStream=fs.createWriteStream(settingsFile);
    settingsFileStream.write(JSON.stringify(settings, null, 4));
    settingsFileStream.end();
    console.log("Updated '" + settingsFileName + "' file.");
    log("Updated '" + settingsFileName + "' file.");
  } catch (err) {
    console.error("ERROR: Could not write to the '" + settingsFileName + "' file!");
    log("ERROR: Could not write to the '" + settingsFileName + "' file!");
    throw err;
  }
}

// Obsoleting this by using process.errorCode=Num; and then throwing an error if an immediate shutdown is required.
// function exitNow(code) { // TODO: stop using an exit function.  Since other require scripts might facilitate an exit, we really shouldn't use a function to perform exits any longer.
//   // TODO: Delete the lock file deletion text, as the functionality has changed.
//   // We should not delete the lock file, but simply leave it for the next run.  It SHOULD have the correct PID's added/removed as servers are added or removed.
//   // console.log("Deleting lock file.");
//   // simpleDelete(lockFile);
//   console.log("Exiting main script with exit code: " + code);
//   process.exit(code);
// }


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

function testMatch(valToCheck) { // This function will be called on EVERY line the wrapper outputs to see if the line matches a known event or not.
  // TODO: It might be better to simply return the match, then forward for processing, rather than running a test and processing the matches against it.
  // So really this should simply be replaced with a "getMatch" function which only returns the line if it matches

  // TODO:  There needs to be a separate check AND processing for the serverlog.0.log file, since there are some duplicates between the console.  This would also be faster.
  if (includePatternRegex.test(valToCheck)){
    if (!excludePatternRegex.test(valToCheck)){
      return true;
    }
    return false;

  } else {
    return false;
  }
}

function testMatchServerLog(valToCheck) { // This function will be called on EVERY line the wrapper outputs to see if the line matches a known event or not.
  // TODO: It would be much better to simply run the match, then forward for processing, rather than running a test and processing the matches against it.
  // So really this should simply be replaced with a "getMatch" function which only returns the line if it matches
  if (includePatternServerLogRegex.test(valToCheck)){
    if (!excludePatternServerLogRegex.test(valToCheck)){
      return true;
    }
    return false;

  } else {
    return false;
  }
}




async function getSuperAdminPassword(starMadeInstallPath){ // This will grab the superadmin password, setting it up and enabling it if not already.
  // TODO: Offload this to a require
  // Load the server.cfg from install path
  var serverCfgFile=path.join(starMadeInstallPath,"StarMade","server.cfg");
  var serverCfgObj=ini.getFileAsObj(serverCfgFile);
  var superAdminPassword=ini.getVal(serverCfgObj,"SUPER_ADMIN_PASSWORD");
  var superAdminPasswordEnabled=ini.getVal(serverCfgObj,"SUPER_ADMIN_PASSWORD_USE");
  if (superAdminPasswordEnabled){ // Only perform .toLowerCase() if the value exists to avoid crashing the script.
    superAdminPasswordEnabled=superAdminPasswordEnabled.toLowerCase();
  }
  if (superAdminPassword == "mypassword" || !superAdminPassword){ // "mypassword" is the default value upon install.  We do not want to keep this since it'd be a major security vulnerability.
    console.log("\nThe 'SuperAdminPassword' has not been set up yet!  This is needed for StarNet.jar to connect to the server.");
    console.log("You can set a custom alphanumeric password OR just press [ENTER] to have a long, randomized one set for you. (Recommended)")
    let newSuperAdminPassword="";
    do {
      newSuperAdminPassword=prompt("New SuperAdminPassword: ");
    }
    while (!(newSuperAdminPassword === null || newSuperAdminPassword == "" || regExpHelper.isAlphaNumeric(newSuperAdminPassword))) // If a person puts invalid characters in, it'll just keep repeating the prompt.
    if (newSuperAdminPassword === null || newSuperAdminPassword == ""){
      console.log("Excellent choice!  I have set a LONG and nearly impossible to crack SuperAdminPassword for you! :D");
      newSuperAdminPassword = getRandomAlphaNumericString(32);
    } else { console.log("Alrighty then.  I'll just use what you provided!") };
    await sleepSync(2000);
    // serverCfgObj["SUPER_ADMIN_PASSWORD"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD"],newSuperAdminPassword);
    ini.setVal(serverCfgObj,"SUPER_ADMIN_PASSWORD",newSuperAdminPassword);
    if (superAdminPasswordEnabled == "false") {
      console.log("Super Admin Password was disabled, enabling!");
      // serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"],"true");
      ini.setVal(serverCfgObj,"SUPER_ADMIN_PASSWORD_USE","true");
    }
    ini.writeObjToFile(serverCfgObj,serverCfgFile);
  } else if (superAdminPasswordEnabled != "true"){ // Enable super admin password if it was disabled for some reason.
    console.log("Super Admin Password was disabled, enabling!");
    // serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"],"true");
    ini.setVal(serverCfgObj,"SUPER_ADMIN_PASSWORD_USE","true");
    ini.writeObjToFile(serverCfgObj,serverCfgFile);
  }
  return ini.getVal(serverCfgObj,"SUPER_ADMIN_PASSWORD");
}

function addServerPID (serverPID){
  if (serverPID){
    if (!lockFileObj.hasOwnProperty("serverSpawnPIDs")){
      lockFileObj["serverSpawnPIDs"]=[];
    }
    lockFileObj["serverSpawnPIDs"].push(serverPID);
    writeLockFile();
    return true;
  }
  throw new Error("No PID given to addServerPID function!");
}
function delServerPID (serverPID){
  if (serverPID){
    if (!lockFileObj.hasOwnProperty("serverSpawnPIDs")){
      lockFileObj["serverSpawnPIDs"]=[];
    }
    lockFileObj["serverSpawnPIDs"]=arrayMinus(lockFileObj["serverSpawnPIDs"],serverPID);
    writeLockFile();
    return true;
  }
  return new Error("No PID given to delServerPID function!");
}

function writeLockFile(){
  // var lockFileWriteObj = fs.createWriteStream(lockFile);
  // lockFileWriteObj.write(JSON.stringify(lockFileObj));
  // lockFileWriteObj.end();
  console.log("Writing to lock file..");
  fs.writeFileSync(lockFile,JSON.stringify(lockFileObj, null, 4));
  console.log("Done!");
}

function countActiveLockFilePids(lockFileObject){
  var count=0;
  if (lockFileObject.hasOwnProperty("mainPID")){
    if (lockFileObject["mainPID"]){
      if (isPidAlive(lockFileObject["mainPID"])) {
        count++
      }
    }
  }
  if (lockFileObject.hasOwnProperty("serverSpawnPIDs")){
    var serverPIDs=lockFileObject["serverSpawnPIDs"];
    for (let i=0;i<serverPIDS.length;i++){
      if (isPidAlive(serverPIDs[i])){
        count++
      }
    }
  }
  return count;
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

exitHook(() => { // This will handle sigint and sigterm exits.
  // Cleanup that needs to be done on the global scope should be done here.
  console.log("Global Exit event running using exitHook require..");
  if (powershellPID){
    try {
      console.log("Powershell spawn detected.  Killing it.  PID is: " + powershellPID);
      treeKill(powershellPID, 'SIGTERM');
    } catch (error) {
      console.log("ERROR:  Could not kill powershell instance!");
    }
  }
});

// This doesn't handle sigterm or sigint exit codes.
// process.on('exit', function() {
//   // Cleanup that needs to be done on the global scope should be done here.
//   console.log("Global Exit event running..");
// });
writeLockFile(); // This is to prevent this script from running multiple times or starting while another server instance is already running.

// ##############################
// ### CREATE NEEDED FOLDERS  ###
// ##############################

miscHelpers.ensureFolderExists(modsFolder);
miscHelpers.ensureFolderExists(binFolder);
miscHelpers.ensureFolderExists(starMadeInstallFolder); // This is redundant to handle if the person deletes or moves their StarMade install folder.

// ###################################
// ### DEPENDENCIES AND DOWNLOADS  ###
// ###################################
// Check for dependencies, such as StarNet.jar and download/install if needed.
// When all dependency downloads/installs are finished, start the server!
console.log("Ensuring all dependencies are downloaded or installed..");

// ### Async downloads/installs that have no dependencies ### -- This sub-section is for all installs/downloads that can be done asynchronously to occur as quickly as possible.
asyncOperation("start"); // This prevents the first async function from starting the wrapper if it finishes before the next one starts.
preDownload(starNetJarURL,starNetJar); // This function handles the asyncronous downloads and starts the sync event when finished.
preDownload(starMadeInstallerURL,starMadeInstallerFile); // When setting the install path for StarMade, we should have handled the terms and conditions, so it should be ok to download it.
asyncOperation("end");


// ### Sync downloads/installs ### -- When async installs/downloads are finished, this function will be called.
async function installDepsSync() {
  // ### Only syncronous installs here ### e.g. await installRoutine();
  await smInstallHelpers.spawnStarMadeInstallTo(settings["starMadeFolder"],starMadeInstallerFile); // Does not create config files upon install.
  await smInstallHelpers.verifyInstall(settings["starMadeFolder"]); // Creates config files if they don't exist
  var superAdminPassword = await getSuperAdminPassword(settings["starMadeFolder"]); // Check the super admin password and set up if not configured.
  console.debug("Using superAdminPassword: " + superAdminPassword); // Temporary, just for testing.  We don't want to print this to the screen normally.

  console.log("About to start server..");
  await sleepSync(pauseBeforeStartingServer);
  // ### Unimportant Async downloads/installs ### -- These should not be required by the server to run, but they may have depended on the first async install or sync installs before they could be run.
  // None right now

  // Signal ready to start the server
  eventEmitter.emit('ready');
}
