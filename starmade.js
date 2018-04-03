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
// 1:
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

var eventEmitter = new events.EventEmitter(); // This is for custom events


// #####################
// ###    SETTINGS   ###
// #####################
var operations=0;

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
    process.exit(2);
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

  server.stdout.on('data', function (data) {
    console.log('stdout: ' + data.toString());
  });

  server.stderr.on('data', function (data) {
    // console.log('stderr: ' + data.toString());
  });

  server.on('exit', function (code) {
    console.log('child process exited with code ' + code.toString());
  });

});

function operation(val){ // This controls when the start operation occurs.  All file reads, downloads, installs, etc, must be completed before this will trigger the "ready" event.
  console.log("operations ongoing: " + operations);
  if (val="start"){ // Start is used when an asyncronous operation starts and end should be used when it's finished.
    operations++;
    console.log("operation added.  New operations amount: " + operations);
  } else if (val="end"){
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
    fs.accessSync('./bin/StarNet.jar',fs.constants.F_OK)
    console.log('StarNet.jar found! Starting wrapper!');
    eventEmitter.emit('ready'); // Trigger the custom event to start the server since the StarNet.jar already existed.

  } catch (ex) {
    //  This will be an async operation, so we'll use the "operations" function to ensure it is complete before the ready occurs.
    operation("start");
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
                process.exit(5);
            };
        });
        request.on('error', (e) => {
            console.error(`problem with request: ${e.message}`);
            process.exit(4);
        });
    } catch (err) { // If there was any trouble connecting to the server, then hopefully this will catch those errors and exit the wrapper.
        console.log("Failed to download StarNet.jar!  Exiting!");
        console.error(err);
        process.exit(4);
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
