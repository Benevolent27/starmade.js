// This script is responsible for starting the server and firing off the event signifying the serverObj has been created.

const path=require('path');
var serverObjJs = require(path.join(__dirname,"serverObj.js"));
var {ServerObj} = serverObjJs;
// var serverPath=global.getServerPath(__dirname);
var installObj = global.getInstallObj(__dirname);
var {event}=installObj;
var serverObj = {}; // This will be set after the "start" is given.
event.on("init", function () { // Only start the server when the init is given, which is after all initial setup and installs have been done by starmade.js
  serverObj = new ServerObj(installObj.path); // The ServerObj loads it's own settings, installs itself if needed, and starts the server if autoStart is set to true.
  global.regServer(installObj.path, serverObj); // Registers the server to the global installObj and emits "start" which provides the serverObj
});
