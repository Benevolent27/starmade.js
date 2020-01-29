// This script is responsible for starting the server and firing off the event signifying the serverObj has been created.


var serverObjJs = require("serverObj.js");
var {ServerObj} = serverObjJs;
// var serverPath=global.getServerPath(__dirname);
var installObj = global.getInstallObj(__dirname);
installObj.event.on("init", function () { // Only start the server when the init is given, which is after all initial setup and installs have been done by starmade.js
  var serverObj = new ServerObj(installObj.path); // The ServerObj loads it's own settings, installs itself if needed, and starts the server if autoStart is set to true.
  global.regServer(installObj.path, serverObj); // Registers the server to the global installObj.
  installObj.event.emit('start', serverObj); // This is when mods should initialize themselves to utilize the serverObj.  This does NOT mean the server is started.
});
