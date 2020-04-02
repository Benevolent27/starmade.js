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
  if (!installObj.hasOwnProperty("serverObj")){ // Only create and register the serverObj if it doesn't exist already.
    thisConsole.log("Creating server object and registering it..");
    global.regServer(installObj.path, new ServerObj(installObj.path)); // Registers the server to the global installObj
  }
  event.emit("start",installObj.serverObj);
});

  // ##########################
  // ####   AUTO-STARTER   ####  --- Starts the server when the wrapper starts if it's set to auto-start.
  // ##########################
event.on("start",function(theServerObj){
  serverObj=theServerObj;
  if (serverObj.settings.autoStart == true){
    if (serverObj.spawnStatus != "started"){
      thisConsole.log("Auto-start is on!  Starting server..");
      global.log(`Server (${installPath}): Auto-starting server.`);
      serverObj.start();
    }
  }
});

// #####################
// ####  RESTARTER  #### --- Simple restarter for unexpected shutdowns
// #####################

event.on("serverStop",function(){ // This will catch errors as well
  // This needs to NOT catch a .restart() command.
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

  // #############################
  // ####   RELOADING MODS    ####
  // #############################
event.on("unloadMods",function(){ // Shut down the server and any pids, quickly.
  // thisConsole.log("unloadMods event detected!  Killing all PIDs!");
  // self.killAllPIDs();
  // Unregister any constructors
  thisConsole.log("Unregistering all constructors..");
  serverObj.deregAllConstructors();
});
