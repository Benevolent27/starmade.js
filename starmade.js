// @ts-check

// #!/usr/bin/nodejs

// Remember to put "todo" tags wherever code should have some changes coming

// This is just the very first start of the script that can start the starmade server program.  It does not actually parse anything yet.

// Design fundamentals:
// There should be the LEAST amount of input necessary from the user to get things going.  As much as can be automated or already included should be.  Such as including StarNet.jar or downloading it.  Any dependencies should also be able to be automatically installed for any OS.  No superuser should be asked, but should rather be pulled from the server.cfg file from the starmade install folder.  If no superuser password is established already, this scripting should ask the user to input a new one and then change the server.cfg file.  etc.
// All areas of control of the wrapper should have scripting capable of taking input and performing the actions from the **command line**.  A GUI may or may not be built later.  This wrapper is intended to be used primarily on linux machines.  If a GUI is built, it will likely be in java.
// This wrapper should be moddable.  Everything will be event driven, so mods will be able to easily detect when events happen in game and have individual scripts run.
// There will be easy access to databases that both the wrapper and mods can maintain.  There will be "wrapper," "global", and "mod-level" databases.
// There will be built in methods to perform actions, such as sending a command to the console.  Or sending a command via starnet.  Or performing sql queries on the world database with easily parseable output.
// As the wrapper is built, documentation for how it works, how to build a wrapper with it, and the built-in functions and event should be produced, which will be a website easily available to the public later upon release.
// All code should be native to javascript, using outside tools the least possible.  All outside tools must be includable or downloadable and freely usable.receiver

// Todo:

// #######
// ## 1 ##
// #######
// Set up auto-restart on server exit with a non-zero error code.  This should always immediately respawn the process.
// 1a.  Set up lock file and exiting. <-- done
// 1b.  Grab the server pid to be used to kill it.  Store this into the lock file instead of making it a blank file.

// #######
// ## 2 ## -- MetaPhaze
// #######
// Set up auto-restart on abnormal exists which have a 0 error code on exist.  To do this, we should rely on secondary scripting to start this script, such as a "start.js" script. This script creates a file to indicate the server is running. If the file still exists when the server shuts down, we know it should still be running, so this script should start the server again.  A second "stop.js" script will be used to shut down the server, sending the /shutdown command, and removing the temporary file.  Then when the server exits with no error code, this script should exit gracefully.

// Heartbeat process - needs to send a "/status" command via StarNet.jar every minute and ensure the connection was successful and the response was as expected.
// Crashes:
// Soft-crash - Too busy for 2 minutes to respond to StarNet.jar OR server is unresponsive.
// ** Hard-crash - Server exits with an exit code other than 0.  It should automatically restart the server using the "ready" event emitter IF the server.lck file still exists.



// #######
// ## 3 ##
// #######
// Set up start.js, stop.js, restart.js scripts to control the server.
// Start.js Basic Design:
// PID - javascript program <-- This one one we do not have.
// PID - java StarMade server <--- this one we have
// server.lck <-- json.  When PID javascript program, when starmade starts, it adds the starmade server PID to the lock file

// start.js -- server.lck.
// lockPIDS=include ("./server.lck");
// lockPIDS["jsPID"]=PID of the actual javascript wrapper.
// kill jsPID <-- might be different methods used per OS
// lockPIDS["starmadeJar"]=PID of the starmade server.
// Same here, but try using StarNet.jar to send a "/shutdown 1" command first

// Scripts:
// Start gives up easily, checks for lock file.  PIDS, etc.  If PIDS in lock file are not running, it should delete the lock file and start the program.
// Stop - Try to shut it down gracefully with a /shutdown command and send a message to the server letting players know the server is shutting down.  Will not force shut down anything.
// ForceStop - Tries to shut down gracefully with "/shutdown 1" (using stop), then SIGTERM (graceful) (wait 5 minutes, checking every 10 seconds or so to see if the program is still running), then SIGKILL (HARMFUL SHUTDOWN)
// Restart - Start (and end if success), stop, forcestop, start.  Also let users know that the server is restarting.


// #######
// ## 4 ##
// #######
// Set up the ability for OUTSIDE scripts to communicate with this script and send commands directly to the console.  Normally StarNet.jar will be ok for this, but not when processing hundreds of requests, such as performing operations on individual entities within a sector.  StarNet.jar might take 20 seconds to complete, but sending commands directly to the console takes less than 1 second.

// #######
// ## 5 ##
// #######
// Set up backup scripting.  Presently the bash version of wrapper 2.0 uses rsync to do a quick backup to a temporary folder, starts the server, and then starts packing the temporary world file to a zip file or gzip file.  We need to either include rsync as a dependency or find an alternative to allow fast backups.  The alternative is to wait for a full zip operation to occur, which can take several minutes.  The scripting should utilize rsync for the appropriate OS.
// Rsync:  https://rsync.samba.org/
// #######
// ## 6 ##
// #######
// Set up the mod structure.  The way I want this to work is there will be a "mods" folder which contains sub-folders.  Within each subfolder is a script with various names, such as "playerDeath.js" or "shipOverheat.js".  When a specific event happens, it will asyncronously spawn these mod scripts, preloading the parsed data from the event, such as the player who died, or the player who killed the other player, etc.  This mod loading should also be refreshable, so that the wrapper does not need to be restarted when a mod is edited, but will instead refresh the individual mod scripts.

// #######
// ## 7 ##
// #######
// Set up sqlite functionality.  This will be a dependency and will be used to store data in different databases.  There will be a wrapper database, "global" database, and "mod" database.  Mods should only have access to the global and mod databases.  When performing a sql query on the "mod" database, it should be a unique database for that mod, preferrably in a created directory under the mod folder.  The backup routine should also be compressing these databases into the main backup.

// #######
// ## 8 ##
// #######
// Set up reading from a "settings.json" file to set information such as the starmade install folder, java min and max values, and other custom arguments, such as running a JVM.

// #######
// ## 9 ##
// #######
// Change the "settings" loading of settings.json so that if the file does not exist, it asks for the information at the command prompt and then build the settings object and output to the settings.json file.
// It should verify that the folder given for StarMade is valid, and if not, create it and install starmade by downloading the installer and running it.
// It should ask for min value for RAM and MAX, also port to run on.  It should use a default of 4242 port if no user input.

// Exit codes
// 1: Lock file existed. Possible other server running.  Cannot start.
// 2: settings.json file did not contain all needed settings.
// 4: StarNet.jar did not exist and download failed due to a socks error, such as a failed connection.
// 5. StarNet.jar did not exist and download failed with HTTP response from webserver.  The HTTP error code will be available in the last line output by this script.




// ##############################
// ###    BUILT-IN REQUIRES   ###
// ##############################

// ### Built-in nodejs modules that should never need to be installed.
const http   = require('http');
const fs     = require('fs');
const events = require('events');
const spawn  = require('child_process').spawn;
const path   = require('path'); // This is needed to build file and directory paths that will work in windows or linux or macosx.  For example, The / character is used in linu, but windows uses \ characters.  Windows also uses hard drive characters, wherease linux has mount points.  For example, in linux a path looks like "/path/to/somewhere", but in windows it looks like "c:\path\to\somewhere".  The path module takes care of this for us to build the path correctly.
// const stream   = require('stream'); // For creating streams.  Not used right now but may be later.


// #####################
// ###    SETTINGS   ###
// #####################
var mainFolder     = path.dirname(require.main.filename); // This is where the starmade.js is
var binFolder       = path.join(mainFolder,"bin");
var operations      = 0;
var lockFile        = path.join(mainFolder,"server.lck");
var showStderr      = true;
var showStdout      = true;
var includePatterns = [];
var excludePatterns = [];
var serversRunning  = 0; // This is to count the server's running to manage the exit function and kill them when this main script dies.

// #######################
// ### SCRIPT REQUIRES ###
// #######################
// path.resolve below builds the full path to "./bin/setSettings.js" in such a way that is compatible with both windows and linux/macosx, since it doesn't use / or \ characters.
var setSettings = require(path.join(binFolder, "setSettings.js")); // This will confirm the settings.json file is created and the install folder is set up.
var installAndRequire = require(path.join(binFolder, "installAndRequire.js")); // This is used to install missing NPM modules and then require them.

// #################################
// ### NPM DOWNLOADABLE REQUIRES ###
// #################################
const makeDir=installAndRequire('make-dir'); // https://www.npmjs.com/package/make-dir This allows creating folders recursively if they do not exist, with either async or sync functionality.
const treeKill=installAndRequire('tree-kill'); // https://www.npmjs.com/package/tree-kill To kill the server and any sub-processes

// ### Setting up submodules from requires.
var eventEmitter = new events.EventEmitter(); // This is for custom events

//  ### Lock Check ###  -- Temporary solution is to prevent this script from running if lock file exists
if (fs.existsSync(lockFile)){
  //todo if the lock file exists, we need to grab the PID from the file and see if the server is running.  If not, then we can safely remove the lock file, otherwise end with an error.
  console.log("Lock file found!  Server already started!  Exiting!");
  process.exit(1);
}

// Depreciated wonky way of checking if the file existed.  Will delete this soon.
// try {
//   fs.accessSync(lockFile,fs.constants.F_OK);
//   console.log("Lock file found!  Server already started!  Exiting!");
//   process.exit(1);
// } catch (err) {
//   console.log("No lock detected!  Continuing.");
// };

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

// Import settings, including the starmade folder, min and max java settings, etc.  If the settings.json file does not exist, it will set it up.
var settings=setSettings();

var starNetJarURL="http://files.star-made.org/StarNet.jar";
var starMadeJar = path.join(settings["starMadeFolder"],"StarMade.jar");
var starNetJar  = path.join(binFolder,"StarNet.jar");

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

  eventEmitter.on('message', function(message) { // Handle messages sent from players
    console.log("Message DETECTED from " + message.sender + " to " + message.receiver + ": " + message.text);
    if (message.text == "!command" ){
      console.log("!command found bitches!");
      let mMessage="/server_message_to plain " + message.sender + " 'Melvin: What the fack do you want?'";
      server.stdin.write(mMessage.toString().trim() + "\n");
      // server.stdin.end();
    }
  });


  // This will need to be able to supportsetting other arguments, such as the port, and JVM arguments if the server plans on using the JVM to troubleshoot bugs, performance issues, etc.
  // var starMadeArguments="-server";

  // Here we are setting up custom events, which will be used for various things such as player deaths, ship overheats, player spawns, etc.

  // Taken from https://stackoverflow.com/questions/10232192/exec-display-stdout-live
  // Running the starmade server process
  try { // This is to catch an error if spawn cannot start the java process
    var server = spawn("java", ["-Xms" + settings["javaMin"], "-Xmx" + settings["javaMax"],"-jar", starMadeJar,"-server", "-port:" + settings["port"]], {"cwd": settings["starMadeFolder"]});
  } catch (err) { // This does NOT handle errors returned by the spawn process.  This only handles errors actually spawning the process in the first place, such as if we type "javaBlah" instead of "java".  Cannot run "javaBlah" since it doesn't exist.
    console.error("ERROR: Could not spawn server!")
    if (err.message) { console.error("Error Message: " + err.message.toString()); }
    if (err.code) { console.error("Error Code: " + err.code.toString()); }
    exitNow(130);
  }
  serversRunning++; // Increment the number of servers running.
  console.log('Spawned server process with PID:' + server.pid);
  var lockFileObj = fs.createWriteStream(lockFile);
  // function pidCB() { console.log("Wrote PID to lock file.."); }
  // lockFileObj.on('finish', function() { lockFileObj.close(pidCB); });
  lockFileObj.write(server.pid.toString());
  lockFileObj.end();

  // ####################
  // ###    WRAPPER   ###
  // ####################
  function processDataInput(dataInput){
    if (testMatch(dataInput)) { // Check to see if the message fits any of the regex patterns
      console.log("Event found!: " + dataInput + "Arguments: " + arguments.length);
      for (let i=0;i<arguments.length;i++){
        console.log("arguments[" + i + "]: " + arguments[i]);
      }
      let theArguments=arguments[0].split(" ");

      if (theArguments[0] == "[CHANNELROUTER]"){ // This is for all messages, including commands.
      let sender=dataInput.match(/sender=[A-Za-z0-9_-]*/).toString();
        let senderArray       = sender.split("=");
        sender                = senderArray.pop();
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
        var messageObj={
          "sender":       sender,
          "receiver":     receiver,
          "receiverType": receiverType,
          "text":         message
        }
        eventEmitter.emit('message',messageObj);
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
    if (code.message){
        console.log('Server instance exited with message: ' + code.message.toString());
    }
    console.log('Server instance exited with code: ' + code.toString());
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
      let theArguments = theText.split(" ");
      let theCommand   = theArguments.shift().toLowerCase();
      let tempArray    = theCommand.split("")
      tempArray.shift();
      theCommand=tempArray.join("");
      console.log("Wrapper command detected: " + theCommand)
      console.log("Full: " + theText);

      if (theCommand == "stdout" ) {
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

// ####################
// ###  FUNCTIONS  ####
// ####################
function touch (file){
  fs.closeSync(fs.openSync(file, 'w'));
}
function deleteFile (file) {
  try {
    fs.unlinkSync(file);
    // console.log("File, , " + file + ", deleted!");
  } catch(err) {
    console.error("File, " + file + ", cannot be deleted.  File not found!");
  }
}

function tryDelete (fileToDelete){
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
  }
}


function exitNow(code) {
  console.log("Deleting lock file.");
  deleteFile(lockFile);
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

function operation(val){ // This controls when the start operation occurs.  All file reads, downloads, installs, etc, must be completed before this will trigger the "ready" event.
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
    if (operations>1){
      operations--;
    } else {
      console.log("All operations finished, triggering 'ready' event!");
      eventEmitter.emit('ready');
    }
  }
}

// function cb() {
//   console.log("Finished downloading StarNet.jar!");
// }

function downloadSync(httpURL,fileToPlace) {
  // todo make a sync downloader.
  var tempFileToPlace=path.resolve(mainFolder,fileToPlace + ".tmp");
  tryDelete(tempFileToPlace);
  var resolvedFileToPlace=path.resolve(mainFolder,fileToPlace);
  var baseFileToPlace=path.basename(resolvedFileToPlace);
  var baseDirForFile=path.dirname(resolvedFileToPlace);
  console.log("Sync Downloading: " + fileToPlace + " From: " + httpURL);
  return new Promise(function(resolve, reject) {
    if (fs.existsSync(resolvedFileToPlace)) { // We can see that a file, directory, or symlink exists at the target path
      if (fs.statSync(resolvedFileToPlace).isFile()){
        // console.log("'" + baseFileToPlace + "' existed.  Good!"); // File already exists, nothing to do.
        return true;
      } else if (fs.statSync(resolvedFileToPlace).isDirectory()){
        throw new Error("ERROR: Cannot download file: " + resolvedFileToPlace + "\nDirectory already exists with the name!  Please remove this directory and run this script again!");
      } else {
        throw new Error("ERROR: Cannot download file: " + resolvedFileToPlace + "\nPath already exists with the name!  Please rectify this and then run this script again!");
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
            console.error("Error downloading file!  HTTP Code: " + response.statusCode);
            throw new Error(response.statusMessage);
          };
        }).catch(reject); // I may need to add other catches elsewhere rather than throwing errors, if not only to have a consistent format for how errors are handled here.
        request.on('error', (e) => {
          throw new Error(`problem with request: ${e.message}`);
        });
      } catch (err) { // If there was any trouble connecting to the server, then hopefully this will catch those errors and exit the wrapper.
        console.log("ERROR:  Failed to download, '" + httpURL + "'!");
        throw err;
      }
      file.on('finish', function() {
        file.close();
        fs.rename(tempFileToPlace, resolvedFileToPlace, (err) => {
          if (err) { throw err; }
          console.log("'" + baseFileToPlace + "' downloaded successfully! :D");
        });
      });
    }
    return true;
  });
}


function preDownload(httpURL,fileToPlace){ // This function handles the pre-downloading of files, such as StarNet.jar.  When all downloads are finished, the StarMade server is started by emitting the event signal, "ready".
  // Code adapted from: https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
  operation("start","preDownload: " + fileToPlace);
  let tempFileToPlace=path.resolve(mainFolder,fileToPlace + ".tmp");
  tryDelete(tempFileToPlace);
  let resolvedFileToPlace=path.resolve(mainFolder,fileToPlace);
  let baseFileToPlace=path.basename(resolvedFileToPlace);
  let baseDirForFile=path.dirname(resolvedFileToPlace);

  // Check to see if the file already exists or not.  If it does exist, then we can end this operation.
  // fs.accessSync(resolvedFileToPlace),fs.constants.F_OK); // Supposed to check if the file can be seen but it was not working for me for some reason.
  if (fs.existsSync(resolvedFileToPlace)) { // We can see that a file, directory, or symlink exists at the target path
    if (fs.statSync(resolvedFileToPlace).isFile()){
      // console.log("'" + baseFileToPlace + "' existed.  Good!"); // File already exists, nothing to do.
      operation("end","preDownload: " + fileToPlace);
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
          console.error("Error downloading file!  HTTP Code: " + response.statusCode);
          throw new Error(response.statusMessage);
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
        operation("end","preDownload: " + fileToPlace); // We're using a function to keep track of all ongoing operations and only triggering the start event when all are complete.  So let's complete this operation.
      });
    });
  }
  return true;
}


// ##########################################
// ###  MAIN SCRIPT EXIT  - GLOBAL SCOPE ####
// ##########################################

process.on('exit', function() {
  // Cleanup that needs to be done on the global scope should be done here.
  console.log("Global Exit event running..");
});

touch(lockFile); // Create an empty lock file.  This is to prevent this script from running multiple times.

// ##############################
// ### CREATE NEEDED FOLDERS  ###
// ##############################

ensureFolderExists(binFolder);

// ###################################
// ### DEPENDENCIES AND DOWNLOADS  ###
// ###################################
// Check for dependencies, such as StarNet.jar and download/install if needed.
// When all dependency downloads/installs are finished, start the server!

console.log("Ensuring all dependencies are downloaded or installed..");

// ### Sync downloads/installs ### -- This sub-section is to ensure installs/downloads happen in the right order.

// Nothing here yet
// Todo create a syncronous file downloader

// ### Async downloads/installs ### -- This sub-section is for all installs/downloads that can be done asynchronously to occur as quickly as possible.
preDownload(starNetJarURL,starNetJar); // This function handles the asyncronous downloads and starts the server when finished.

// When all async dependencies are finished downloading/installing, the server will start automatically as per the operation function that should be managing them.

// Check if StarNet.jar exists and download it if not.
// try {
//     operation("start");
//     fs.accessSync(path.join(binFolder,"StarNet.jar"),fs.constants.F_OK);
//     console.log('StarNet.jar found.');
//     operation("end"); // This now handles emitting the ready signal to start the server when all operations have completed.
//   } catch (ex) {
//     //  This will be an async operation to downloading StarNet.jar.
//     console.log("StarNet.jar not found!  Downloading!")
//
//     let starNetTmpFile=path.join(binFolder,'StarNet.jar.tmp');
//     tryDelete(starNetTmpFile);
    // http://files.star-made.org/StarNet.jar
    // try { // We will first download to a temporary name and then move it upon success.  Delete the temp file if exists already.
    //     fs.accessSync();
    //     console.log("Deleting StarNet.jar.tmp file before continuing.");
    //     try {
    //       fs.unlinkSync(path.join(binFolder,'StarNet.jar.tmp')); // I'm not including error handling here because there should never be a situation where the temp file cannot be removed by this script.
    //     } catch (err) {
    //       console.error("ERROR: Could not delete StarNet.jar.tmp!  Please manually remove this file and restart this script!");
    //       throw err;
    //     }
    // } catch (err) {
    //     console.log("StarNet.jar.tmp not found, good!  Continuing!");
    // }

    // var file = fs.createWriteStream(starNetTmpFile); // Open up a write stream to the temporary file
    // // Let's try to now download the file and pipe it to the temporary file
    // console.log("Starting download..");
    // try {
    //     var request = http.get(starNetJarURL, function(response) {
    //         console.log("Status Code: " + response.statusCode);
    //         // When the file is downloaded with the "http.get" method, it returns an object from which you can get the HTTP status code.
    //         // 200 means it was successfully downloaded, anything else is a failure.  Such as 404.
    //         if (response.statusCode == 200){
    //             response.pipe(file);
    //         } else {
    //             console.log("Error downloading file!  HTTP Code: " + response.statusCode);
    //             exitNow(5);
    //         };
    //     });
    //     request.on('error', (e) => {
    //         console.error(`problem with request: ${e.message}`);
    //         exitNow(4);
    //     });
    // } catch (err) { // If there was any trouble connecting to the server, then hopefully this will catch those errors and exit the wrapper.
    //     console.log("Failed to download StarNet.jar!  Exiting!");
    //     console.error(err);
    //     exitNow(4);
    // }
    // file.on('finish', function() {
    //     file.close(cb);
    //     fs.rename(path.join(binFolder,'StarNet.jar.tmp'), path.join(binFolder,'StarNet.jar'), (err) => {
    //         if (err) {
    //             console.error(err);
    //         }
    //         console.log('StarNet.jar downloaded successfully! :D');
    //         operation("end"); // We're using a function to keep track of all ongoing operations and only triggering the start event when all are complete.  So let's complete this operation.
    //       });
    //   });
// }
