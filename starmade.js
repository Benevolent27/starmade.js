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
const events = require('events');
const spawn  = require('child_process').spawn;
const child  = require('child_process');
const path   = require('path'); // This is needed to build file and directory paths that will work in windows or linux or macosx.  For example, The / character is used in linu, but windows uses \ characters.  Windows also uses hard drive characters, wherease linux has mount points.  For example, in linux a path looks like "/path/to/somewhere", but in windows it looks like "c:\path\to\somewhere".  The path module takes care of this for us to build the path correctly.
// const stream   = require('stream'); // For creating streams.  Not used right now but may be later.

// ### Main Vars ### - Don't change these
var mainFolder      = path.dirname(require.main.filename); // This is where the starmade.js is.  I use this method instead of __filename because starmade.js might load itself or be started from another script
var binFolder       = path.join(mainFolder,"bin");
var modFolder       = path.join(mainFolder,"mods");
var operations      = 0;
var includePatterns = [];
var excludePatterns = [];
var serversRunning  = 0; // This is to count the server's running to manage the exit function and kill them when this main script dies.
var lockFileObj = { // This will be used for the lock file, so if another instance of the script runs, it can parse the file and check PIDs, making decisions on what to do.
  "mainPID": process.pid,
  "serverSpawnPIDs": []
}
console.debug=function (vals,sleepTime) { // for only displaying text when the -debug flag is set.  sleepTime is optional.
  if (debug==true){
    console.log(vals);
    if (sleepTime){
      sleep(sleepTime);
    }
  }
}

// #######################
// ### SCRIPT REQUIRES ###
// #######################
// path.resolve below builds the full path to "./bin/setSettings.js" in such a way that is compatible with both windows and linux/macosx, since it doesn't use / or \ characters.
var setSettings = require(path.join(binFolder, "setSettings.js")); // This will confirm the settings.json file is created and the install folder is set up.
var installAndRequire = require(path.join(binFolder, "installAndRequire.js")); // This is used to install missing NPM modules and then require them without messing up the require cache with modules not found (which blocks requiring them till an app restart).
var mySleep = require(path.join(binFolder, "mySleep.js")); // Only accurate for 100ms or higher wait times.
function sleep(ms){
  console.debug("Sleeping for " + ms + " milliseconds..");
  if (ms){
    if (isNaN(parseInt(ms))){
        console.error("ERROR: Invalid parameter passed to sleep function: " + ms);
    } else {
      mySleep(parseInt(ms));
    }
  } else {
    console.error("ERROR: No parameter passed to sleep function!");
  }
}

// #################################
// ### NPM DOWNLOADABLE REQUIRES ###
// #################################
const makeDir=installAndRequire('make-dir'); // https://www.npmjs.com/package/make-dir This allows creating folders recursively if they do not exist, with either async or sync functionality.
const treeKill=installAndRequire('tree-kill'); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes
const ini = installAndRequire('ini'); // https://www.npmjs.com/package/ini Imports ini files as objects.  It's a bit wonky with # style comments (in that it removes them and all text that follows) and leaves // type comments, so I created some scripting to modify how it loads ini files and also created some functions to handle comments.
const prompt = installAndRequire("prompt-sync")({"sigint":true}); // https://www.npmjs.com/package/prompt-sync This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
const Tail = installAndRequire('tail').Tail; // https://github.com/lucagrulla/node-tail/blob/master/README.md For following the server log.  I forgot that the console output does NOT have everything.  This is NOT a perfect solution because whenever file rotation occurs, there is a 1 second gap in coverage.  Argh.
const exitHook = installAndRequire('exit-hook'); // https://github.com/sindresorhus/exit-hook Handles normal shutdowns, sigterm, sigint, and a "message=shutdown" event.  Good for ensuring the server gets shutdown.

// Possible Future requires:
// const decache = installAndRequire("decache"); // https://www.npmjs.com/package/decache - This is used to reload requires, such as reloading a json file or mod without having to restart the scripting.
// const express = installAndRequire('express'); // https://www.npmjs.com/package/express Incredibly useful tool for serving web requests
// const expressIpfilter = installAndRequire('express-ipfilter') // https://www.npmjs.com/package/express-ipfilter - This will be used to restrict only local IP's to access the RESTFul API, which is what other scripts will use to remote control this
// const targz = installAndRequire('tar.gz'); // https://www.npmjs.com/package/tar.gz2 For gunzipping files,folders, and streams (including download streams)
// const blessed = installAndRequire('blessed'); // https://www.npmjs.com/package/blessed Awesome terminal screen with boxes and all sorts of interesting things.  See here for examples:  https://github.com/yaronn/blessed-contrib/blob/master/README.md

// Unused but might be brought back:
// const sleepTest=installAndRequire('thread-sleep'); // This might be ok if the solution I came up with doesn't work well enough. It doesn't require a C++ compiler to be installed.  It might be mostly accurate, but the idea of compiling some C++ script just for sleep seems to be bit muuch to me. The sleep function I created uses spawnSync to introduce a sleep that can also block exit functions, which is what I needed.  This require apparently does not block exit functions, which might actually be needed later.
// function sleep(ms){
//   console.debug("Sleeping for " + ms + " milliseconds..");
//   if (ms){
//     if (isNaN(parseInt(ms))){
//         console.error("ERROR: Invalid parameter passed to sleep function: " + ms);
//     } else {
//       sleepTest(parseInt(ms));
//     }
//   } else {
//     console.error("ERROR: No parameter passed to sleep function!");
//   }
// }

// Unused Requires:
// const sleep=installAndRequire('system-sleep');  // https://github.com/jochemstoel/nodejs-system-sleep Allows sleeping WITHOUT using 100% of CPU ---  Disabled because it has no license, which means it defaults to "full rights reserved", which means the code cannot be used, linked to, or included in any way
// const deasync=installAndRequire('deasync'); // Not used because it requires a C++ compiler to be installed to work (node-gyp), to compile some C++ file to do the actual sleeping - This is also what system-sleep uses as it's basis but it actually has a sleep function built in AND has a MIT license, so we'd be good with that.  This can also be used to turn async functions and processes into sync ones.  Too bad about the compiler requirement..  https://www.npmjs.com/package/deasync
// const deasync-promise=installAndRequire('deasync-promise'); // IMPORTANT:  See above -- This can make working with promises a lot easier by making them syncronous.  Just keep in MIND that we don't want to use this unless it's in the startup routine where things MUST BE syncronous.  https://www.npmjs.com/package/deasync-promise


// ### Setting up submodules from requires.
var eventEmitter = new events.EventEmitter(); // This is for custom events

// #####################
// ###    SETTINGS   ###
// #####################
var lockFile                  = path.join(mainFolder,"server.lck");
var showStderr                = true;
var showStdout                = true;
var showServerlog             = true;
var showAllEvents             = false;
var enumerateEventArguments   = false;
var pauseBeforeStartingServer = "2000"; // Default: 2 - After any sort of installs, config verifications, etc, how long should we wait before pulling the trigger on the server spawn in ms?
var settingsFile              = path.join(mainFolder, "settings.json");
var settings                  = setSettings(); // Import settings, including the starmade folder, min and max java settings, etc.  If the settings.json file does not exist, it will set it up.
var starNetJarURL             = "http://files.star-made.org/StarNet.jar";
var starMadeInstallFolder     = path.join(settings["starMadeFolder"],"StarMade");
var starMadeJar               = path.join(starMadeInstallFolder,"StarMade.jar");
var starNetJar                = path.join(binFolder,"StarNet.jar");
var starMadeServerConfigFile  = path.join(starMadeInstallFolder,"server.cfg");
var serverCfg                 = {}; // getIniFileAsObj('./server.cfg'); // I'm only declaring an empty array here initially because we don't want to try and load it till we are sure the install has been completed
var forceStart                = false; // Having this set to true will make the script kill any existing scripts and servers and then start with no prompt.
var ignoreLockFile            = false;
var debug                     = false;
var os                        = process.platform;
var starMadeStarter;
// TODO: Fix this to use the .exe file properly when doing installs.  Sure the Jar works, but might be a bad idea for some reason.
// if (os=="win32"){
//   starMadeStarter="StarMade-Starter.exe";
// } else {
  starMadeStarter="StarMade-Starter.jar"; // This handles linux and macOSX
// }
var starMadeInstaller = path.join(binFolder,starMadeStarter);
var starMadeInstallerURL = "http://files.star-made.org/" + starMadeStarter;
// Windows: http://files.star-made.org/StarMade-starter.exe // Does not seem to actually work correctly with spawnSync and the -nogui option on windows.. Using the linux/macOSX jar installer does though!  wtf!
// macosx: http://files.star-made.org/StarMade-Starter.jar
// Linux: http://files.star-made.org/StarMade-Starter.jar



// ###########################
// ### Object Constructors ###
// ###########################
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
    this.receiver=receiver;
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
    this.factionNumber=channelName.match(getFactionNumber);
  } else {
    this.type="named";
  }
  this.name=channelName;
}

function PlayerObj(playerName){
  if (playerName){
    this.name=playerName;
    // TODO: Add methods for
    // smName
    // ip
    // faction
    // currentEntity
  } else {
    throw new Error("ERROR: No playername provided to playerObj constructor!");
  }
}

function EntityObj(uid){
  // This should build the entity object based on the UID, adding the entity type if necessary to build the full UID
  if (uid){
    this.UID=uid;
    this.fullUID=uid;
  } else {
    throw new Error("ERROR: No UID provided to EntityObj constructor!");
  }
}
function FactionObj(factionNumber){
  this.number=factionNumber;
}
function SectorObj(x,y,z){
  this.x=x;
  this.y=y;
  this.y=z;
  this.coords=new CoordsObj(x,y,z);
}
function CoordsObj(x,y,z){
  this.x=x;
  this.y=y;
  this.z=z;
}

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
    argumentRoot=argumentsPassed[i].match(/^-[a-zA-Z]*/).toString().toLowerCase();
    console.log("Test result: " + argumentsPassed[i].indexOf("="));
    if (argumentsPassed[i].indexOf("=") == -1){
      argumentEqual=null;
      argumentEqualLower=null;
    } else {
      argumentEqual=argumentsPassed[i].match(/[^=]*$/).toString();
      argumentEqualLower=argumentEqual.toLowerCase();
    }
    if (argumentRoot == "-forcestart"){
      if (argumentEqualLower == "true" || !argumentEqualLower){
        forceStart=true;
      } else if (argumentEqualLower == "false"){
        forceStart=false;
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


// ########################
// ### Smart Lock Check ###
// ########################
if (fs.existsSync(lockFile) && ignoreLockFile == false){
  //todo if the lock file exists, we need to grab the PID from the file and see if the server is running.  If not, then we can safely remove the lock file, otherwise end with an error.
  console.log("Existing Lock file found! Parsing to determine if server is still running..");
  var response;
  var lockFileContents=fs.readFileSync(lockFile);
  var lockFileObject=JSON.parse(lockFileContents);
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
          waitAndThenKill(300000,lockFileObject["mainPID"]);
          sleep(1000); // Give the sigKILL time to complete if it was necessary.
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
    var serverPIDS=lockFileObject["serverSpawnPIDs"];
      if (serverPIDS){
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
              waitAndThenKill(300,serverPIDS[i]);
              sleep(1000); // Giving the SIGKILL time to complete.
              // We should initiate a loop giving up to 5 minutes for it to shut down before sending a sig-kill.
            } else {
              console.log("Alrighty then, I'll just let it keep running.")
            }
          } else {
            console.log("Verified that server PID, '" + serverPIDS[i] + "' was not running!");
          }
        }
      }
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
      console.log("server.lck went poof on it's own!  Wonderful! Contining..");
    }
    sleep(2000);
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

function isPidAlive(thePID){
  try {
    process.kill(thePID,0);
    return true;
  } catch (err) {
    return false;
  }
}


// #####################
// ###    PATTERNS   ###
// #####################
// Patterns - This will be to detect things like connections, deaths, etc.  I'm pushing to an array so it's easier to add or remove patterns.

// Include Patterns
includePatterns.push("^\\[SERVER\\] MAIN CORE STARTED DESTRUCTION"); // This is for ship overheats.  It was implemented with systems 2.0, but it's bugged.  It fires off not only when ships overheat but also when they are destroyed.
includePatterns.push("^\\[SERVER\\]\\[SPAWN\\]");
includePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\]"); // Player disconnects
includePatterns.push("^\\[PLAYER\\]\\[DEATH\\]");
includePatterns.push("^\\[SERVER\\] PlS\\[");
includePatterns.push("^\\[SERVER\\]\\[PLAYERMESSAGE\\]");
includePatterns.push("^\\[CHANNELROUTER\\]"); // These are messages sent from players
includePatterns.push("^\\[SERVER\\] Object Ship\\[");
includePatterns.push("^\\[CHARACTER\\]\\[GRAVITY\\] # This is the main gravity change");
includePatterns.push("^PlayerCharacter\\["); // # This handles killing creatures as a player as well as some wonky gravity changes.  I need to compare this to the main gravity changes to see if I should utilize it or not for that.
includePatterns.push("^Ship\\[ "); // # This handles killing NPC creatures from a ship and possibly other things.. but I haven't seen anything else in the logs to indicate the "other things"
includePatterns.push("^SpaceStation\\["); // # This handles killing NPC creatures from a station
includePatterns.push("^AICharacter\\["); // # This handles NPC creature deaths from other NPC characters
includePatterns.push("^Sector\\["); // # This handles NPC creature deaths via black hole or star damage
includePatterns.push("^Planet[(]"); // # This handles NPC creature death via planet
includePatterns.push("^ManagedAsteroid[(]"); // This handles NPC creature deaths via asteroids that have been modified in some way
includePatterns.push("^\\[DEATH\\]");
includePatterns.push("^\\[SPAWN\\]");
includePatterns.push("^\\[BLUEPRINT\\]"); // Blueprint spawns, including admin spawns.  They can be separated.
includePatterns.push("^\\[SEGMENTCONTROLLER\\] ENTITY");
includePatterns.push("^\\[FACTION\\]");
includePatterns.push("^\\[FACTIONMANAGER\\]");
includePatterns.push("^\\[SHUTDOWN\\]");  // When the server shuts down naturally

// Exclude Patterns
excludePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'null'"); // These spam all over the damn place so we want to filter them out.
excludePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'Info-Pinger \\(server-lists\\)'"); // Every time someone refreshes their server list from the main menu of the game, all servers have a message on their console.
excludePatterns.push(".*Narrowphase of Sector.*");
excludePatterns.push("^\\[BLUEPRINT\\]\\[SPAWNINDB\\]");

// Event found!: Sector[24](2, 2, 1) Narrowphase of Sector[24](2, 2, 1) took: 40; Objects in physics context: 8Arguments: 1



// Build the regex patterns into compact patterns.
var includePatternRegexTemp="(" + includePatterns[0];
for (var i=1;i<includePatterns.length;i++){ includePatternRegexTemp+="|" + includePatterns[i]; }
includePatternRegexTemp+=")"
var includePatternRegex=new RegExp(includePatternRegexTemp);
// console.log("includePatternRegex: " + includePatternRegex + "\n");
console.log("Include patterns loaded.");
var excludePatternRegexTemp="(" + excludePatterns[0];
for (let i=1;i<excludePatterns.length;i++){ excludePatternRegexTemp+="|" + excludePatterns[i]; }
//for (let e=1;e<excludePatterns.length;e++){ excludePatternRegexTemp+="|" + excludePatterns[e]; }
excludePatternRegexTemp+=")"
var excludePatternRegex=new RegExp(excludePatternRegexTemp);
// console.log("excludePatternRegex: " + excludePatternRegex + "\n");
console.log("Exclude patterns loaded.");

// console.log("Settings set: " + JSON.stringify(settings));

// Obsolete - This section was originally to load the settings.json file and use "default" values just for testing, this has been replaced by the setSettings.js scripting.
// try {
//   settings = require("./settings.json");
//   console.log("Imported settings values from settings.json.");
// } catch (ex) {
//     console.log("Settings.json file not found! Using default values");
//     settings = { // This is a temporary fallback during testing.  In the future if there is no settings.json file, we'll run an install routine instead to set the values and write the file.
//       "starMadeFolder": "/home/philip/Programs/StarMade/",
//       "javaMin": "128m",
//       "javaMax": "1024m",
//       "port": "4242"
//     };
// }

// Where is an existing StarMade folder
// What port would you like to use?  (Default 4242):

// Verify that all values are present and give an error if not enough settings are present.
if (!settings.hasOwnProperty('starMadeFolder') ||
  !settings.hasOwnProperty('javaMin') ||
  !settings.hasOwnProperty('javaMax') ||
  !settings.hasOwnProperty('port')){
    console.error("ERROR: settings.json file did not contain needed configuration options!  Exiting!");
    exitNow(2);
  }

// #########################
// ###    SERVER START   ###
// #########################
eventEmitter.on('ready', function() { // This won't fire off yet, it's just being declared so later on in the script it can be started.  I can modify this later if I want to allow more than one instance to be ran at a time.
  console.log("Starting server..");

  // #####  PLAYER MESSAGES  #####
  eventEmitter.on('message', function(message) { // Handle messages sent from players
    // Expects message to be a message type object
    console.log("Message (type: " + message.type +") DETECTED from " + message.sender.name + " to " + message.receiver.name + ": " + message.text);
    if (message.text == settings["commandOperator"] + "command" ){
      console.log("!command found bitches!");
      let mMessage="/server_message_to plain " + message.sender.name + " 'Melvin: What the fack do you want?'";
      server.stdin.write(mMessage.toString().trim() + "\n");
      // server.stdin.end();
    }
  });

  eventEmitter.on('playerSpawn', function(playerSpawn) {
    console.log("playerSpawn detected.");
    let mMessage="/server_message_to plain " + playerSpawn.playerName + " 'Melvin: Well hello there, " + playerSpawn.playerName + "!  Thanks for spawning in!'";
    server.stdin.write(mMessage.toString().trim() + "\n");
  });
  eventEmitter.on('shipSpawn', function(shipSpawn) {
    console.log("shipSpawn detected.");
    let mMessage="/server_message_to plain " + shipSpawn.playerName + " 'Melvin: THAT is one nice ship: " + shipSpawn.shipName + "'";
    server.stdin.write(mMessage.toString().trim() + "\n");
  });
  eventEmitter.on('baseSpawn', function(baseSpawn) {
    console.log("baseSpawn detected.");
    let mMessage="/server_message_to plain " + baseSpawn.playerName + " 'Melvin: Cool new base dude! " + baseSpawn.baseName + "'";
    server.stdin.write(mMessage.toString().trim() + "\n");
  });


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
    console.debug("Starting server with arguments: " + javaArgs,2000);
    var server;
    // if (os == "win32"){
    //   server = spawn("java", ["-Xms" + settings["javaMin"], "-Xmx" + settings["javaMax"],"-Xincgc","-Xshare:off","-jar", starMadeJar,"-server", "-port:" + settings["port"]], {"cwd": starMadeInstallFolder});
    // } else {
    //   server = spawn("java", ["-Xms" + settings["javaMin"], "-Xmx" + settings["javaMax"],"-jar", starMadeJar,"-server", "-port:" + settings["port"]], {"cwd": starMadeInstallFolder});
    // }
    server = spawn("java",javaArgs,{"cwd": starMadeInstallFolder});
  } catch (err) { // This does NOT handle errors returned by the spawn process.  This only handles errors actually spawning the process in the first place, such as if we type "javaBlah" instead of "java".  Cannot run "javaBlah" since it doesn't exist.
    console.error("ERROR: Could not spawn server!")
    if (err.message) { console.error("Error Message: " + err.message.toString()); }
    if (err.code) { console.error("Error Code: " + err.code.toString()); }
    exitNow(130);
  }
  var tailOptions = {
    "fsWatchOptions": {"persistent": false},
    "follow": true
  };
  touch(path.join(starMadeInstallFolder,"logs","serverlog.0.log")); // Ensure the file exists before we tail it.
  var serverTail = new Tail(path.join(starMadeInstallFolder,"logs","serverlog.0.log"),tailOptions);

  addServerPID(server.pid); // Adds the PID to the lockfile PID tracker for servers and writes the file
  serversRunning++; // Increment the number of servers running.
  console.log('Spawned server process with PID:' + server.pid);

  // ####################
  // ###    WRAPPER   ###
  // ####################

  function processDataInput(dataInput){ // This function is run on every single line that is output by the server console.
    if (testMatch(dataInput)) { // Check to see if the message fits any of the regex patterns
      if (showAllEvents == true) {
        console.log("Event found!: " + dataInput + "Arguments: " + arguments.length);
      }
      let theArguments=arguments[0].split(" "); // This is to allow easier parsing of each individual word in the line
      if (enumerateEventArguments == true){
        for (let i=0;i<theArguments.length;i++){ console.log("theArguments[" + i + "]: " + theArguments[i]); }
      }
      // ### Player Messages ###
      if (theArguments[0] == "[CHANNELROUTER]"){ // This is for all messages, including commands.
        // I know this is a super messy way of processing the text.  I was stringing them along in 1 line apiece, but ESLint was yelling at me.  Here's some more ways to do it:  https://stackoverflow.com/questions/4092325/how-to-remove-part-of-a-string-before-a-in-javascript
        // let sender            = dataInput.match(/sender=[A-Za-z0-9_-]*/).toString();
        // let senderArray       = sender.split("=");
        // sender                = senderArray.pop();

        let sender            = dataInput.match(/sender=[A-Za-z0-9_-]*/).toString().split("=").pop();
        // let senderArray       = sender.split("=");
        // sender                = senderArray.pop();
        let receiver          = dataInput.match(/\[receiver=[A-Za-z0-9_-]*/).toString();
        let receiverArray     = receiver.split("=");
        receiver              = receiverArray.pop();
        let receiverType      = dataInput.match(/\[receiverType=[A-Za-z0-9_-]*/).toString();
        let receiverTypeArray = receiverType.split("=");
        receiverType          = receiverTypeArray.pop();
        let message           = dataInput.match(/\[message=.*\]$/).toString();
        let messageArray      = message.split("=");
        message               = messageArray.pop();
        messageArray          = message.split("");
        messageArray.pop();
        message=messageArray.join("");
        //arguments[0]: [CHANNELROUTER] RECEIVED MESSAGE ON Server(0): [CHAT][sender=Benevolent27][receiverType=CHANNEL][receiver=all][message=words]
        console.log("Message found: ");
        console.log("sender: " + sender);
        console.log("receiver: " + receiver);
        console.log("receiverType: " + receiverType);
        console.log("message: " + message);
        eventEmitter.emit('message',new MessageObj(sender,receiver,receiverType,message));

      } else if (theArguments[0] == "[SERVER][SPAWN]" ) { // Player Spawns


          // Event found!: [SERVER][SPAWN] SPAWNING NEW CHARACTER FOR PlS[Benevolent27 ; id(2)(1)f(0)]Arguments: 1
          // theArguments[0]: [SERVER][SPAWN]
          // theArguments[1]: SPAWNING
          // theArguments[2]: NEW
          // theArguments[3]: CHARACTER
          // theArguments[4]: FOR
          // theArguments[5]: PlS[Benevolent27
          // theArguments[6]: ;
          // theArguments[7]: id(2)(1)f(0)]


        console.log("Parsing possible player spawn.  theArguments[5]: " + theArguments[5].toString());
        if (/PlS\[.*/.test(theArguments[5].toString())){
          let playerName=theArguments[5].split("[").pop();
          if (playerName) {
            console.log("Player Spawned: " + playerName);
            if (settings["announceSpawnsToMainChat"] == "true") {
              let mMessage="/server_message_broadcast plain " + "'" + playerName + " has spawned.'";
              server.stdin.write(mMessage.toString().trim() + "\n");
            }
            let playerObj={
              "playerName": playerName,
              "spawnTime": Math.floor(new Date() / 1000)
            }
            eventEmitter.emit('playerSpawn',playerObj);
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



      } else if (theArguments[0] == "[SPAWN]") { // New Ship or Base Creation
        // Event found!: [SERVER] Object Ship[Benevolent27_1523387756157](1447) didn't have a db entry yet. Creating entry!Arguments: 1
        console.log("Parsing possible ship or base spawn.");
        var playerName=theArguments[1];
        // var shipName=arguments[0].match(/spawned new ship: "[0-9a-zA-Z _-]*/);
        var shipName=arguments[0].match(/spawned new ship: ["][0-9a-zA-Z _-]*/);
        if (shipName){
          console.log("Temp shipName: " + shipName);
          shipName=shipName.toString().replace(/^spawned new ship: ["]/,'');
          // shipName=shipName.toString().split(":").pop();
          console.log("Temp shipName: " + shipName);
          let shipObj={
            "playerName": playerName,
            "shipName": shipName,
            "spawnTime" : Math.floor(new Date() / 1000)
          }
          eventEmitter.emit('shipSpawn',shipObj);
        } else {
          // var baseName=arguments[0].match(/spawned new station: "[0-9a-zA-Z _-]*/);
          var baseName=arguments[0].match(/spawned new station: ["][0-9a-zA-Z _-]*/);
          if (baseName){
            // baseName=baseName.split(":").pop();
            baseName=baseName.toString().replace(/^spawned new station: ["]/,'');

            // baseNameArray=baseName.split()
            let baseObj={
              "playerName": playerName,
              "baseName": baseName,
              "spawnTime" : Math.floor(new Date() / 1000)
            }
            eventEmitter.emit('baseSpawn',baseObj);
          }
        }
      } else if (theArguments[0] == /\[BLUEPRINT\].*/) { // Various Blueprint events
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

          console.log("Some blueprint buy event happened.");
        } else if (theArguments[0] == "[BLUEPRINT][LOAD]"){ // New ship from load - possibly /spawn_mobs command
          console.log("Some blueprint load event happened.");
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

      }
    }
  }

  server.stdout.on('data', function (data) { // Displays the standard output from the starmade server
    let dataString=data.toString().trim(); // Clear out any blank lines
    if (dataString){
      if (showStdout == true) {
        console.log("stdout: " + dataString);
      }
      processDataInput(dataString); // Process the line to see if it matches any events
    }
  });

  server.stderr.on('data', function (data) { // Displays the error output from the starmade server
    let dataString=data.toString().trim(); // Clear out any blank lines
    if (dataString){
      if (showStderr == true) {
        console.log("stderr: " + dataString);
      }
      processDataInput(dataString); // Process the line to see if it matches any events
    }
  });

  serverTail.on('line', function(data) {
    // let dataString=data.toString().trim().replace(/^\[[^\[]*\] */,'');
    let dataString=data.toString().trim().replace(/^\[[^[]*\] */,''); // Trying to fix ESLinter error
    if (dataString){
      // sed 's/^\[[^\[]*\][[:blank:]]*//g'
      if (showServerlog == true ) {
        console.log("serverlog: " + dataString);
      }
      processDataInput(dataString);
    }

  });

  process.on('exit', function() { // This is scoped so that it can terminate the starmade server when the main script ends.
    // This should kill the server, but ONLY if there is a server running.
    console.log("Scoped exit event running..");
    if (serversRunning>0){
      // Kill the processes, including all decendent processes.  For example, if we set the starmade server to actually be a script, then this will kill the script + the server.
      if (server.pid){
        console.log("Killing server PID, '" + server.pid + "' and all process descendants.");
        treeKill(server.pid, 'SIGTERM');
      }
      // We don't decrement the serversRunning value, because the "exit" event for the server process should do it.
    }
  });

  server.on('exit', function (code) { // This handles When the server child process ends, abormally or not.
    serversRunning--;
    delServerPID(server.pid); // This updates the lock file
    if (code){
      if (code.message){
          console.log('Server instance exited with message: ' + code.message.toString());
      }
      console.log('Server instance exited with code: ' + code.toString());
    }
    serverTail.unwatch();
    exitNow(code); // This is temporary, we don't necessarily want to kill the wrapper when the process dies.  For example, maybe we want to respawn it?  Ya know?!
  });
  server.on('error', function (code) {
    // This runs is the java process could not start for some reason.
    console.error("ERROR:  Could not launch server process!")
    if (code.message){
        console.log('Error Message: ' + code.message.toString());
    }
    console.log('Exit code: ' + code.toString());
    exitNow(code); // This is temporary, we don't necessarily want to kill the wrapper when the process dies.
  });


  server.on('message', function(text) {
    console.log("Message found: " + text);
  });

  // server.stdin.setEncoding('utf-8');
  // process.stdin.pipe(server.stdin);
  // server.stdin.pipe(process.stdin);



  // #######################################
  // ###    COMMAND LINE WRAPPER START   ###
  // #######################################
  // This will process user input at the console and either direct it to the server process or parse it as a command.
  process.stdin.on('data', function(text){
    let theText=text.toString().trim();
    if (theText[0] == "!"){
      let theArguments = theText.split(" +"); // Split with the + symbol so it splits by any amount of spaces
      let theCommand   = theArguments.shift().toLowerCase();
      let tempArray    = theCommand.split("")
      tempArray.shift();
      theCommand=tempArray.join("");
      console.log("Wrapper command detected: " + theCommand)
      console.log("Full: " + theText);

      if (theCommand == "help" ) {
        console.log("Here are the current console commands:");
        console.log(" !stdout [on/off]");
        console.log(" !stderr [on/off]");
        console.log(" !serverlog [on/off]");
        console.log(" !enumerateevents [on/off]");
        console.log(" !showallevents [on/off]");
        console.log(" !settings list");
        console.log(" !changesetting [setting] [newvalue]");

      } else if (theCommand == "stdout" ) {
        if (theArguments[0] == "on"){
          console.log("Setting stdout to true!");
          showStdout=true;
        } else if (theArguments[0] == "off"){
          console.log("Setting showStdout to false!");
          showStdout=false;
        } else {
          console.log("Invalid parameter.  Usage:  !stdout on/off")
        }
      } else if (theCommand == "stderr" ) {
        if (theArguments[0] == "on"){
          console.log("Setting showStderr to true!");
          showStderr=true;
        } else if (theArguments[0] == "off"){
          console.log("Setting Stderr to false!");
          showStderr=false;
        }
      } else if (theCommand == "serverlog" ) {
        if (theArguments[0] == "on"){
          console.log("Setting showServerlog to true!");
          showServerlog=true;
        } else if (theArguments[0] == "off"){
          console.log("Setting showServerlog to false!");
          showServerlog=false;
        }
      } else if (theCommand == "enumerateevents" ) {
        if (theArguments[0] == "on"){
          console.log("Setting enumerateEventArguments to true!");
          enumerateEventArguments=true;
        } else if (theArguments[0] == "off"){
          console.log("Setting enumerateEventArguments to false!");
          enumerateEventArguments=false;
        }
      } else if (theCommand == "showallevents" ) {
        if (theArguments[0] == "on"){
          console.log("Setting showAllEvents to true!");
          showAllEvents=true;
        } else if (theArguments[0] == "off"){
          console.log("Setting showAllEvents to false!");
          showAllEvents=false;
        }
      } else if (theCommand == "settings") {
        if (theArguments[0] == "list"){
          // const copy = Object.create(Object.getPrototypeOf(settings));
          console.log("\nHere are your current settings:")
          const propNames = Object.getOwnPropertyNames(settings);
          propNames.forEach(function(name){
            // console.log("Setting: " + name + " Value: " + Object.getOwnPropertyDescriptor(settings, name));
            if (name != "smTermsAgreedTo"){ console.log(" " + name + ": " + settings[name]); }
          });
          console.log("\nIf you would like to change a setting, try !changesetting [SettingName] [NewValue]");
        }
      } else if (theCommand == "changesetting") {
        var showUsage = function(){ console.log("Usage: !changeSetting [Property] [NewValue]"); }; // Ignore this ESLinter warning, I WANT this to be scoped how it is, I do NOT want to declare with function which will give it a wider scope
        if (theArguments[0]){
          // console.log("Result of checking hasOwnProperty with " + theArguments[0] + ": " + settings.hasOwnProperty(theArguments[0]));
          if (settings.hasOwnProperty(theArguments[0])){

            let oldSettings=copyObj(settings);
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
              showUsage();
            }
          } else {
            console.log("ERROR:  Cannot change setting, '" + theArguments[0] + "'! No such setting: ");
          }
        } else {
          console.log("ERROR:  Please provide a setting to change!");
          showUsage();
        }
      }
    } else {
      console.log("Running Command: " + theText);
      server.stdin.write(theText + "\n");
      // server.stdin.write(text.toString() + "\n");
      // server.stdin.end();
    }
  });

  // This is great to have all the info show on the screen, but how does one turn off a pipe? No idea.  I'll use events instead.
  // server.stdout.pipe(process.stdout);
  // server.stderr.pipe(process.stdout);

  // var stdinStream = new stream.Readable();

});

// #####################
// ###   EMITTERS   ####
// #####################
eventEmitter.on('asyncDone', installDepsSync);

// ####################
// ###  FUNCTIONS  ####
// ####################

// ### INI Stuff ### -- These are helper functions for the Ini NPM package to ensure compatibility with StarMade's ini files
// Note: in-place comments like /* whatever */ are not supported right now and are annoying and these need to die.
function getIniFileAsObj(iniFile){ // This loads an ini file as an object
  return ini.parse(fs.readFileSync(iniFile, 'utf-8' ).replace(/[#]/g,"\\#")); // We need to escape the # characters because otherwise the ini.parse removes them and all text that happens after them.. Annoying if we are preserving the comments!
}
function writeIniObjToIni(theObj,iniFileToWrite){ // This sync writes an ini object to an ini file
  return fs.writeFileSync(iniFileToWrite, ini.stringify(theObj));
}
function removeIniComments(text){ // This removes comments from a string
  return text.match(/^[^/#]*/).toString().trim();
}
function getIniValue(iniObj,variable){ // Rather than using removeIniComments on a specific value, this can be used to pull the value.  This is mostly for readability but also to handle errors.
  if (iniObj && variable){
    // TODO This needs to use typeof to determine that iniObj is, in fact, an object rather than undefined or something else.
    if (iniObj.hasOwnProperty(variable)){
      return removeIniComments(iniObj[variable]);
    } else {
      console.error("ERROR: Invalid variable in Ini object - does not exist!");
      return new Error("ERROR: Invalid variable in Ini object (" + iniObj.constructor.name + ") - does not exist!");
    }
  } else {
    throw new Error("ERROR:  Insufficient parameters given to getIniValue!")
  }
}
function changeIniValue(iniObj,iniVariable,newIniValue){
  // This function will change an ini object's variable to have a new value, preserving comments
  // Example of usage:  changeIniObjValue(iniObject,"theVariable","New Words and such")
  if (typeof iniObj == 'object' && typeof iniVariable == 'string' && typeof newIniValue == 'string'){
    try {
      iniObj[iniVariable]=changeIniValueFromString(iniObj[iniVariable],newIniValue);
      return true;
    } catch (err) {
      console.error("ERROR:  Problem while changing variable of Ini object!");
      return false;
    }
  } else {
    console.error("ERROR: Not enough arguments given to changeIniObjValue!");
    return false
  }
}
function renameIniVariable(iniObj,oldVar,newVar){
  if (typeof iniObj == "object" && typeof oldVar == "string" && typeof newVar == "string"){
    if (oldVar == newVar){
      return false; // Cannot rename because the oldVar is the same as the new!  Not technically an error, but a sloppy call.
    } else if (iniObj.hasOwnProperty(oldVar)){
        iniObj[newVar]=iniObj[oldVar]; // Assign the old variable to the new
        Reflect.deleteProperty(iniObj,oldVar); // Delete the old variable in an ESLinter friendly way
        return true; // Indicate we did something, yay!
    } else {
      return new Error("ERROR: Object did not have property, '" + oldVar + "'!")
    }
  } else {
    return new Error("ERROR: Invalid parameters given to function renameIniVariable!");
  }
}

function getIniComment(iniObj,iniVariable){
  if (typeof iniObj == 'object' && typeof iniVariable == 'string'){
    if (iniObj.hasOwnProperty(iniVariable)){
      return getIniCommentFromString(iniObj[iniVariable]);
    } else {
      return new Error("ERROR: Object, '" + iniObj.constructor.name + "' did not have property, '" + iniVariable + "'!")
    }
  } else {
    return new Error("ERROR: Insufficient parameters given to getIniComment!");
  }
}
function getIniCommentFromString(text,commentSymbols){ // Gets just the comment from a string excerpt from an Ini obj.  Comment symbols are optional.
    var commentSymbolsToUse;
    if (commentSymbols){
      commentSymbolsToUse=commentSymbols;
    } else {
      commentSymbolsToUse=["//","#"]; // By default we are going to be reading from ini files that use // or # as their comments.
    }
    var regexArray=[];
    for (let i=0;i<commentSymbolsToUse.length;i++){
      regexArray.push(new RegExp(" *" + commentSymbolsToUse[i] + "+(.+)")); // Preserves spaces in front of the comment
    }
    var valToBeat="";
    for (let e=0;e<regexArray.length;e++){
      // console.log("Working with regex pattern: " + regexArray[e]);
      if (regexArray[e].exec(text)){
        if (!valToBeat){
          valToBeat=regexArray[e].exec(text)[0];
        } else if (valToBeat.length < regexArray[e].exec(text)[0].length){
          valToBeat=regexArray[e].exec(text)[0];
        }
      }
    }
    return valToBeat;
}
function changeIniValueFromString(stringWComments,newVal){
    // This function takes the existing value + comment, changing the value and returns it with the comment
    if (stringWComments && newVal){
      return newVal + getIniCommentFromString(stringWComments);
    }
    throw new Error("ERROR: Please specify a string from an ini object and a new value to replace the old one with!");
}
// ### end INI STUFF ###


function isAlphaNumeric(testString){
  return "/^[A-Za-z0-9]+$/".test(testString);
}

function getRandomAlphaNumericString(charLength){ // If no charlength given or it is invalid, it will output 10 and throw an error message. // Original code from: https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var outputLength=10;
  if (charLength){
    if (isNaN(parseInt(charLength))){
      console.error("ERROR: Invalid length given to getRandomAlphaNumeric function!  Set to default length of 10.  Here is what as given as input: " + charLength);
    } else {
      outputLength=parseInt(charLength);
    }
  } else {
    console.error("ERROR:  No charLength specified, using default of 10!");
  }
  for (var i = 0;i < outputLength;i++){
    text += possible.charAt(Math.floor(Math.random() * possible.length)).toString();
  }
  return text;
}


// function sleep(ms) { // This will only work within async functions.
//   // Usage: await sleep(ms);
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

function copyObj(obj) { // From:  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
  const copy = Object.create(Object.getPrototypeOf(obj)); // Ignore the ESLint warnings, it really doesn't know what it's talking about.  I looked into it, it's suggesting to use functions of Reflect that don't exist.
  const propNames = Object.getOwnPropertyNames(obj);
  propNames.forEach(function(name) {
    const desc = Object.getOwnPropertyDescriptor(obj, name);
    Object.defineProperty(copy, name, desc);
  });
  return copy;
}

function writeSettings() {
  var settingsFileName=path.basename(settingsFile);
  try {
    var settingsFileStream=fs.createWriteStream(settingsFile);
    settingsFileStream.write(JSON.stringify(settings, null, 4));
    settingsFileStream.end();
    console.log("Updated '" + settingsFileName + "' file.");
  } catch (err) {
    console.error("ERROR: Could not write to the '" + settingsFileName + "' file!");
    throw err;
  }
}


function touch (file){ // This creates an empty file quickly.
  fs.closeSync(fs.openSync(file, 'w'));
}
function simpleDelete (file) { // Simple delete which doesn't resolve paths nor break out of the scripting by throwing an error.  It also does not display anything unless there is an error.
  try {
    fs.unlinkSync(file);
    // console.log("File, , " + file + ", deleted!");
  } catch(err) {
    console.error("File, " + file + ", cannot be deleted.");
  }
}

function ensureDelete (fileToDelete,options){
  // Resolves files to use main script path as root if given relative path.
  // Also throws an error if it cannot delete the file.
  // Default behavior is to be quiet, unless "quiet" is set to "false" from an options object.
  var console={}; // This is to replace the functionality of console, JUST for this function
  if (options) {
    if (options.hasOwnProperty("quiet")){
       if (options.quiet != false) {
         console.log("Setting up scoped console to disable it.");
         console.log=function(){ /* empty on purpose */ };
         console.error=function(){ /* empty on purpose */ };
       }
    }
  } else {
    console.log=function(){ /* empty on purpose */ };
    console.error=function(){ /* empty on purpose */ };
  }
  let resolvedFile = path.resolve(mainFolder,fileToDelete); // This will resolve relative paths back to the main script's root dir as the base
  if (fs.existsSync(resolvedFile)){
    try {
      fs.unlinkSync(resolvedFile);
      console.log("Deleting: " + fileToDelete);
    } catch (err) {
      console.error("ERROR: Could not delete file: " + resolvedFile);
      console.error("Please manually remove this file and ENSURE you have access to delete files at this location!")
      throw err;
    }
  } else {
    console.error("ERROR: Cannot delete file.  File not found: " + resolvedFile);
  }
}

function exitNow(code) {
  console.log("Deleting lock file.");
  simpleDelete(lockFile);
  console.log("Exiting main script with exit code: " + code);
  process.exit(code);
}

function ensureFolderExists (folderPath){ // Returns true if the folder exists or if it can be created and then exists, otherwise throws an error.
  let resolvedFolderPath=path.resolve(folderPath); // Using resolve to ensure the path is specified in the right way for the OS.  Resolve tack on the current working directory to make it a full path if needed, which may NOT be the same as the folder starmade.js is in because this is meant to be a general purpose function and not necessarily tied to the starmade.js script.
  try {
    fs.accessSync(resolvedFolderPath,fs.constants.F_OK);  //  Check if the path can be seen.
      if (fs.statSync(resolvedFolderPath).isFile()) { // Check if it is a file
        let theError = new Error("Cannot create folder!  File already exists at this path!  Please delete or move: '" + resolvedFolderPath);
        throw theError;
      } else if (fs.statSync(resolvedFolderPath).isFIFO()) {
        let theError = new Error("Cannot create folder!  Named Pipe already exists at this path!  Please delete or move: '" + resolvedFolderPath);
        throw theError;
      } else { return true; } // it might be a symlink, but I don't know how to check if it's symlinked to a file or folder, so let's just assume it is fine.
  } catch (err) {
    console.log("Folder not found, creating: " + folderPath);
    try {
      // fs.mkdirSync(folderPath);  // This will only create the folder IF no other folders between need to be created, using the nodejs built in fs.
      makeDir.sync(folderPath); // This will create the folder and any inbetween needed, but requires the make-dir module.
      return true;
    } catch (error) {
      console.error("ERROR: Unable to create folder: " + folderPath);
      throw error; // Forward the error given by makeDir and throw it.
    }
  }
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
  ensureDelete(tempFileToPlace);
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
    ensureFolderExists(baseDirForFile); // ensure the directory the file needs to be placed in exists before trying to write to the file.
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
          throw new Error("Response from HTTP server: " + response.statusMessage);
          // exitNow(5);
        };
      });
      request.on('error', (e) => {
        throw new Error(`problem with request: ${e.message}`);
        // exitNow(4);
      });
    } catch (err) { // If there was any trouble connecting to the server, then hopefully this will catch those errors and exit the wrapper.
      console.log("ERROR:  Failed to download, '" + httpURL + "'!");
      throw err;
      // exitNow(4);
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
  if (includePatternRegex.test(valToCheck)){
    if (!excludePatternRegex.test(valToCheck)){
      return true;
    }
    return false;

  } else {
    return false;
  }
}

function spawnStarMadeInstallTo(pathToInstall,installerJar){  // This always requires the installerJar path because this will be offloaded to a require later.
  try {
    var starMadeInstallFolder=getSMInstallPath(pathToInstall);
  } catch (err) {
    throw new Error("No path to SM install provided!  Cannot spawn server install!");  // This is a bit harsh, but hey we will need to ensure the config files are generated.
  }
  var starMadeJarFile=path.join(starMadeInstallFolder,"StarMade.jar");
  if (fs.existsSync(starMadeJarFile)){ // Check if the starmade jar file exists. Install StarMade to the installer path if not.
    console.log("Found StarMade install at: " + starMadeInstallFolder);
  } else {
    console.log("Spawning StarMade Install to: " + starMadeInstallFolder);
    console.debug("Using Spawner Jar: " + installerJar);
    console.debug("Using CWD: " + pathToInstall);
    var smInstallerProcess=child.spawnSync("java",["-jar",installerJar,"-nogui"],{"cwd": pathToInstall}); // Use pathToInstall because it will create the /StarMade folder.
    console.log("Install PID: " + smInstallerProcess.pid);
    if (smInstallerProcess.status && smInstallerProcess.status != 0){ // Installer exited with a non-zero exit code
      console.error("ERROR: StarMade install failed!  Path: " + starMadeInstallFolder);
      if (smInstallerProcess.signal){  // Installer was killed!
        console.error("ERROR INFO: Install process was killed! Exit code (" + smInstallerProcess.status + ") and signal (" + smInstallerProcess.signal + ")!");
      } else {  // Installer exited on it's own with an error code
        console.error("ERROR INFO: Failed to spawn the StarMade install! Failed with exit code (" + smInstallerProcess.status + ").");
      }
      if (smInstallerProcess.stderr){ console.error("Install Error output: " + smInstallerProcess.stderr); }
      exitNow(35); // Exit the main script, since we cannot run a wrapper without an install.
    } else {
      console.log("Spawned StarMade install successfully to: " + starMadeInstallFolder);
      generateConfigFiles(starMadeInstallFolder); // After every install, we should generate config files/folders.  We don't verify the install because the installation itself should have produced a verified install.
    }
  }
}

function verifyInstall (pathToSMInstall){
  try {
    var pathToUse=getSMInstallPath(pathToSMInstall);
  } catch (err) {
    throw new Error("No path to SM install provided!  Cannot verify install!");  // This is a bit harsh, but hey we will need to ensure the config files are generated.
  }
  var starMadeServerCfg=path.join(pathToUse,"server.cfg");
  console.log("Verifying install..");
  if (fs.existsSync(starMadeServerCfg)){ // Right now our "verification" is pretty simple.  Just check for the server.cfg file.  This can be expanded on later if needed to verify all preloaded configs and needed folders exist.
    console.log("server.cfg file found..")
  } else { // If the install does not verify, then we'll need to repair it.
    generateConfigFiles(pathToUse); // Right now the "repair" is just to generate config files, but later if we have checks to actually verify the install and it's missing things like the StarMade.jar file, we'll need to run a repair install
  }
}

function generateConfigFiles (pathToSMInstall){
  // If StarMAde install files and folders don't exist, we can actually run the StarMade.jar file with an invalid argument and it will generate config files/folders and then exit.
  // IMPORTANT:  This method may not be future-proof!
  try {
    var pathToUse=getSMInstallPath(pathToSMInstall);
  } catch (err) {
    throw new Error("No path to SM install provided!  Cannot generate config files!");  // This is a bit harsh, but hey we will need to ensure the config files are generated.
  }
  var starMadeJarFile=path.join(pathToUse,"StarMade.jar");
  console.log("Generating config files..");
  var createConfigFilesSpawn;
  if (os=="win32"){
    createConfigFilesSpawn=child.spawnSync("java",["-Xincgc","-Xshare:off","-jar",starMadeJarFile,"-nonsense4534"],{"cwd": pathToUse});  // Starting the StarMade.jar file with an invalid argument will generate the config files and then exit with a 0 exit code.  This may very well not be future proof!
  } else {
    createConfigFilesSpawn=child.spawnSync("java",["-jar",starMadeJarFile,"-nonsense4534"],{"cwd": pathToUse});  // Starting the StarMade.jar file with an invalid argument will generate the config files and then exit with a 0 exit code.  This may very well not be future proof!
  }

  console.log("PID: " + createConfigFilesSpawn.pid);
  if (createConfigFilesSpawn.status && createConfigFilesSpawn.status != 0){ // temporary instance of the StarMade.jar with a non-zero exit code.  This might happen if there isn't enough RAM available or some other error when running it.
    console.error("ERROR: Failed to generate config files to folder: " + pathToUse);
    if (createConfigFilesSpawn.signal){  // Instance of StarMade was killed!
      console.error("ERROR INFO: Temporary StarMade Instance killed! Exit code (" + createConfigFilesSpawn.status + ") and signal (" + createConfigFilesSpawn.signal + ").");
    } else {  // Installer exited on it's own with an error code
      console.error("ERROR INFO: Temporary StarMade Instance exited with error code (" + createConfigFilesSpawn.status + ").");
    }
    if (createConfigFilesSpawn.stderr){ console.error("Error output: " + createConfigFilesSpawn.stderr); }
    exitNow(35); // Exit the main script, since we cannot run a wrapper without a valid install.
  } else { console.log("Config files and folders generated successfully to: " + pathToUse); }
}

function getSMInstallPath(thePath){
  if (!thePath) {
    throw new Error("No path provided!"); // It is expected that anywhere this function is used, the error will be handled and a custom error given instead.
  }
  var pathToUse=thePath;
  if (!thePath.match(/StarMade$/)){ // This is to allow the install path OR the full path to the StarMade install folder to be used.
    pathToUse=path.join(thePath, "StarMade");
  }
  return pathToUse;
}

async function getSuperAdminPassword(starMadeInstallPath){ // This will grab the superadmin password, setting it up and enabling it if not already.
  // Load the server.cfg from install path
  var serverCfgFile=path.join(starMadeInstallPath,"StarMade","server.cfg");
  var serverCfgObj=getIniFileAsObj(serverCfgFile);
  var superAdminPassword=removeIniComments(serverCfgObj["SUPER_ADMIN_PASSWORD"]);
  var superAdminPasswordEnabled=removeIniComments(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]);
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
    while (!(newSuperAdminPassword === null || newSuperAdminPassword == "" || isAlphaNumeric(newSuperAdminPassword))) // If a person puts invalid characters in, it'll just keep repeating the prompt.
    if (newSuperAdminPassword === null || newSuperAdminPassword == ""){
      console.log("Excellent choice!  I have set a LONG and nearly impossible to crack SuperAdminPassword for you! :D");
      newSuperAdminPassword = getRandomAlphaNumericString(32);
    } else { console.log("Alrighty then.  I'll just use what you provided!") };
    await sleep(2000);
    // serverCfgObj["SUPER_ADMIN_PASSWORD"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD"],newSuperAdminPassword);
    changeIniValue(serverCfgObj,"SUPER_ADMIN_PASSWORD",newSuperAdminPassword);
    if (superAdminPasswordEnabled == "false") {
      console.log("Super Admin Password was disabled, enabling!");
      // serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"],"true");
      changeIniValue(serverCfgObj,"SUPER_ADMIN_PASSWORD_USE","true");
    }
    writeIniObjToIni(serverCfgObj,serverCfgFile);
  } else if (superAdminPasswordEnabled != "true"){ // Enable super admin password if it was disabled for some reason.
    console.log("Super Admin Password was disabled, enabling!");
    // serverCfgObj["SUPER_ADMIN_PASSWORD_USE"]=keepIniComment(serverCfgObj["SUPER_ADMIN_PASSWORD_USE"],"true");
    changeIniValue(serverCfgObj,"SUPER_ADMIN_PASSWORD_USE","true");
    writeIniObjToIni(serverCfgObj,serverCfgFile);
  }
  return removeIniComments(serverCfgObj["SUPER_ADMIN_PASSWORD"]);
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
  return new Error("No PID given to addServerPID function!");
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
function arrayMinus(theArray,val){ // Returns an array MINUS any values that match val
  if (val && theArray){
    return theArray.filter(function(e){
      return e !== val;
    });
  }
  return new Error("Insufficient parameters given to arrayMinus function!");
}
function writeLockFile(){
  // var lockFileWriteObj = fs.createWriteStream(lockFile);
  // lockFileWriteObj.write(JSON.stringify(lockFileObj));
  // lockFileWriteObj.end();
  console.log("Writing to lock file..");
  fs.writeFileSync(lockFile,JSON.stringify(lockFileObj, null, 4));
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

function waitAndThenKill(mSeconds,thePID,options){ // options are optional.  This can be used on any PID as a sync function
  // By default this will send a SIGKILL signal to the PID if it has not ended within the specified timeout
  // options example:
  // {
  //    interval:'2',
  //    sigType:'SIGTERM'
  // }
  var mSecondsCount=0;
  var intervalVar=1000;
  var sigType="SIGKILL";
  if (mSeconds && thePID){
    if (options){
      if (options.hasOwnProperty("interval")){
        intervalVar=options["interval"];
      }
      if (options.hasOwnProperty("sigType")){
        sigType=options["sigType"];
      }
    }
    if (isPidAlive(thePID)){
      process.stdout.write("\nWaiting for process to die.");
      while (isPidAlive(thePID) && mSecondsCount < mSeconds){
        sleep(intervalVar);
        process.stdout.write(".");
        mSecondsCount+=intervalVar;
      }
      process.stdout.write("\n");
      if (isPidAlive(thePID)){
        console.log("PID (" + thePID + ") still alive after waiting " + mSecondsCount + " milliseconds!  Killing it with: " + sigType);
        process.kill(thePID,sigType);
      } else if (mSecondsCount>0){
          console.log("PID (" + thePID + ") died of natural causes after " + mSecondsCount + " milliseconds.  No need to send a " + sigType + " signal to it.  Phew!");
      } else {
        console.log("PID (" + thePID + ") died of natural causes.  No need to send a " + sigType + " signal to it.  Phew!");
      }
    } else {
      console.log("Process already died on it's own!  GREAT!  :D");
    }
  } else {
    throw new Error("Insufficient parameters given to waitAndThenSigKill function!");
  }
}


// ##########################################
// ###  MAIN SCRIPT EXIT  - GLOBAL SCOPE ####
// ##########################################

exitHook(() => { // This will handle sigint and sigterm exits.
  // Cleanup that needs to be done on the global scope should be done here.
  console.log("Global Exit event running..");
});

// This doesn't handle sigterm or sigint exit codes.
// process.on('exit', function() {
//   // Cleanup that needs to be done on the global scope should be done here.
//   console.log("Global Exit event running..");
// });

// touch(lockFile); // Create an empty lock file.  This is to prevent this script from running multiple times.
writeLockFile(); // This is to prevent this script from running multiple times or starting while another server instance is already running.

// ##############################
// ### CREATE NEEDED FOLDERS  ###
// ##############################

ensureFolderExists(binFolder);
ensureFolderExists(starMadeInstallFolder); // This is redundant to handle if the person deletes or moves their StarMade install folder.

// ###################################
// ### DEPENDENCIES AND DOWNLOADS  ###
// ###################################
// Check for dependencies, such as StarNet.jar and download/install if needed.
// When all dependency downloads/installs are finished, start the server!
console.log("Ensuring all dependencies are downloaded or installed..");

// ### Async downloads/installs that have no dependencies ### -- This sub-section is for all installs/downloads that can be done asynchronously to occur as quickly as possible.
asyncOperation("start"); // This prevents the first async function from starting the wrapper if it finishes before the next one starts.
preDownload(starNetJarURL,starNetJar); // This function handles the asyncronous downloads and starts the sync event when finished.
preDownload(starMadeInstallerURL,starMadeInstaller); // When setting the install path for StarMade, we should have handled the terms and conditions, so it should be ok to download it.
asyncOperation("end");


// ### Sync downloads/installs ### -- When async installs/downloads are finished, this function will be called.
async function installDepsSync() {
  // ### Only syncronous installs here ### e.g. await installRoutine();
  await spawnStarMadeInstallTo(settings["starMadeFolder"],starMadeInstaller);
  await verifyInstall(settings["starMadeFolder"]);
  // Check the super admin password and set up if not configured.
  var superAdminPassword = await getSuperAdminPassword(settings["starMadeFolder"]);
  console.debug("Using superAdminPassword: " + superAdminPassword); // Temporary, just for testing.  We don't want to print this to the screen normally.

  serverCfg = getIniFileAsObj(starMadeServerConfigFile); // Import the server.cfg values to an object.  These should be the final values.  Any settings changes to the file should be completed before this is loaded.  Note that this KEEPS comments in the value!
  // Use Ini functions to handle the the ini object:
  // Get a value + comments: serverCfg["WHATEVER"]
  // Get an individual value WITHOUT comment:  getIniValue(serverCfg,"whatever");
  // Get JUST the comment: getIniComment(servercfg,"whatever");
  // Change an individual value PRESERVING comments: changeIniValue(serverCfg,"Variable","New Value");
  // Rename a Variable: renameIniVariable(serverCfg,"oldVar","newVar");
  // Write ini object to disk: writeObjToIni(serverCfg,starMadeServerCfgFile);

  if (serverCfg){
    console.log("Server config loaded: " + starMadeServerConfigFile);
  }
  console.log("About to start server..");
  await sleep(pauseBeforeStartingServer);
  // ### Unimportant Async downloads/installs ### -- These should not be required by the server to run, but they may have depended on the first async install or sync installs before they could be run.
  // None right now

  // Signal ready to start the server
  eventEmitter.emit('ready');
}
