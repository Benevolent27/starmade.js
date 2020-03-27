// Updated to use installObj
var installObj=global.getInstallObj(__dirname);
var {event,settings,log}=installObj; // TODO: Add console back once it's working.
const thisConsole=installObj.console;
var {toStringIfPossible}=global.objectHelper;
// var serverObj={};
event.on('start',function(theServerObj){
        // serverObj=theServerObj;
        event.on('playerMessage', function(messageObj) { // Handle messages sent from players
            thisConsole.log("Message (type: " + messageObj.type +") DETECTED from " + toStringIfPossible(messageObj.sender) + " to " + toStringIfPossible(messageObj.receiver) + ": " + messageObj.text);
        });
        event.on('playerSpawn', function(playerObj, SMNameObj) {
            thisConsole.log(`playerSpawn event--playerObj: ${toStringIfPossible(playerObj)}  SMNameObj: ${toStringIfPossible(SMNameObj)}`);
        });
        event.on('shipSpawn', function(playerObj,entityObj) {
            thisConsole.log(`shipSpawn event--playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
        });
        event.on('baseSpawn', function(playerObj,entityObj) {
            thisConsole.log(`baseSpawn event--playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
        });
        event.on('blueprintSpawn', function(spawnType,playerObj,blueprintObj,entityObj,sectorObj,factionObj) {
            thisConsole.log(`blueprintSpawn event--spawnType: ${spawnType}  playerObj: ${toStringIfPossible(playerObj)}  Blueprint name: ${toStringIfPossible(blueprintObj)}  UID: ${toStringIfPossible(entityObj)}  Sector: ${toStringIfPossible(sectorObj)}  Faction: ${toStringIfPossible(factionObj)}`);
        });
        event.on('playerSectorChange',function(player,startingCoords,endingCoords,playerSMName){
            thisConsole.log(`playerSectorChange event--playerObj: ${player.name}  startingCoords: ${toStringIfPossible(startingCoords)}  endingCoords: ${toStringIfPossible(endingCoords)}  playerSMName: ${toStringIfPossible(playerSMName)}`);
        });
        event.on('playerFactionJoin',function(playerObj,factionObj,factionNameString){
            thisConsole.log(`PlayerFactionJoin event--playerObj: ${toStringIfPossible(playerObj)}  factionObj: ${toStringIfPossible(factionObj)}  factionNameString: ${factionNameString}`);
        });
        event.on('playerFactionLeave',function(playerObj,factionObj,factionNameString){
            thisConsole.log(`playerFactionLeave event--playerObj: ${toStringIfPossible(playerObj)}  factionObj: ${toStringIfPossible(factionObj)}  factionNameString: ${factionNameString}`);
        });
        event.on('playerConnect',function(playerObj,playerSmNameObj){
            thisConsole.log(`playerConnect event--playerObj: ${toStringIfPossible(playerObj)}  playerSmNameObj: ${toStringIfPossible(playerSmNameObj)}`);
        });
        event.on('playerDisconnect',function(playerObj,playerSmNameObj){
            thisConsole.log(`playerDisconnect event--playerObj: ${toStringIfPossible(playerObj)}  playerSmNameObj: ${toStringIfPossible(playerSmNameObj)}`);
        });
        event.on('playerDeath',function(personObj,deathType,responsibleEntityObj,responsibleFactionObj,killerObj){
            thisConsole.log(`playerDeath event--personObj: ${toStringIfPossible(personObj)}  deathType: ${toStringIfPossible(deathType)}  responsibleEntityObj: ${toStringIfPossible(responsibleEntityObj)}  responsibleFactionObj: ${toStringIfPossible(responsibleFactionObj)}  killerObj: ${toStringIfPossible(killerObj)}`);
        });
        event.on('entityOverheat',function(entityObj,sectorObj,playerObj,playerSMNameObj){
            thisConsole.log(`entityOverheat event--entityObj: ${toStringIfPossible(entityObj)} sectorObj: ${toStringIfPossible(sectorObj)}  playerObj: ${toStringIfPossible(playerObj)}  playerSMNameObj: ${toStringIfPossible(playerSMNameObj)}`);
        });
        event.on('entityOverheatStopped', function(theEntityObj){
            thisConsole.log(`entityOverheatStopped event--theEntityObj: ${toStringIfPossible(theEntityObj)}`);
        });
});

