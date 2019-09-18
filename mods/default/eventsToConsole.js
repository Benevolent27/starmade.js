var {event}=global;
var {toStringIfPossible}=global.objectHelper;
event.on('playerMessage', playerMsg)
async function playerMsg(messageObj) { // Handle messages sent from players
    // Expects message to be a message type object
    // 'playerMessage',new MessageObj(sender,receiver,receiverType,message),global);
    console.log("Message (type: " + messageObj.type +") DETECTED from " + toStringIfPossible(messageObj.sender) + " to " + toStringIfPossible(await messageObj.receiver) + ": " + messageObj.text);
};
event.on('playerSpawn', function(playerObj, SMNameObj) {
    console.log(`playerSpawn event--playerObj: ${toStringIfPossible(playerObj)}  SMNameObj: ${toStringIfPossible(SMNameObj)}`);
});
event.on('shipSpawn', function(playerObj,entityObj) {
    console.log(`shipSpawn event--playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
});
event.on('baseSpawn', function(playerObj,entityObj) {
    console.log(`baseSpawn event--playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
});
event.on('blueprintSpawn', function(spawnType,playerObj,blueprintObj,entityObj,sectorObj,factionObj) {
    console.log(`blueprintSpawn event--spawnType: ${spawnType}  playerObj: ${toStringIfPossible(playerObj)}  Blueprint name: ${toStringIfPossible(blueprintObj)}  UID: ${toStringIfPossible(entityObj)}  Sector: ${toStringIfPossible(sectorObj)}  Faction: ${toStringIfPossible(factionObj)}`);
});
event.on('playerSectorChange',function(player,startingCoords,endingCoords,playerSMName){
    console.log(`playerSectorChange event--playerObj: ${player.name}  startingCoords: ${toStringIfPossible(startingCoords)}  endingCoords: ${toStringIfPossible(endingCoords)}  playerSMName: ${toStringIfPossible(playerSMName)}`);
});
event.on('playerFactionJoin',function(playerObj,factionObj,factionNameString){
    console.log(`PlayerFactionJoin event--playerObj: ${toStringIfPossible(playerObj)}  factionObj: ${toStringIfPossible(factionObj)}  factionNameString: ${factionNameString}`);
});
event.on('playerFactionLeave',function(playerObj,factionObj,factionNameString){
    console.log(`playerFactionLeave event--playerObj: ${toStringIfPossible(playerObj)}  factionObj: ${toStringIfPossible(factionObj)}  factionNameString: ${factionNameString}`);
});
event.on('playerConnect',function(playerObj,playerSmNameObj){
    console.log(`playerConnect event--playerObj: ${toStringIfPossible(playerObj)}  playerSmNameObj: ${toStringIfPossible(playerSmNameObj)}`);
});
event.on('playerDisconnect',function(playerObj,playerSmNameObj){
    console.log(`playerDisconnect event--playerObj: ${toStringIfPossible(playerObj)}  playerSmNameObj: ${toStringIfPossible(playerSmNameObj)}`);
});
event.on('playerDeath',function(personObj,deathType,responsibleEntityObj,responsibleFactionObj,killerObj){
    console.log(`playerDeath event--personObj: ${toStringIfPossible(personObj)}  deathType: ${toStringIfPossible(deathType)}  responsibleEntityObj: ${toStringIfPossible(responsibleEntityObj)}  responsibleFactionObj: ${toStringIfPossible(responsibleFactionObj)}  killerObj: ${toStringIfPossible(killerObj)}`);
});
event.on('entityOverheat',function(entityObj,sectorObj,playerObj,playerSMNameObj){
    console.log(`entityOverheat event--entityObj: ${toStringIfPossible(entityObj)} sectorObj: ${toStringIfPossible(sectorObj)}  playerObj: ${toStringIfPossible(playerObj)}  playerSMNameObj: ${toStringIfPossible(playerSMNameObj)}`);
});
event.on('entityOverheatStopped', function(theEntityObj){
    console.log(`entityOverheatStopped event--theEntityObj: ${toStringIfPossible(theEntityObj)}`);
});
