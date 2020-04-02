// Updated to use installObj

// The purpose of this default mod is to assist with reloading other mods (including itself)

var installObj = global.getInstallObj(__dirname);
var installPath=installObj.path;
var {settings,event}=installObj;
var thisConsole=installObj.console;
var serverObj={};
event.on("start",function(theServerObj){
  serverObj=theServerObj;
});

event.on('commandStart',function(regCommand){
    regCommand("reloadMods","HiddenHelpers",true,false,{},reloadModsCommand); // Admin only command
    regCommand("listeners","HiddenHelpers",true,false,{},listeners);
});

function listeners (player,command,args,messageObj) { // Normally we would not use the messageObj, but it's here if for some reason we want the command to operate differently depending on channel sent to
  player.botMsg("Displaying event listeners to the wrapper console..",{fast:true}).catch((err) => console.error(err));
  thisConsole.log("command:");
  thisConsole.dir(event.listeners('command'));
  thisConsole.log("playerSpawn:");
  thisConsole.dir(event.listeners('playerSpawn'));
  thisConsole.log("shipSpawn:");
  thisConsole.dir(event.listeners('shipSpawn'));
  thisConsole.log("baseSpawn:");
  thisConsole.dir(event.listeners('baseSpawn'));
  thisConsole.log("blueprintSpawn:");
  thisConsole.dir(event.listeners('blueprintSpawn'));
  thisConsole.log("reloadMods:");
  thisConsole.dir(event.listeners('reloadMods'));
}

function reloadModsCommand(player,command,args,messageObj){
  player.botMsg("Reloading non-default mods!  This might take a few seconds.",{fast:true}).catch((err) => console.error(err));
  installObj.reloadMods(); // This will emit a "unloadMods" event, which the serverObj is listening for
  // event.emit("unloadMods");
  // TODO: I need to send a global command to remove the event listeners, this will not suffice.
  player.botMsg("Done!",{fast:true}); // This is syncronous
}
