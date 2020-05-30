
// The purpose of this script is simply to output when events are triggered to the console.
// This script can be deleted if the text isn't wanted on the console.
// Note that this script can be used as a template for copy/paste into other scripts


var installObj=global.getInstallObj(__dirname);
var {settings,log,event,defaultGlobalEvent}=installObj;
const thisConsole=installObj.console;
var {toStringIfPossible}=global.objectHelper;
var deathCounter=1;
// var serverObj={};
defaultGlobalEvent.on("init",function(){ // ONLY NECESSARY FOR DEFAULT MODS SINCE THEY DO NOT RELOAD ON MODRELOAD()
  event.on('commandStart',function(){
    thisConsole.log("Event (commandStart) emitted.");
    event.on('playerCommand', function(playerObj, commandStr, argumentsArray, messageObj) { // Handle messages sent from players
      thisConsole.log("Event (playerCommand) emitted.  Message (type: " + messageObj.type +") DETECTED from " + toStringIfPossible(messageObj.sender) + " to " + toStringIfPossible(messageObj.receiver) + ": " + messageObj.text);
    });
  });
  event.on('start',function(theServerObj){
    // serverObj=theServerObj;
    // In-Game events
    event.on('playerMessage', function(messageObj) { // Handle messages sent from players
      thisConsole.log("Event (playerMessage) emitted.  Message (type: " + messageObj.type +") DETECTED from " + toStringIfPossible(messageObj.sender) + " to " + toStringIfPossible(messageObj.receiver) + ": " + messageObj.text);
    });
    event.on('playerSpawn', function(playerObj, SMNameObj) {
      thisConsole.log(`Event (playerSpawn) emitted.  playerObj: ${toStringIfPossible(playerObj)}  SMNameObj: ${toStringIfPossible(SMNameObj)}`);
    });
    event.on('shipSpawn', function(playerObj,entityObj) {
      thisConsole.log(`Event (shipSpawn) emitted.  playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
    });
    event.on('baseSpawn', function(playerObj,entityObj) {
      thisConsole.log(`Event (baseSpawn) emitted.  playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
    });
    event.on('blueprintSpawn', function(spawnType,playerObj,blueprintObj,entityObj,sectorObj,factionObj) {
      thisConsole.log(`Event (blueprintSpawn) emitted.  spawnType: ${spawnType}  playerObj: ${toStringIfPossible(playerObj)}  Blueprint name: ${toStringIfPossible(blueprintObj)}  UID: ${toStringIfPossible(entityObj)}  Sector: ${toStringIfPossible(sectorObj)}  Faction: ${toStringIfPossible(factionObj)}`);
    });
    event.on('playerSectorChange',function(player,startingCoords,endingCoords,playerSMName){
      thisConsole.log(`Event (playerSectorChange) emitted.  playerObj: ${player.name}  startingCoords: ${toStringIfPossible(startingCoords)}  endingCoords: ${toStringIfPossible(endingCoords)}  playerSMName: ${toStringIfPossible(playerSMName)}`);
    });
    event.on('playerFactionJoin',function(playerObj,factionObj,factionNameString){
      thisConsole.log(`Event (PlayerFactionJoin) emitted.  playerObj: ${toStringIfPossible(playerObj)}  factionObj: ${toStringIfPossible(factionObj)}  factionNameString: ${factionNameString}`);
    });
    event.on('playerFactionLeave',function(playerObj,factionObj,factionNameString){
      thisConsole.log(`Event (playerFactionLeave) emitted.  playerObj: ${toStringIfPossible(playerObj)}  factionObj: ${toStringIfPossible(factionObj)}  factionNameString: ${factionNameString}`);
    });
    event.on('playerConnect',function(playerObj,playerSmNameObj){
      thisConsole.log(`Event (playerConnect) emitted.   playerObj: ${toStringIfPossible(playerObj)}  playerSmNameObj: ${toStringIfPossible(playerSmNameObj)}`);
    });
    event.on('playerDisconnect',function(playerObj,playerSmNameObj){
      thisConsole.log(`Event (playerDisconnect) emitted.   playerObj: ${toStringIfPossible(playerObj)}  playerSmNameObj: ${toStringIfPossible(playerSmNameObj)}`);
    });
    // OLD - TODO:  Delete the obsoleted death event
    // event.on('playerDeath',function(personObj,deathType,responsibleEntityObj,responsibleFactionObj,killerObj){
    //   thisConsole.log(`Event (playerDeath) emitted.   personObj: ${toStringIfPossible(personObj)}  deathType: ${toStringIfPossible(deathType)}  responsibleEntityObj: ${toStringIfPossible(responsibleEntityObj)}  responsibleFactionObj: ${toStringIfPossible(responsibleFactionObj)}  killerObj: ${toStringIfPossible(killerObj)}`);
    // });
    
    event.on('playerDeath',function(deathObj){
      thisConsole.log(`Event (playerDeath) emitted (${deathCounter}):`);
      deathCounter+=1;
      thisConsole.dir(deathObj);
    });

    
    event.on('entityOverheat',function(entityObj,sectorObj,playerObj,playerSMNameObj){
      thisConsole.log(`Event (entityOverheat) emitted.   entityObj: ${toStringIfPossible(entityObj)} sectorObj: ${toStringIfPossible(sectorObj)}  playerObj: ${toStringIfPossible(playerObj)}  playerSMNameObj: ${toStringIfPossible(playerSMNameObj)}`);
    });
    event.on('entityOverheatStopped', function(theEntityObj){
      thisConsole.log(`Event (entityOverheatStopped) emitted.   theEntityObj: ${toStringIfPossible(theEntityObj)}`);
    });
    event.on('systemFactionClaimed', function(systemObj,entityObj,factionObj){
      thisConsole.log(`Event (systemFactionClaimed) emitted.   systemObj: ${toStringIfPossible(systemObj)}  entityObj: ${toStringIfPossible(entityObj)}  factionObj: ${toStringIfPossible(factionObj)}`);
    });
    event.on('systemFactionUnclaimed', function(systemObj,entityObj){
      thisConsole.log(`Event (systemFactionUnclaimed) emitted.   systemObj: ${toStringIfPossible(systemObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
    });
  });
  event.on('serverStart',function(){
    thisConsole.log("Event (serverStart) emitted.");
  });
  event.on('serverStopping',function(){
    thisConsole.log("Event (serverStopping) emitted.");
  });
  event.on('serverStop',function(){
    thisConsole.log("Event (serverStop) emitted.");
  });
  event.on('serverError',function(){
    thisConsole.log("Event (serverError) emitted.");
  });
  event.on('serverDisconnect',function(){
    thisConsole.log("Event (serverDisconnect) emitted.");
  });
});
