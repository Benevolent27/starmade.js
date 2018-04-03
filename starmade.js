#!/usr/bin/nodejs
// This is just the very first start of the script that can start the starmade server program.  It does not actually parse anything yet.

// Design fundamentals:
// There should be the LEAST amount of input necessary from the user to get things going.  As much as can be automated or already included should be.  Such as including StarNet.jar or downloading it.  Any dependencies should also be able to be automatically installed for any OS.  No superuser should be asked, but should rather be pulled from the server.cfg file from the starmade install folder.  If no superuser password is established already, this scripting should ask the user to input a new one and then change the server.cfg file.  etc.
// All areas of control of the wrapper should have scripting capable of taking input and performing the actions from the **command line**.  A GUI may or may not be built later.  This wrapper is intended to be used primarily on linux machines.  If a GUI is built, it will likely be in java.
// This wrapper should be moddable.  Everything will be event driven, so mods will be able to easily detect when events happen in game and have individual scripts run.
// There will be easy access to databases that both the wrapper and mods can maintain.  There will be "wrapper," "global", and "mod-level" databases.
// There will be built in methods to perform actions, such as sending a command to the console.  Or sending a command via starnet.  Or performing sql queries on the world database with easily parseable output.
// As the wrapper is built, documentation for how it works, how to build a wrapper with it, and the built-in functions and event should be produced, which will be a website easily available to the public later upon release.


// Todo:
// 1. Set up auto-restart on server exit with a non-zero error code.  This should always immediately respawn the process.
// 1a.  Set up lock file and exiting. <-- done
// 1b.  Grab the server pid to be used to kill it.  Store this into the lock file instead of making it a blank file.

// 2. Set up auto-restart on abnormal exists which have a 0 error code on exist.  To do this, we should rely on secondary scripting to start this script, such as a "start.js" script. This script creates a file to indicate the server is running. If the file still exists when the server shuts down, we know it should still be running, so this script should start the server again.  A second "stop.js" script will be used to shut down the server, sending the /shutdown command, and removing the temporary file.  Then when the server exits with no error code, this script should exit gracefully.

// 3. Set up start.js, stop.js, restart.js scripts to control the server.

// 4. Set up the ability for OUTSIDE scripts to communicate with this script and send commands directly to the console.  Normally StarNet.jar will be ok for this, but not when processing hundreds of requests, such as performing operations on individual entities within a sector.  StarNet.jar might take 20 seconds to complete, but sending commands directly to the console takes less than 1 second.

// 5. Set up backup scripting.  Presently the bash version of wrapper 2.0 uses rsync to do a quick backup to a temporary folder, starts the server, and then starts packing the temporary world file to a zip file or gzip file.  We need to either include rsync as a dependency or find an alternative to allow fast backups.  The alternative is to wait for a full zip operation to occur, which can take several minutes.  The scripting should utilize rsync for the appropriate OS.
// Rsync:  https://rsync.samba.org/

// 6. Set up the mod structure.  The way I want this to work is there will be a "mods" folder which contains sub-folders.  Within each subfolder is a script with various names, such as "playerDeath.js" or "shipOverheat.js".  When a specific event happens, it will asyncronously spawn these mod scripts, preloading the parsed data from the event, such as the player who died, or the player who killed the other player, etc.  This mod loading should also be refreshable, so that the wrapper does not need to be restarted when a mod is edited, but will instead refresh the individual mod scripts.

// 7. Set up sqlite functionality.  This will be a dependency and will be used to store data in different databases.  There will be a wrapper database, "global" database, and "mod" database.  Mods should only have access to the global and mod databases.  When performing a sql query on the "mod" database, it should be a unique database for that mod, preferrably in a created directory under the mod folder.  The backup routine should also be compressing these databases into the main backup.

// 8. Set up reading from a "settings.json" file to set information such as the starmade install folder, java min and max values, and other custom arguments, such as running a JVM.

// 9. Create an install script that will ask for information such as the location of the starmade folder and download any prerequisites, such as StarNet.jar.  It would be nice if it could allow a person to select the starmade folder from an explorer window, but the intended use of this wrapper is on console only systems, so it should be able to tell what OS it is running on and whether there is a GUI available to determine how it asks for the information.


// Exit codes
// 1: Lock file existed. Possible other server running.  Cannot start.
// 2: settings.json file did not contain all needed settings. 
// 4: StarNet.jar did not exist and download failed due to a socks error, such as a failed connection.
// 5. StarNet.jar did not exist and download failed with HTTP response from webserver.  The HTTP error code will be available in the last line output by this script.



// #####################
// ###    REQUIRES   ###
// #####################
const http = require('http');
const fs = require('fs');
const events = require('events');
const spawn = require('child_process').spawn;
const stream   = require('stream'); // For streaming user input to the child process for the server

var eventEmitter = new events.EventEmitter(); // This is for custom events


// #####################
// ###    SETTINGS   ###
// #####################
var operations=0;
var lockFile="./server.lck";
var showStderr=true;
var showStdout=true;

var includePatterns=[];
var excludePatterns=[];

// Patterns - This will be to detect things like connections, deaths, etc.  I'm pushing to an array so it's easier to add or remove patterns.
includePatterns.push("^\\[SERVER\\] MAIN CORE STARTED DESTRUCTION");
includePatterns.push("^\\[SERVER\\]\\[SPAWN\\]");
includePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\]");
includePatterns.push("^\\[PLAYER\\]\\[DEATH\\]");
includePatterns.push("^\\[SERVER\\] PlS\\[");
includePatterns.push("^\\[SERVER\\]\\[PLAYERMESSAGE\\]");
includePatterns.push("^\\[CHANNELROUTER\\]");
includePatterns.push("^\\[SERVER\\] Object Ship\\[");
includePatterns.push("^\\[CHARACTER\\]\\[GRAVITY\\] # This is the main gravity change");
includePatterns.push("^PlayerCharacter\\["); // # This handles killing creatures as a player as well as some wonky gravity changes.  I need to compare this to the main gravity changes to see if I should utilize it or not
includePatterns.push("^Ship\\[ "); // # This handles killing NPC creatures from a ship and possibly other things.. but I haven't seen anything else in the logs to indicate the "other things"
includePatterns.push("^SpaceStation\\["); // # This handles killing NPC creatures from a station
includePatterns.push("^AICharacter\\["); // # This handles NPC creature deaths from other NPC characters
includePatterns.push("^Sector\\["); // # This handles NPC creature deaths via black hole or star damage
includePatterns.push("^Planet[(]"); // # This handles NPC creature death via planet
includePatterns.push("^ManagedAsteroid[(]"); // This handles NPC creature deaths via asteroids that have been modified in some way
includePatterns.push("^\\[DEATH\\]");
includePatterns.push("^\\[SPAWN\\]");
includePatterns.push("^\\[BLUEPRINT\\]");
includePatterns.push("^\\[SEGMENTCONTROLLER\\] ENTITY");
includePatterns.push("^\\[FACTION\\]");
includePatterns.push("^\\[FACTIONMANAGER\\]");
includePatterns.push("^\\[SHUTDOWN\\]");

excludePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'null'");
excludePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'Info-Pinger \\(server-lists\\)'");

// Build the regex patterns.
var includePatternRegex="(" + includePatterns[0];
for (var i=1;i<includePatterns.length;i++){ includePatternRegex+="|" + includePatterns[i]; }
includePatternRegex+=")"
includePatternRegex=new RegExp(includePatternRegex);
console.log("includePatternRegex: " + includePatternRegex + "\n");
var excludePatternRegex="(" + excludePatterns[0];
for (var i=1;i<excludePatterns.length;i++){ excludePatternRegex+="|" + excludePatterns[i]; }
excludePatternRegex+=")"
excludePatternRegex=new RegExp(excludePatternRegex);
console.log("excludePatternRegex: " + excludePatternRegex + "\n");

function testMatch(valToCheck) {
  if (includePatternRegex.test(valToCheck)){
    if (!excludePatternRegex.test(valToCheck)){
      return true;
    }
  } else {
    return false;
  }
}


var starNetJarURL="http://files.star-made.org/StarNet.jar";

// Import settings, including the starmade folder, min and max java settings, etc.
try {
  var settings = require("./settings.json");
  console.log("Imported settings values from settings.json.");
} catch (ex) {
    console.log("Settings.json file not found! Using default values");
    var settings={ // This is a temporary fallback during testing.  In the future if there is no settings.json file, we'll run an install routine instead to set the values and write the file.
      "starMadeFolder": "/home/philip/Programs/StarMade/",
      "javaMin": "128m",
      "javaMax": "1024m"
    };
}
// Verify that all values are present and give an error if not enough settings are present.
if (!settings.hasOwnProperty('starMadeFolder') || 
  !settings.hasOwnProperty('javaMin') || 
  !settings.hasOwnProperty('javaMax')){
    console.error("ERROR: settings.json file did not contain needed configuration options!  Exiting!");
    exitNow(2);
  }


// #########################
// ###    SERVER START   ###
// #########################
eventEmitter.on('ready', function() { // This won't fire off yet, it's just being declared so later on in the script it can be started.  I can modify this later if I want to allow more than one instance to be ran at a time.
  console.log("Starting server..");
  var starMadeJar=settings["starMadeFolder"] + "StarMade.jar";
  var starNet="./bin/" + "StarNet.jar";
  // This will need to be able to supportsetting other arguments, such as the port, and JVM arguments if the server plans on using the JVM to troubleshoot bugs, performance issues, etc.
  var starMadeArguments="-server";

  // Here we are setting up custom events, which will be used for various things such as player deaths, ship overheats, player spawns, etc.


  // Taken from https://stackoverflow.com/questions/10232192/exec-display-stdout-live
  // Running the starmade server process
  var server = spawn("java", ["-Xms" + settings["javaMin"], "-Xmx" + settings["javaMax"],"-jar", starMadeJar,"-server"], {cwd: settings["starMadeFolder"]});
  // displayPID(server);  
  console.log('Spawned server with PID:' + server.pid);
  var lockFileObj = fs.createWriteStream(lockFile);
  // function pidCB() { console.log("Wrote PID to lock file.."); }
  // lockFileObj.on('finish', function() { lockFileObj.close(pidCB); });
  lockFileObj.write(server.pid.toString());
  lockFileObj.end();

  var dataInput;

  // ####################
  // ###    WRAPPER   ###
  // ####################
  function processDataInput(dataInput){
    if (testMatch(dataInput)) {
      console.log("Event found!: " + dataInput + "Arguments: " + arguments.length);
      for (let i=0;i<arguments.length;i++){
        console.log("arguments[" + i + "]: " + arguments[i]);
      }
      theArguments=arguments[0].split(" ");
      if (theArguments[0] == "[CHANNELROUTER]"){
        let sender=dataInput.match(/sender=[A-Za-z0-9_-]*/).toString();
        let senderArray=sender.split("=");
        sender=senderArray.pop();
        let receiver=dataInput.match(/\[receiver=[A-Za-z0-9_-]*/).toString();
        let receiverArray=receiver.split("=");
        receiver=receiverArray.pop();
        let receiverType=dataInput.match(/\[receiverType=[A-Za-z0-9_-]*/).toString();
        let receiverTypeArray=receiverType.split("=");
        receiverType=receiverTypeArray.pop();
        let message=dataInput.match(/\[message=.*\]$/).toString();
        let messageArray=message.split("=");
        message=messageArray.pop();
        messageArray=message.split("");
        messageArray.pop();
        message=messageArray.join("");

        //arguments[0]: [CHANNELROUTER] RECEIVED MESSAGE ON Server(0): [CHAT][sender=Benevolent27][receiverType=CHANNEL][receiver=all][message=words]

        console.log("Message found: ");
        console.log("sender: " + sender);
        console.log("receiver: " + receiver);
        console.log("receiverType: " + receiverType);
        console.log("message: " + message);

      }







    }
  }

  server.stdout.on('data', function (data) {
    let dataString=data.toString().trim();
    if (dataString){
      if (showStdout == true) {
        console.log("stdout: " + dataString);
      }
      processDataInput(dataString);
    }
  });

  server.stderr.on('data', function (data) {
    let dataString=data.toString().trim();
    if (dataString){
      if (showStderr == true) {
        console.log("stderr: " + dataString);
      }
      processDataInput(dataString);
    }
  });

  server.on('exit', function (code) {
    console.log('child process exited with code ' + code.toString());
    exitNow(code);
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
      let theArguments=theText.split(" ");
      let theCommand=theArguments.shift().toLowerCase();
      let tempArray=theCommand.split("")
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
      server.stdin.write(text.toString().trim() + "\n");
      // server.stdin.write(text.toString() + "\n");
      // server.stdin.end();
    }
  });
  
  // This is great to have all the info show on the screen, but how does one turn off a pipe? No idea.  I'll use events instead.
  // server.stdout.pipe(process.stdout);
  // server.stderr.pipe(process.stdout);
  
  // var stdinStream = new stream.Readable();

});




//  ### Lock Check ###
try {
  fs.accessSync(lockFile,fs.constants.F_OK)
  console.log("Lock file found!  Server already started!  Exiting!");
  process.exit(1);
} catch (err) {
  console.log("Starting up!");
};

// ####################
// ###  FUNCTIONS  ####
// ####################
function touch (file){
  fs.closeSync(fs.openSync(file, 'w'));
}
function deleteFile (file) {
  try {
    fs.unlinkSync(file);
    console.log("File, , " + file + ", deleted!");
  } catch(err) {
    console.error("File, " + file + ", cannot be deleted.  File not found!");
  }
}

function exitNow(code) {
  deleteFile(lockFile);
  console.log("Exiting with exit code: " + code);
  process.exit(code);
}


// ###############
// ###  EXIT  ####
// ###############

process.on('exit', function() {
  // Any sort of cleanup should be done now.  Such as possibly checking to see if the server process is still running and kill it.
  console.log("Exiting..");
});

touch(lockFile);


function operation(val){ // This controls when the start operation occurs.  All file reads, downloads, installs, etc, must be completed before this will trigger the "ready" event.
  console.log("operations ongoing: " + operations + " Command given: " + val);
  if (val == "start"){ // Start is used when an asyncronous operation starts and end should be used when it's finished.
    operations++;
    console.log("operation added.  New operations amount: " + operations);
  } else if (val == "end"){
    if (operations>1){
      operations--;
    } else {
      console.log("All operations finished, triggering start event: " + operations);
      eventEmitter.emit('ready');
    }
  }
}



  // #####################
  // ### DEPENDENCIES  ###
  // #####################
  // Check for dependencies, such as StarNet.jar and download/install if needed.
  // By default the StarNet.jar needs to be in the ./bin/ folder, so let's see if it exists and download it if not.


// ensure StarNet.jar exists, download if not.
// Code from: https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries

// Check to see if the /bin dir exists and create it if not.
try {
    fs.accessSync('./bin/',fs.constants.F_OK)
    console.log("/bin folder found!  Great!  Continuing..");
} catch (err) {
    console.log("/bin folder not found, creating it!");
    fs.mkdirSync("./bin");
};

// Check if StarNet.jar exists and download it if not.
try {
    operation("start");
    fs.accessSync('./bin/StarNet.jar',fs.constants.F_OK)
    console.log('StarNet.jar found! Starting wrapper!');
    // Below is commented out because it's obsolete.
    // eventEmitter.emit('ready'); // Trigger the custom event to start the server since the StarNet.jar already existed.
    operation("end");

  } catch (ex) {
    //  This will be an async operation, so we'll use the "operations" function to ensure it is complete before the ready occurs.
    
    console.log("StarNet.jar not found!  Downloading!")

    // http://files.star-made.org/StarNet.jar
    try { // We will first download to a temporary name and then move it upon success.  Delete the temp file if exists already.
        fs.accessSync('./bin/StarNet.jar.tmp'); 
        console.log("StarNet.jar.tmp file found.  Removing first..");
        fs.unlinkSync('./bin/StarNet.jar.tmp'); // I'm not including error handling here because there should never be a situation where the temp file cannot be removed by this script.
    } catch (err) {
        console.log("StarNet.jar.tmp not found, good!  Continuing!");
    }
    
    // Open up a write stream to the temporary file
    var file = fs.createWriteStream("./bin/StarNet.jar.tmp");
    
    // Let's try to now download the file and pipe it to the temporary file
    console.log("Starting download..");
    try {
        var request = http.get(starNetJarURL, function(response) { 
            console.log("Status Code: " + response.statusCode);
            // When the file is downloaded with the "http.get" method, it returns an object from which you can get the HTTP status code.  
            // 200 means it was successfully downloaded, anything else is a failure.  Such as 404.
            if (response.statusCode == 200){
                response.pipe(file); 
            } else {
                console.log("Error downloading file!  HTTP Code: " + response.statusCode);
                exitNow(5);
            };
        });
        request.on('error', (e) => {
            console.error(`problem with request: ${e.message}`);
            exitNow(4);
        });
    } catch (err) { // If there was any trouble connecting to the server, then hopefully this will catch those errors and exit the wrapper.
        console.log("Failed to download StarNet.jar!  Exiting!");
        console.error(err);
        exitNow(4);
    }
    function cb() {
        console.log("Finished downloading StarNet.jar!");
    }
    file.on('finish', function() {
        file.close(cb);
        fs.rename('./bin/StarNet.jar.tmp', './bin/StarNet.jar', (err) => {
            if (err) {
                console.error(err);
            }
            console.log('StarNet.jar downloaded successfully! :D');
            operation("end"); // We're using a function to keep track of all ongoing operations and only triggering the start event when all are complete.  So let's complete this operation.
            // Below is obsolete since we're using a function to manage ongoing async operations.
            // eventEmitter.emit('ready'); // Trigger the custom event to start the server since the file is done downloading and there were no errors.
          });
      });
}
