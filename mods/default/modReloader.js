// The purpose of this default mod is to assist with reloading other mods (including itself)

// Pull the needed objects from the global variable.
var {event}=global;

event.on("init", init);
function init(){
    // name,category,adminOnly,displayInHelp,playersArray
    global.regCommand("reloadMods","HiddenHelpers",true,false);
    global.regCommand("listeners","HiddenHelpers",true,false);
}

event.on('command', command);
function command (player,command,args,messageObj) { // Normally we would not use the messageObj, but it's here if for some reason we want the command to operate differently depending on channel sent to
    if (command == "reloadmods"){
        player.botMsg("Initiating mod reload!");
        event.emit("reloadMods");
    } else if (command == "listeners"){
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
};
