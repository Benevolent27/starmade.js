var {event}=global;
var {toStringIfPossible}=global.objectHelper;
var serverPath=global.getServerPath(__dirname);
event.on('start',function(forServerPath){
    if (forServerPath == serverPath){
        var serverObj=global.getServerObj(__dirname);
        var serverEvent=serverObj.event;
        serverEvent.on('playerMessage', function(messageObj) { // Handle messages sent from players
            console.log("Message (type: " + messageObj.type +") DETECTED from " + toStringIfPossible(messageObj.sender) + " to " + toStringIfPossible(messageObj.receiver) + ": " + messageObj.text);
        });
        serverEvent.on('playerSpawn', function(playerObj, SMNameObj) {
            console.log(`playerSpawn event--playerObj: ${toStringIfPossible(playerObj)}  SMNameObj: ${toStringIfPossible(SMNameObj)}`);
        });
        serverEvent.on('shipSpawn', function(playerObj,entityObj) {
            console.log(`shipSpawn event--playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
        });
        serverEvent.on('baseSpawn', function(playerObj,entityObj) {
            console.log(`baseSpawn event--playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
        });
        serverEvent.on('blueprintSpawn', function(spawnType,playerObj,blueprintObj,entityObj,sectorObj,factionObj) {
            console.log(`blueprintSpawn event--spawnType: ${spawnType}  playerObj: ${toStringIfPossible(playerObj)}  Blueprint name: ${toStringIfPossible(blueprintObj)}  UID: ${toStringIfPossible(entityObj)}  Sector: ${toStringIfPossible(sectorObj)}  Faction: ${toStringIfPossible(factionObj)}`);
        });
        serverEvent.on('playerSectorChange',function(player,startingCoords,endingCoords,playerSMName){
            console.log(`playerSectorChange event--playerObj: ${player.name}  startingCoords: ${toStringIfPossible(startingCoords)}  endingCoords: ${toStringIfPossible(endingCoords)}  playerSMName: ${toStringIfPossible(playerSMName)}`);
        });
        serverEvent.on('playerFactionJoin',function(playerObj,factionObj,factionNameString){
            console.log(`PlayerFactionJoin event--playerObj: ${toStringIfPossible(playerObj)}  factionObj: ${toStringIfPossible(factionObj)}  factionNameString: ${factionNameString}`);
        });
        serverEvent.on('playerFactionLeave',function(playerObj,factionObj,factionNameString){
            console.log(`playerFactionLeave event--playerObj: ${toStringIfPossible(playerObj)}  factionObj: ${toStringIfPossible(factionObj)}  factionNameString: ${factionNameString}`);
        });
        serverEvent.on('playerConnect',function(playerObj,playerSmNameObj){
            console.log(`playerConnect event--playerObj: ${toStringIfPossible(playerObj)}  playerSmNameObj: ${toStringIfPossible(playerSmNameObj)}`);
        });
        serverEvent.on('playerDisconnect',function(playerObj,playerSmNameObj){
            console.log(`playerDisconnect event--playerObj: ${toStringIfPossible(playerObj)}  playerSmNameObj: ${toStringIfPossible(playerSmNameObj)}`);
        });
        serverEvent.on('playerDeath',function(personObj,deathType,responsibleEntityObj,responsibleFactionObj,killerObj){
            console.log(`playerDeath event--personObj: ${toStringIfPossible(personObj)}  deathType: ${toStringIfPossible(deathType)}  responsibleEntityObj: ${toStringIfPossible(responsibleEntityObj)}  responsibleFactionObj: ${toStringIfPossible(responsibleFactionObj)}  killerObj: ${toStringIfPossible(killerObj)}`);
        });
        serverEvent.on('entityOverheat',function(entityObj,sectorObj,playerObj,playerSMNameObj){
            console.log(`entityOverheat event--entityObj: ${toStringIfPossible(entityObj)} sectorObj: ${toStringIfPossible(sectorObj)}  playerObj: ${toStringIfPossible(playerObj)}  playerSMNameObj: ${toStringIfPossible(playerSMNameObj)}`);
        });
        serverEvent.on('entityOverheatStopped', function(theEntityObj){
            console.log(`entityOverheatStopped event--theEntityObj: ${toStringIfPossible(theEntityObj)}`);
        });
    }
});

