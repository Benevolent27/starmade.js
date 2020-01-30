// The purpose of this default mod is to assist with reloading other mods (including itself)

var installObj = global.getInstallObj(__dirname);
var installPath=installObj.path;
var {settings,event,reloadMods}=installObj;
event.on('commandStart',function(serverObj){
    serverObj.regCommand("reloadMods","HiddenHelpers",true,false);
    serverObj.regCommand("listeners","HiddenHelpers",true,false);
    event.on('command', function (player,command,args,messageObj) { // Normally we would not use the messageObj, but it's here if for some reason we want the command to operate differently depending on channel sent to
        if (command == "reloadmods"){
            player.botMsg("Reloading all mods!  This might take a few seconds.");
            reloadMods(); // This will emit a "unloadMods" event
            // event.emit("unloadMods");
            // TODO: I need to send a global command to remove the event listeners, this will not suffice.
            player.botMsg("Done!");
        } else if (command == "listeners"){ // TODO: Change this so it looks at all event listeners and then lists each.
            console.log("command:");
            console.dir(event.listeners('command'));
            console.log("playerSpawn:");
            console.dir(event.listeners('playerSpawn'));
            console.log("shipSpawn:");
            console.dir(event.listeners('shipSpawn'));
            console.log("baseSpawn:");
            console.dir(event.listeners('baseSpawn'));
            console.log("blueprintSpawn:");
            console.dir(event.listeners('blueprintSpawn'));
            console.log("reloadMods:");
            console.dir(event.listeners('reloadMods'));
        }
    });
});

