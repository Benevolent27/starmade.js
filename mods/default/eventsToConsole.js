global.event.on('playerMessage', playerMsg)
async function playerMsg(messageObj) { // Handle messages sent from players
    // Expects message to be a message type object
    // 'playerMessage',new MessageObj(sender,receiver,receiverType,message),global);
    console.log("Message (type: " + messageObj.type +") DETECTED from " + messageObj.sender.toString() + " to " + await messageObj.receiver.toString() + ": " + messageObj.text);
};
global.event.on('playerSpawn', function(playerSpawn) {
    console.log("playerSpawn detected.");
});
global.event.on('shipSpawn', function(playerObj,entityObj) {
    console.log("shipSpawn detected for player, " + playerObj.toString() + ".  Entity: " + entityObj.toString());
    // let mMessage="/server_message_to plain " + playerObj + " 'Melvin: THAT is one nice ship: " + shipSpawn.shipName + "'";
    // global["server"].spawn.stdin.write(mMessage.toString().trim() + "\n");
});
global.event.on('baseSpawn', function(playerObj,entityObj) {
    console.log("baseSpawn detected for player, " + playerObj.toString() + ".  Entity: " + entityObj.toString());
    // let mMessage="/server_message_to plain " + baseSpawn.playerName + " 'Melvin: Cool new base dude! " + baseSpawn.baseName + "'";
    // global["server"].spawn.stdin.write(mMessage.toString().trim() + "\n");
});
global.event.on('blueprintSpawn', function(spawnType,playerObj,blueprintObj,entityObj,sectorObj,factionObj) {
    console.log("blueprintSpawn detected. spawnType: " + spawnType + " Blueprint name: " + blueprintObj.toString() + " UID: " + entityObj.toString() + " Sector: " +  sectorObj.toString() + " Faction: " + factionObj.toString());
    // playerObj.botMsg("Cool new blueprint! spawnType: " + spawnType + " Blueprint name: " + blueprintObj.toString() + " UID: " + entityObj.toString() + " Sector: " +  sectorObj.toString() + " Faction: " + factionObj.toString());
});


