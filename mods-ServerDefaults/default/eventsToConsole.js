

// The purpose of this script is simply to output when events are triggered to the console.
// This script can be deleted if the text isn't wanted on the console.
// Note that this script can be used as a template for copy/paste into other scripts

if (__filename == require.main.filename){
  console.log("This script cannot be ran by itself!  Exiting!");
  process.exit();
}

// @ts-ignore
var installObj=global.getInstallObj(__dirname);
var {settings,log,event,defaultGlobalEvent,console:thisConsole}=installObj;
const objectHelper=require("./helpers/objectHelper.js");
const serverObjects=require("./serverObjects.js");
// const {SMNameObj}=serverObjects;
// const PlayerObj=serverObjects.PlayerObj;
// import {PlayerObj} from "./serverObjects.js";
class PlayerObj extends serverObjects.PlayerObj { };
class SMNameObj extends serverObjects.SMNameObj { };
class EntityObj extends serverObjects.EntityObj { };

/**
 * this is a description
 * @callback more
 * type
 * member serverObjects
 * @argument {PlayerObj} playerObj
 * @argument {SMNameObj} smNameObj
 * @argument {EntityObj} entityObj
 */


var {toStringIfPossible}=objectHelper;
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
    event.on('playerMessage',function(messageObj) { // Handle messages sent from players
      thisConsole.log("Event (playerMessage) emitted.  Message (type: " + messageObj.type +") DETECTED from " + toStringIfPossible(messageObj.sender) + " to " + toStringIfPossible(messageObj.receiver) + ": " + messageObj.text);
    });
    event.on('playerSpawn', 
      
      /**
       * this is a description
       * @param {PlayerObj} playerObj the player object
       * @param {SMNameObj} smNameObj the player's StarMade Registry account
       * @returns {any} The return value isn't important here
       */
      function(playerObj, smNameObj) {
      thisConsole.log(`Event (playerSpawn) emitted.  playerObj: ${toStringIfPossible(playerObj)}  SMNameObj: ${toStringIfPossible(smNameObj)}`);
    });
    event.on('shipSpawn', function(playerObj,entityObj) {
      thisConsole.log(`Event (shipSpawn) emitted.  playerObj: ${toStringIfPossible(playerObj)}  entityObj: ${toStringIfPossible(entityObj)}`);
    });
    event.on('baseSpawn', 
    /** @type {more} */
    function(playerObj,entityObj) {
      
      playerObj.addAdmin();
      
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
    event.on('playerDeath',function(deathObj){
      let deathObjKeys=Object.keys(deathObj);
      thisConsole.log(`Event (playerDeath) emitted (${deathCounter}) for player, ${deathObj.player.name}.  Info included: ${deathObjKeys.join(" ")}`);
      deathCounter+=1;
      // thisConsole.dir(deathObj);
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
