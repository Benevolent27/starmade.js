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
const path   = require('path'); // This is needed to build file and directory paths that will work in windows or linux or macosx.  For example, The / character is used in linu, but windows uses \ characters.  Windows also uses hard drive characters, wherease linux has mount points.  For example, in linux a path looks like "/path/to/somewhere", but in windows it looks like "c:\path\to\somewhere".  The path module takes care of this for us to build the path correctly.
// const stream   = require('stream'); // For creating streams.  Not used right now but may be later.

// ### Main Vars ### - Don't change these
console.log("Setting main vars..");
var mainFolder      = path.dirname(require.main.filename); // This is where the starmade.js is.  I use this method instead of __filename because starmade.js might load itself or be started from another script
var binFolder       = path.join(mainFolder,"bin");
var modFolder       = path.join(mainFolder,"mods");
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
      sleep(sleepTime);
    }
  }
}

// #######################
// ### SCRIPT REQUIRES ###
// #######################
// path.resolve below builds the full path to "./bin/setSettings.js" in such a way that is compatible with both windows and linux/macosx, since it doesn't use / or \ characters.
console.log("Importing bin scripts..");
const miscHelpers       = require(path.join(binFolder,"miscHelpers.js"));
const requireBin        = miscHelpers["requireBin"]; // Simplifies requiring scripts from the bin folder..yes I am this lazy.
console.log("setSettings..");
const setSettings       = requireBin("setSettings.js"); // This will confirm the settings.json file is created and the install folder is set up.
var settings                  = setSettings(); // Import settings, including the starmade folder, min and max java settings, etc.  If the settings.json file does not exist, it will set it up.

console.log("Loading Objects..");
const objectCreator     = requireBin("objectCreator.js");
const installAndRequire = requireBin("installAndRequire.js"); // This is used to install missing NPM modules and then require them without messing up the require cache with modules not found (which blocks requiring them till an app restart).
const sleep             = requireBin("mySleep.js").softSleep; // Only accurate for 100ms or higher wait times.
const patterns          = requireBin("patterns.js"); // Import the patterns that will be used to match to in-game events like deaths and messages.
// const starNet           = requireBin("starNet.js"); // Performs sql queries and gets back a string result if successful
// const starNetHelper     = requireBin("starNetHelper.js"); // needs testing
// const sqlQuery          = requireBin("sqlQuery.js"); // Will be eliminating this in favor of creating SqlQuery objects.
const ini               = requireBin("iniHelper.js"); // This will replace the current functionality of ini by wrapping it and modifying the ini package so that it works correctly for starmade config files and ini files that use # characters.
const objectHelper      = requireBin("objectHelper.js"); // This includes assistance handling of custom objects and conversions
const regExpHelper      = requireBin("regExpHelper.js"); // Contains common patterns, arrays, and pattern functions needed for the wrapper.
const smInstallHelpers = requireBin("smInstallHelpers.js");

// #################################
// ### NPM DOWNLOADABLE REQUIRES ###
// #################################
console.log("Importing NPM requires, installing if need be..");
const treeKill        = installAndRequire('tree-kill'); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes
// const iniPackage      = installAndRequire('ini'); // https://www.npmjs.com/package/ini Imports ini files as objects.  It's a bit wonky with # style comments (in that it removes them and all text that follows) and leaves // type comments, so I created some scripting to modify how it loads ini files and also created some functions to handle comments.
const prompt          = installAndRequire("prompt-sync")({"sigint":true}); // https://www.npmjs.com/package/prompt-sync This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
const Tail            = installAndRequire('tail').Tail; // https://github.com/lucagrulla/node-tail/blob/master/README.md For following the server log.  I forgot that the console output does NOT have everything.  This is NOT a perfect solution because whenever file rotation occurs, there is a 1 second gap in coverage.  Argh.
const exitHook        = installAndRequire('exit-hook'); // https://github.com/sindresorhus/exit-hook Handles normal shutdowns, sigterm, sigint, and a "message=shutdown" event.  Good for ensuring the server gets shutdown.

// ### Set up submodules and aliases from requires.
var eventEmitter      = new events.EventEmitter(); // This is for custom events
var isPidAlive        = miscHelpers.isPidAlive;


var {isDirectory,getDirectories,isFile,getFiles}=miscHelpers;  // Sets up file handling


// Object aliases
var SqlQueryObj    = objectCreator.SqlQueryObj;
var EntityObj      = objectCreator.EntityObj;
var SectorObj      = objectCreator.SectorObj;
var CoordsObj      = objectCreator.CoordsObj;
var FactionObj     = objectCreator.FactionObj;
var MessageObj     = objectCreator.MessageObj;



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
console.log("Importing settings..");
var starNetJarURL             = "http://files.star-made.org/StarNet.jar";
var starMadeInstallFolder     = path.join(settings["starMadeFolder"],"StarMade");
var starMadeJar               = path.join(starMadeInstallFolder,"StarMade.jar");
var starNetJar                = path.join(binFolder,"StarNet.jar");
var starMadeServerConfigFile  = path.join(starMadeInstallFolder,"server.cfg");
var serverCfg                 = {}; // I'm only declaring an empty array here initially because we don't want to try and load it till we are sure the install has been completed
var forceStart                = false; // Having this set to true will make the script kill any existing scripts and servers and then start without asking the user.
var ignoreLockFile            = false; // If this is set to true, it will behave as though the lock file does not exist, and will replace it when it starts again.  WARNING:  If any servers are running in the background, this will duplicate trying to run the server, which will fail because an existing server might already be running.
var debug                     = false; // This enables debug messages
var os                        = process.platform;
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
var includePatternRegex   = patterns.includes();
var excludePatternRegex   = patterns.excludes();



// New Methods needed:
// factionList() - Returns an array of all the factions as FactionObj's using "/faction_list".  Can be given a server object to run on that instance
// factionlistMembers(FactionNum OR FactionObj) - Returns an array of all the members of a faction as PlayerObj's using "/faction_list_members [FactionNum]"
// setFleetSpeed([ms])- Sets the speed fleets take to cross sector borders when unloaded with "/fleet_speed [ms]"
// setFogOfWar(true/false) - sets fog of war on or off with "/fog_of_war true/false"
// forceSave(TimeInSeconds) - initiates a forcesave with /force_save, TimeInSeconds is optional but it will wait that long before performing the action if specified
// ignoreDockingArea(true/false) - uses /ignore_docking_area true/false
// exportSector(FileToSave,[X,Y,Z]/SectorObj/CoordsObj)
// importSector(ExportFileToUse,[X,Y,Z]/SectorObj/CoordsObj)
// importSectorBulk(bulkExportFile.txt) - Uses a special text file from the starmade directory to import a bunch of sectors

// listAdmins - Returns an array of PlayerObj's for all admins
// listAdminDeniedCommands(playerName/PlayerObj) - Returns an array of all forbidden commands for the admin
// listBannedAccounts - Returns an array of SMNameObj's
// listBannedIPs - Returns an array of IPObj's for banned IP's
// listBannedNames - Returns an array of PlayerObj's for banned names
// ListWhitelistAccounts - Returns an array of SMNameObj's - Uses /list_whitelist_accounts
// ListWhitelistIPs - Returns an array of IPObj's - Uses /list_whitelist_ip
// ListWhitelistNames - Returns an array of PlayerObj's - Uses /list_whitelist_name


// loadSystem([X,Y,Z]/SystemObj/CoordsObj) - Loads an entire system
// loadSector([X,Y,Z]/SystemObj/CoordsObj) - Loads a sector
// loadSectorRange(Radius,startCoords,endCoords) - Loads a sector range with either a radius or using a range between startCoords and endCoords, which can either be arrays with X,Y,Z values or SectorObj's/CoordsObj's
// killPlayer(playerName/PlayerObj) - Uses /kill_character to kill a player

// missileDefenseFriendlyFire(true/false) - Uses /missile_defense_friendly_fire to turn on or off

// npcSpawnFaction(FactionNameString,FactionDescriptionString,NPCPresetFolderNameString,InitialGrowthInt) - Uses: /npc_spawn_faction [FactionName] [FactionDescription] [NPCFactionPresetFolderName] [InitialGrowthInt]
// npcSpawnFactionTo(FactionNameString,FactionDescriptionString,NPCPresetFolderNameString,InitialGrowthInt,[X,Y,Z]/SectorObj/CoordsObj) - Users: /npc_spawn_faction_pos_fixed [FactionName] [FactionDescription] [NPCFactionPresetFolderName] [InitialGrowthInt] X Y Z
// npcTurnAll - Forces a turn for all NPC factions

// refreshServerMsg - Runs a /refresh_server_msg to refresh the server welcome message.

// reconstructAABB - Runs the /restruct_aabb command, which apparently reconstructs all the AABBs of all object on the server (whatever that means)
// sectorSize - Runs the "/sector_size 2000" command to set the current sector sizes for the server on the fly.  WARNING:  It is VERY DANGEROUS to lower sector sizes!
// aiSimulation(true/false) - Turns AI simulation on or off.  Uses: /simulation_ai_enable true/false
// clearSimulation - Clears all currently active AI simulation.  Uses: /simulation_clear_all


// search - runs the /search command and returns a map object with ship names paired with SectorObj's.  It's .size property will be 0 if there were no results.

// serverMessage(MessageString,info/warning/error) - Broadcasts a message to all online players.  If a method is not provided, it uses "plain" which shows on the player's main chat.  Uses: /server_message_broadcast plain/info/warning/error [Message]
// serverMessageTo(PlayerName/PlayerObj,MessageString,info/warning/error) - Sends a personal message to a specific.  If a method is not provided, it uses "plain" which shows on the player's main chat.  Uses: /server_message_to plain/info/warning/error [PlayerName] [Message]

// shutdown(TimeInSeconds,publicMessageString,CountdownMessageString) - No fields are required, but if no time is given, 10 seconds is default.  If a publicMessageString is given, an announcement is made to the public channel. If CountdownMessageString is provided, then a countdown starts with a message and 1 second before it ends, the actual shutdown is started.  This will allow the server to shut down without auto-restarting.

// Optional: /list_control_Units




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
  var lockFileContents=fs.readFileSync(lockFile).toString(); // Added .toString() to make ESLinter happy since it was saying this was a string when using JSON.parse on it.
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
          miscHelpers.waitAndThenKill(300000,lockFileObject["mainPID"]);
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
              miscHelpers.waitAndThenKill(300,serverPIDS[i]);
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


// #########################
// ###    SERVER START   ###
// #########################
eventEmitter.on('ready', function() { // This won't fire off yet, it's just being declared so later on in the script it can be started.  I can modify this later if I want to allow more than one instance to be ran at a time.
  console.log("Starting server..");

  // #####  PLAYER MESSAGES  #####
  eventEmitter.on('message', function(messageObj) { // Handle messages sent from players
    // Expects message to be a message type object
    console.log("Message (type: " + messageObj.type +") DETECTED from " + messageObj.sender.name + " to " + messageObj.receiver.name + ": " + messageObj.text);
    if (messageObj.text == settings["commandOperator"] + "command" ){
      console.log("!command found bitches!");
      let mMessage="/server_message_to plain " + messageObj.sender.name + " 'Melvin: What the fack do you want?'";
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
    process.exitCode=130;
    throw new Error("Server spawn fail.");
  }

  // initialize the objectCreator so it can send text directly to the server through "server". 
  //  IMPORTANT:  THIS MUST BE DONE BEFORE ANY OBJECTS ARE CREATED!
  console.log("############## INITIALIZING OBJECT CREATOR ###############");
  objectCreator.init(server);

    // ###################
    // #### MODLOADER ####
    // ###################
    console.log("############## Loading Mods ###############");

    // Find all modfolders   // Source: https://stackoverflow.com/questions/18112204/get-all-directories-within-directory-nodejs
    // const isDirectory = source => lstatSync(source).isDirectory()

    //    Working but throws errors with ESLINT due to the way the function is declared
    // const isDirectory = function (source) { 
    //   return lstatSync(source).isDirectory(); 
    // };
    // const getDirectories = function(source) {
    //   return readdirSync(source).map((name) => join(source, name)).filter(isDirectory); // working
    // }
    // const isFile = function (source) { 
    //   return lstatSync(source).isFile(); 
    // };
    // const getFiles = function(source) {
    //   return readdirSync(source).map((name) => join(source, name)).filter(isFile); // testing
    // }

    // Working but I'd rather just use fs.lstatSync and fs.readdirSync directly when needed.
    // const {lstatSync, readdirSync} = require('fs')
    // const {join} = require('path')
    // function isDirectory(source) { 
    //   return lstatSync(source).isDirectory(); 
    // };
    // function getDirectories(source) {
    //   return readdirSync(source).map((name) => join(source, name)).filter(isDirectory);
    // }
    // function isFile(source) { 
    //   return lstatSync(source).isFile(); 
    // };
    // function getFiles(source) {
    //   return readdirSync(source).map((name) => join(source, name)).filter(isFile);
    // }

    // Final - simplified to functions -- And exported to miscHelpers
    // function isDirectory(source) { 
    //   return fs.lstatSync(source).isDirectory(); 
    // };
    // function getDirectories(source) {
    //   return fs.readdirSync(source).map((name) => path.join(source, name)).filter(isDirectory);
    // }
    // function isFile(source) { 
    //   return fs.lstatSync(source).isFile(); 
    // };
    // function getFiles(source) {
    //   return fs.readdirSync(source).map((name) => path.join(source, name)).filter(isFile);
    // }

    var modFolders=getDirectories(modFolder)
    // Testing for loading mods  TODO: Change the way it loads to use a map instead, with each directory name being paired with the require
    // Require all scripts found in mod folders
    var fileList=[];
    var mods=[];
    for (var i = 0;i < modFolders.length;i++) {
      console.log("Mod Folder found: " + modFolders[i] + " Looking for scripts..");
      fileList=getFiles(modFolders[i]);
      console.dir(fileList);
      for (var e=0;e<fileList.length;e++){
        if (fileList[e].match(/.\.js$/)) {
          console.log("Loading JS file: " + fileList[e]);
          mods.push(require(fileList[e]));
        }
      }
    }
    console.dir(mods);
    for (i=0;i<mods.length;i++){
      if (mods[i].hasOwnProperty("init")){  // Only run the init function for scripts that have it
        mods[i].init(eventEmitter,server);
      }
    }

    //    process.exit();

    //  Temp:  Loads an individual, pre-made test.js
    // var testModFolder=path.join(modFolder,"testMod");
    //console.log("Loading: " + path.join(testModFolder,"test.js"));
    //var modTest = require(path.join(testModFolder,"test.js"));
    //modTest.init(eventEmitter,server);

    console.log("#####  MODS LOADED #####");
  var tailOptions = {
    "fsWatchOptions": {"persistent": false},
    "follow": true
  };
  miscHelpers.touch(path.join(starMadeInstallFolder,"logs","serverlog.0.log")); // Ensure the file exists before we tail it.
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
        let sender            = dataInput.match(/\[sender=[A-Za-z0-9_-]*/).toString().replace(/^\[sender=/,"");
        let receiver          = dataInput.match(/\[receiver=[A-Za-z0-9_-]*/).toString().replace(/^\[receiver=/,"");
        let receiverType      = dataInput.match(/\[receiverType=[A-Za-z0-9_-]*/).toString().replace(/^\[receiverType=/,"");
        let message           = dataInput.match(/\[message=.*(?=\]$)/).toString().replace(/^\[message=/,"");
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
            let playerObj = new objectCreator.PlayerObj(playerName);
            playerObj["spawnTime"]=Math.floor((new Date()).getTime() / 1000);

            //let playerObj={
            //  "playerName": playerName,
            //  "spawnTime": Math.floor((new Date()).getTime() / 1000)
            //}
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
            "spawnTime" : Math.floor((new Date()).getTime() / 1000)
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
              "spawnTime" : Math.floor((new Date()).getTime() / 1000)
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
      process.exitCode=code;
      // if (code.hasOwnProperty("message")){  // Commenting out to make ESLinter happy
      //     console.log('Server instance exited with message: ' + code.message.toString());
      // }
      console.log('Server instance exited with code: ' + code.toString());
    }
    console.log("Here's some listener listings:");
    // console.log("process:");  // Commenting out this and below to make ESLint happy
    // console.dir(process.listeners());
    // console.log("server:");
    // console.dir(server.listeners());
    // console.log("eventEmitter:");
    // console.dir(eventEmitter.listeners());

    console.log("serverTail:");
    console.dir(serverTail.listeners());



    console.log("Shutting down server log tail..");
    serverTail.unwatch();
    // server.stdin.end();

    // console.log("Removing listeners..");
    // serverTail.removeAllListeners();
    // server.removeAllListeners();

    // eventEmitter.removeAllListeners();
    // process.stdin.removeAllListeners();
    // process.removeAllListeners(); // We don't want to do this because this removes the exit hooks.
    // process.stdout.removeAllListeners();

    // TODO: This needs to be obsoleted.  At this point in the script, we should NOT have force it to shut down.
    // exitNow(code); // This is temporary, we don't necessarily want to kill the wrapper when the process dies.  For example, maybe we want to respawn it?  Ya know?!
    process.exit(); // This is necessary for now because something is holding up the natural exit of the script

  });
  server.on('error', function (code) {
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
// ###  FUNCTIONS  #### -- The standard practice for functions is first write in place, then make a multi-purpose function that handles what you need and can be used elsewhere, then bundle it in a require and change over functionality.  This is to keep the main script at a maintainable length and also have high re-usability value for code created.
// ####################


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
  miscHelpers.deleteFile(tempFileToPlace);
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
  // TODO: It would be much better to simply run the match, then forward for processing, rather than running a test and processing the matches against it.
  // So really this should simply be replaced with a "getMatch" function which only returns the line if it matches
  if (includePatternRegex.test(valToCheck)){
    if (!excludePatternRegex.test(valToCheck)){
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
    await sleep(2000);
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
writeLockFile(); // This is to prevent this script from running multiple times or starting while another server instance is already running.

// ##############################
// ### CREATE NEEDED FOLDERS  ###
// ##############################

miscHelpers.ensureFolderExists(modFolder);
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

  serverCfg = ini.getFileAsObj(starMadeServerConfigFile); // Import the server.cfg values to an object.  These should be the final values.  Any settings changes to the file should be completed before this is loaded.  Note that this KEEPS comments in the value!
  // Use Ini functions from the iniHelperjs to handle the the ini object.  See bottom of the file for the full list.

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
