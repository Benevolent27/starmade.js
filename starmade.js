#!/usr/bin/nodejs
var starMadeFolder="/home/philip/Programs/StarMade/"
console.log("starMadeFolder set to: " + starMadeFolder);
var starMadeJar=starMadeFolder + "StarMade.jar";
console.log("starMadeJar set to: " + starMadeJar);
var starNet=starMadeFolder + "StarNet.jar";
console.log("starNet set to: " + starNet);

var javaMin="-Xms128m"
var javaMax="-Xmx1024m"
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

//Fire the 'line' event:
eventEmitter.emit('line',"whatever","stuff");


// Taken from https://stackoverflow.com/questions/10232192/exec-display-stdout-live
// Running the starmade server process
var spawn = require('child_process').spawn;
var server = spawn("java", [javaMin, javaMax,"-jar", starMadeJar,"-server"], {cwd: starMadeFolder});

server.stdout.on('data', function (data) {
  console.log('stdout: ' + data.toString());
});

server.stderr.on('data', function (data) {
  console.log('stderr: ' + data.toString());
});

server.on('exit', function (code) {
  console.log('child process exited with code ' + code.toString());
});


