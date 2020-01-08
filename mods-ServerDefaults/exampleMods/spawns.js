
// I highly recommend reading this article to understand how to do error handling with promises:
// https://javascript.info/promise-error-handling
var server=global.getServer(__dirname);
if (server !== null){
    server.event.on("playerSpawn", playerSpawn);
}
function playerSpawn (player) {
    // These will complete as quickly as possible.
    player.botMsg("Welcome to the server you bodacious turtle!").catch((err) => console.error(err));
    player.botMsg("Welcome welcome!",{"type":"info"}).catch((err) => console.error(err));
};

