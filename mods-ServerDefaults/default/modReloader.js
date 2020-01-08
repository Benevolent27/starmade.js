// The purpose of this default mod is to assist with reloading other mods (including itself)

// Pull the needed objects from the global variable.
var {event}=global;

var serverPath=global.getServerPath(__dirname);
event.on('start',function(forServerPath){
    if (forServerPath == serverPath){
        var serverObj=global.getServerObj(__dirname);
        var serverEvent=serverObj.event;
        serverObj.regCommand("reloadMods","HiddenHelpers",true,false);
        serverObj.regCommand("listeners","HiddenHelpers",true,false);
    }
    serverEvent.on('command', function (player,command,args,messageObj) { // Normally we would not use the messageObj, but it's here if for some reason we want the command to operate differently depending on channel sent to
        if (command == "reloadmods"){
            player.botMsg("Reloading all mods!  This might take a few seconds.");
            serverEvent.emit("reloadMods");
        } else if (command == "listeners"){
            console.log("command:");
            console.dir(serverEvent.listeners('command'));
            console.log("playerSpawn:");
            console.dir(serverEvent.listeners('playerSpawn'));
            console.log("shipSpawn:");
            console.dir(serverEvent.listeners('shipSpawn'));
            console.log("baseSpawn:");
            console.dir(serverEvent.listeners('baseSpawn'));
            console.log("blueprintSpawn:");
            console.dir(serverEvent.listeners('blueprintSpawn'));
            console.log("reloadMods:");
            console.dir(serverEvent.listeners('reloadMods'));
        }
    });
});

