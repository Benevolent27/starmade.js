global.event.on('playerMessage', function(messageObj) { // Handle messages sent from players
    // Expects message to be a message type object
    console.log("Message (type: " + messageObj.type +") DETECTED from " + messageObj.sender.name + " to " + messageObj.receiver.name + ": " + messageObj.text);
});
global.event.on('playerSpawn', function(playerSpawn) {
    console.log("playerSpawn detected.");
});
global.event.on('shipSpawn', function(shipSpawn) {
    console.log("shipSpawn detected.");
    let mMessage="/server_message_to plain " + shipSpawn.playerName + " 'Melvin: THAT is one nice ship: " + shipSpawn.shipName + "'";
    global["server"].spawn.stdin.write(mMessage.toString().trim() + "\n");
});
global.event.on('baseSpawn', function(baseSpawn) {
    console.log("baseSpawn detected.");
    let mMessage="/server_message_to plain " + baseSpawn.playerName + " 'Melvin: Cool new base dude! " + baseSpawn.baseName + "'";
    global["server"].spawn.stdin.write(mMessage.toString().trim() + "\n");
});
