// This script is responsible for starting the server and firing off the event signifying the serverObj has been created.

const path=require('path');
var serverObjJs = require(path.join(__dirname,"serverObj.js"));
var {ServerObj} = serverObjJs;
// var serverPath=global.getServerPath(__dirname);
var installObj = global.getInstallObj(__dirname);
var {event}=installObj;
var installPath=installObj.path;
const thisConsole=installObj.console;
var serverObj = {}; // This will be set after the "start" is given.
event.on("init", function () { // Only start the server when the init is given, which is after all initial setup and installs have been done by starmade.js
  thisConsole.log("Creating server object..");
  serverObj = new ServerObj(installObj.path); // The ServerObj loads it's own settings, installs itself if needed, and starts the server if autoStart is set to true.
  thisConsole.log("Registering server object..");
  global.regServer(installObj.path, serverObj); // Registers the server to the global installObj and emits "start" which provides the serverObj
});

// ####  Server restart code  ####
// Simple restarter for unexpected shutdowns
event.on("serverStop",function(){ // This will catch errors as well
  if (serverObj.spawnStatusWanted == "started"){ // Only do something if the server SHOULD BE started
    if (serverObj.settings.autoRestart == true){ // Only restart it if set to autoRestart
      if (serverObj.spawnStatus == "errored"){
        thisConsole.log("Server shut down with an error!  Restarting it!");
        global.log(`Server (${installPath}) shut down with an error!  Restarting it!`);
      } else {
        thisConsole.log("Server shut down unexpectedly!  Restarting it!");
        global.log(`Server (${installPath}) shut down unexpectedly!  Restarting it!`);
      }
      serverObj.start().catch((err) => console.error(err));
    } else if (serverObj.spawnStatus == "errored"){ // If not set to auto-restart, do nothing, but log the issue.
        thisConsole.log("Server shut down with an error, but not set to auto-restart, so doing nothing!");
        global.log(`Server (${installPath}) shut down with an error, but not set to auto-restart, so doing nothing!`);
    } else {
      thisConsole.log("Server shut down unexpectedly, but not set to auto-restart, so doing nothing!");
      global.log(`Server (${installPath}) shut down unexpectedly, but not set to auto-restart, so doing nothing!`);
    }
  }
});
