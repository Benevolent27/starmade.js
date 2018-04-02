#!/usr/bin/nodejs
// This is just the very first start of the script that can start the starmade server program.  It does not actually parse anything yet.

// Design fundamentals:
//  There should be the LEAST amount of input necessary from the user to get things going.  As much as can be automated or already included should be.  Such as including StarNet.jar or downloading it.  Any dependencies should also be able to be automatically installed for any OS.  No superuser should be asked, but should rather be pulled from the server.cfg file from the starmade install folder.  If no superuser password is established already, this scripting should ask the user to input a new one and then change the server.cfg file.  etc.
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

// 8. Set up reading from a "settings.cfg" file to set information such as the starmade install folder, java min and max values, and other custom arguments, such as running a JVM.

// 9. Create an install script that will ask for information such as the location of the starmade folder and download any prerequisites, such as StarNet.jar.  It would be nice if it could allow a person to select the starmade folder from an explorer window, but the intended use of this wrapper is on console only systems, so it should be able to tell what OS it is running on and whether there is a GUI available to determine how it asks for the information.


var starMadeFolder="/home/philip/Programs/StarMade/"
console.log("starMadeFolder set to: " + starMadeFolder);
var starMadeJar=starMadeFolder + "StarMade.jar";
console.log("starMadeJar set to: " + starMadeJar);
var starNet=starMadeFolder + "StarNet.jar";
console.log("starNet set to: " + starNet);

var javaMin="128m"
var javaMax="1024m"
var starMadeArguments="-server";
// var allArgs=javaArguments + " -jar" + starMadeJar + starMadeArguments;



var events = require('events');
var eventEmitter = new events.EventEmitter();

//Create an event handler:
var myEventHandler = function () {
    console.log('Total arguments: ' + arguments.length);
    let temp="";
    for (var i=0;i < arguments.length; i++){
        // console.log("Argument[" + i + "]: " + arguments[i]);
        temp+=arguments[i] + (temp ? "":" ");
    }
    console.log("Arguments: " + temp + "--end");
}

//Assign the event handler to an event:
eventEmitter.on('line', myEventHandler);

//Fire the 'line' event as a test to see that custom events are working:
eventEmitter.emit('line',"whatever","stuff");


// Taken from https://stackoverflow.com/questions/10232192/exec-display-stdout-live
// Running the starmade server process
var spawn = require('child_process').spawn;
var server = spawn("java", ["-Xms" + javaMin, "-Xmx" + javaMax,"-jar", starMadeJar,"-server"], {cwd: starMadeFolder});

server.stdout.on('data', function (data) {
  console.log('stdout: ' + data.toString());
});

server.stderr.on('data', function (data) {
  console.log('stderr: ' + data.toString());
});

server.on('exit', function (code) {
  console.log('child process exited with code ' + code.toString());
});


