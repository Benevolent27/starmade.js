
// I highly recommend reading this article to understand how to do error handling with promises:
// https://javascript.info/promise-error-handling

var installObj=global.getInstallObj(__dirname); // Get the install object
var {event}=installObj;
event.on("playerSpawn", playerSpawn); // Should trigger whenever a player spots
function playerSpawn (player) {
    // These will complete as quickly as possible.  Any connection errors will just display on the console.
    player.botMsg("Welcome to the server you bodacious turtle!").catch((err) => console.error(err));
    player.botMsg("Welcome welcome!",{"type":"info"}).catch((err) => console.error(err));
};

