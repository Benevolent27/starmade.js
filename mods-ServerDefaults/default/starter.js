// This script is responsible for starting the server and firing off the event signifying the serverObj has been created.

const path=require('path');
var serverObjJs = require(path.join(__dirname,"serverObj.js"));
var {ServerObj} = serverObjJs;
// var serverPath=global.getServerPath(__dirname);
var installObj = global.getInstallObj(__dirname);
var {event,defaultGlobalEvent}=installObj;
var installPath=installObj.path;
const thisConsole=installObj.console;
var serverObj = {}; // This will be set after the "start" is given.

defaultGlobalEvent.on("init",function(){ // ONLY NECESSARY FOR DEFAULT MODS SINCE THEY DO NOT RELOAD ON MODRELOAD()
  // Only start the server when the init is given, which is after all initial setup and installs have been done by starmade.js
  if (!installObj.hasOwnProperty("serverObj")){ // Only create and register the serverObj if it doesn't exist already.
    thisConsole.log("Creating server object and registering it..");
    serverObj=new ServerObj(installObj.path);
    global.regServer(installObj.path, serverObj); // Registers the server to the global installObj
    // The constructor will resolve issues if a prior server was already running and not stopped (such as if the starmade.js script was SIGKILLed)
  }

  // Register all the listeners - this happens again if the reloadmods() occurs.
  // ##########################
  // ####   AUTO-STARTER   ####  --- Starts the server when the wrapper starts if it's set to auto-start.
  // ##########################
  event.on("start",function(theServerObj){
    // serverObj=theServerObj; Not necessary since this should have already been set when the ServerObj was created
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

  //  ####################################
  //  ### INSTALL VERIFIER AND EMITTER ### - Check to ensure the server is installed and install it if not
  //  ####################################
  return serverObj.isInstalled("",function(err,result){
    if (err){
      console.log("ERROR: Could not check if server was installed!  Do you have read permission to the install folder?");
      throw err;
    }
    if (result == true){ // INSTALLED - verify the config files exist
      return serverObj.verifyInstall("",function(err,result){ // This generates the configs if they don't exist
        if (err){
          throw err;
        }
        if (result == true){ // is installed and configs exist

          return start();
        }
        throw new Error("Could not verify install: " + installObj.path); // This should never happen
      });
    } else { // NOT INSTALLED - install the server first, then emit the object
      return serverObj.install({branch:serverObj.buildBranch},function(err,result){ // This also generates configs
        if (err){
          console.log("Unable to install the StarMade server!  Do you have write permission to the folder??");
        }
        if (result == true){ // During install routine, configs are generated, so no need to check.
          thisConsole.log("StarMade server installed successfully!");
          return start();
        } else {
          console.log("StarMade install failed!  Cannot continue!"); // This should never happen
          throw new Error("StarMade server install failed!");
        }
      });
    }
  });
});
function start(){
  // this is used to force the super admin password and server.cfg file to be loaded.
  serverObj.getSuperAdminPassword(); // Forces the user to update the super admin password if it is still the defaults (or if it is not set)
  return event.emit("start",installObj.serverObj);
}
