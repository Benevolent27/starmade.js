// Emits events based on pattern matching

if (__filename == require.main.filename){
  console.log("This script cannot be ran by itself!  Exiting!");
  process.exit();
}

module.exports = { // IMPORTANT: These cannot be used until the serverObj has been created for the install
  processDataInput,
  processServerlogDataInput
}

// This script needs to read from the server settings, so it needs the installObj
var installObj = global.getInstallObj(__dirname);
var {settings,event,defaultEvent,defaultGlobalEvent,console:thisConsole}=installObj;
var serverObj = {}; // This will be set after the "start" is given.
defaultGlobalEvent.on("init",function(){ // ONLY NECESSARY FOR DEFAULT MODS SINCE THEY DO NOT RELOAD ON MODRELOAD()
  event.on("start", function (theServerObj) {
    serverObj = theServerObj;
  });
});

const path = require('path');
const patterns = require("./patterns.js"); // Import the patterns that will be used to match to in-game events like deaths and messages.
var includePatternRegex = patterns.includes();
var excludePatternRegex = patterns.excludes();
var includePatternServerLogRegex = patterns.serverLogIncludes();
var excludePatternServerLogRegex = patterns.serverLogExcluded();

const starNet = require("./starNet.js");
var {
  getUIDfromName,
  getFactionNumberFromName,
  getFactionObjFromName
} = starNet;
const objectHelper = require("./helpers/objectHelper.js");
const miscHelpers = require("./helpers/miscHelpers.js");
const ini=require("./helpers/iniHelper.js");
const {getVal}=ini;

var {
  getSimpleTime,
  getSimpleDate
} = miscHelpers;
var {
  repeatString,
  isInArray,
  getRandomAlphaNumericString,
  arrayMinus,
  copyArray,
  toStringIfPossible,
  toNumIfPossible,
  testIfInput,
  simplePromisifyIt,
  listObjectMethods,
  getParamNames
} = objectHelper;

var playerDeathRegistry={};

var minIntervalPerPlayerDeath=5; // A player can only die once per a given number of seconds.  When multiple outputs kill a player, multiple console lines appear, so this protects from multiple events firing for the same death.
defaultEvent.on("serverStart",function(serverObj){
  let serverCfgObj=serverObj.getServerCfgAsIniObj();
  let tempVal=toNumIfPossible(getVal(serverCfgObj,"SPAWN_PROTECTION")); // This is the number of invulnerable seconds a player has
  if (typeof tempVal == "number"){
    if (tempVal > 1){
      minIntervalPerPlayerDeath=tempVal - 1; // We don't necessarily want it to be equal, in case lag or rounding happens
    } else { // If protection is disabled, we still need to have a protection amount of something to avoid duplicate death counts.
      minIntervalPerPlayerDeath=1;
    }
  }
});

defaultEvent.on("playerFactionLeave",function(nameObj, factionObj, factionNameStr){
  // Check if the faction still exists or not, and if not, emit a factionDisbanded event
  return factionObj.exists("",function(err,result){
    if (err){
      return console.error(err);
    }
    if (result === false){
      event.emit("factionDisbanded",factionObj,factionNameStr);
      return true;
    }
    return false;
  });
});

function processDataInput(dataInput) { // This function is run on every single line that is output by the server console.
  if (testMatch(dataInput)) { // Check to see if the message fits any of the regex patterns

    // TODO:  There needs to be a separate processing for the serverlog.0.log file, console, and stdout since there are some duplicates between the console.  This would also be faster.

    if (settings.showAllEvents == true) {
      thisConsole.log("Event found!: " + dataInput + "Arguments: " + arguments.length);
    }
    let theArguments = arguments[0].split(" "); // This is to allow easier parsing of each individual word in the line

    // enumerateEventArguments=true; // Temporary
    if (settings.enumerateEventArguments == true) {
      for (let i = 0;i < theArguments.length;i++) {
        thisConsole.log("stderr--theArguments[" + i + "]: " + theArguments[i]);
      }
    }
    // ### Player Messages ###
    if (theArguments[0] == "[CHANNELROUTER]") { // This is for all messages, including commands.
      let sender = dataInput.match(/\[sender=[A-Za-z0-9_-]*/).toString().replace(/^\[sender=/, "");
      let receiver = dataInput.match(/\[receiver=[A-Za-z0-9_-]*/).toString().replace(/^\[receiver=/, "");
      let receiverType = dataInput.match(/\[receiverType=[A-Za-z0-9_-]*/).toString().replace(/^\[receiverType=/, "");
      let message = dataInput.match(/\[message=.*(?=\]$)/).toString().replace(/^\[message=/, "");
      //arguments[0]: [CHANNELROUTER] RECEIVED MESSAGE ON Server(0): [CHAT][sender=Benevolent27][receiverType=CHANNEL][receiver=all][message=words]
      // thisConsole.log("Message found: ");
      // thisConsole.log("sender: " + sender);
      // thisConsole.log("receiver: " + receiver);
      // thisConsole.log("receiverType: " + receiverType);
      // thisConsole.log("message: " + message);
      event.emit('playerMessage', new installObj.objects.MessageObj(sender, receiver, receiverType, message));

    } else if ((/^\[SERVER\]\[SPAWN\] SPAWNING NEW CHARACTER FOR/).test(dataInput)) {

      // STDERR: [SERVER][SPAWN] SPAWNING NEW CHARACTER FOR PlS[Weedle [Benevolent27]*; id(2)(1)f(10001)]

      // Event found!: [SERVER][SPAWN] SPAWNING NEW CHARACTER FOR PlS[Benevolent27 ; id(2)(1)f(0)]Arguments: 1
      // theArguments[0]: [SERVER][SPAWN]
      // theArguments[1]: SPAWNING
      // theArguments[2]: NEW
      // theArguments[3]: CHARACTER
      // theArguments[4]: FOR
      // theArguments[5]: PlS[Benevolent27
      // theArguments[6]: ;
      // theArguments[7]: id(2)(1)f(0)]


      console.debug("Parsing possible player spawn.  dataInput: " + dataInput);
      if (/PlS\[.*/.test(theArguments[5].toString())) {
        let playerName = theArguments[5].split("[").pop();
        if (typeof playerName == "string") {
          // thisConsole.log("Player Spawned: " + playerName);
          if (settings["announceSpawnsToMainChat"] == "true") {
            let mMessage = "/server_message_broadcast plain " + "'" + playerName + " has spawned.'";
            serverObj.spawn.stdin.write(mMessage.toString().trim() + "\n");
          }
          let theReg = new RegExp(("(?<=PlS\\[" + playerName + " \\[)[^\\]]+"));
          let playerSMName = toStringIfPossible(dataInput.match(theReg));
          let playerObj = new installObj.objects.PlayerObj(playerName);
          let playerSMNameObj;
          if (typeof playerSMName == "string") {
            playerSMNameObj = new installObj.objects.SMNameObj(playerSMName);
          }
          playerObj["spawnTime"] = Math.floor((new Date()).getTime() / 1000);
          event.emit('playerSpawn', playerObj, playerSMNameObj);
        }
      }
      // Event found!: [SERVER] Object Ship[Benevolent27_1523388998134](355) didn't have a db entry yet. Creating entry!Arguments: 1
      // theArguments[0]: [SERVER]
      // theArguments[1]: Object
      // theArguments[2]: Ship[Benevolent27_1523388998134](355)
      // theArguments[3]: didn't
      // theArguments[4]: have
      // theArguments[5]: a
      // theArguments[6]: db
      // theArguments[7]: entry
      // theArguments[8]: yet.
      // theArguments[9]: Creating
      // theArguments[10]: entry!

      // ### PLAYER DEATHS ###
      // TODO: 
      // - Test planet core death
      // - Test Faction ships (including NPC's)
      // - Test Mines
    } else if ((/\[SERVERLOG\] \[DEATH\]/).test(dataInput)){
      var deathTime=new Date().getTime();
      var deadPlayerName=dataInput.match(/(?<=^\[SERVERLOG\] \[DEATH\] )[^ ]*/);
      // The console outputs multiple death messages for the same death if multiple outputs of a weapon killed a player at the same time
      // Normally servers have death protection on, so a player can only die a certain number of times per second
      // So we should be able to safely only allow up to 1 death message to get through per interval of seconds
      if (playerDeathRegistry.hasOwnProperty(deadPlayerName)){
        let deathTimeElapsed=deathTime - playerDeathRegistry[deadPlayerName];
        let minDeathTime=minIntervalPerPlayerDeath * 1000;
        if (deathTimeElapsed < minDeathTime){
          return false;
        }
      }
      playerDeathRegistry[deadPlayerName]=deathTime;
      var returnObj={};
      returnObj.deathTime=deathTime;
      
      

      returnObj.player=new installObj.objects.PlayerObj(deadPlayerName);
      // var controllableText=dataInput.match(/(?<=; controllable: ).*$/); // TODO: Delete this line

      // Controllable examples:
      // Star + Blackhole has Sector[ with coordinates
      // PlayerCharacter[ // PVP
      // PlS[ // Suicide
      // SpaceStation[ // Any spacestation with or without player in it
      // Ship[ // Any ship, with or without player in it
      // Planet( // Any Planet, with or without player in it
      var responsibleText=toStringIfPossible(dataInput.match(/(?<='Responsible: )[^[(]*/));
      if (typeof responsibleText != "string"){ // When a player is in the entity, it will be "Killer" instead
        responsibleText=toStringIfPossible(dataInput.match(/(?<='Killer: )[^[(]*/));
      }
      if (typeof responsibleText == "string"){
        responsibleText=responsibleText.replace(/ <.*>$/,""); // This is to remove the player name if piloting a ship or base
      }

      // [ ( <
      // Responsible: My new base[ // a base
      // Responsible: KillerMachine[ // a ship
      // Floating Rock <
      // Responsible: Sun[
      // Responsible: Black Hole[
      var controllableType=toStringIfPossible(dataInput.match(/(?<=; controllable: )[^[(]*/));
      if (typeof controllableType == "string"){
        controllableType=controllableType.trim();
      }
      // Types:
      // PlayerCharacter -- player kills another with hand weapon
      // PlS -- suicide
      // SpaceStation
      // Ship
      // Planet
      // ManagedAsteroid
      // Sector // can be either a star or a black hole
      // Mine
      var owner=toStringIfPossible(dataInput.match(/(?<=Owner=PlS\[)[^ ]*/)); // Will be null if no player
      var deathType;
      if (controllableType == "PlayerCharacter"){
        if (deadPlayerName == owner){ // Rocket launcher deaths
          deathType="suicide";
        } else {
          deathType="player";
        }
      } else if (controllableType == "PlS"){ // Menu suicides
        deathType="suicide";
      } else if (controllableType == "SpaceStation"){
        deathType="station";
      } else if (controllableType == "Ship"){
        deathType="ship";
      } else if (controllableType == "Planet"){
        deathType="planet";
      } else if (controllableType == "ManagedAsteroid"){
        deathType="asteroid";
      } else if (controllableType == "Sector"){
        if (responsibleText == "Sun"){
          deathType="star";
        } else if (responsibleText == "Black Hole"){
          deathType="blackHole";
        }
        var sectorTmp=toStringIfPossible(dataInput.match(/(?<=\()[-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+\)$/));
        if (typeof sectorTmp == "string"){
          sectorTmp=sectorTmp.replace(/\)$/,"");
          sectorTmp=sectorTmp.split(", ");
          if (sectorTmp.length==3){
            returnObj.sector=new installObj.objects.SectorObj(...sectorTmp);
          }
        }
      } else if (controllableType=="Mine"){
        deathType="mine";
        var mineData=toStringIfPossible(dataInput.match(/(?<=; controllable: Mine \[)[^\]]*/));
        if (typeof mineData == "string"){
          let mineID=toNumIfPossible(toStringIfPossible(mineData.match(/(?<=id=)[-]{0,1}[0-9]+/)));
          if (typeof mineID == "number"){
            returnObj.killerMineID=mineID;
          }
          let mineCoords=toStringIfPossible(mineData.match(/(?<=sectorPos=\()[-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+/));
          if (typeof mineCoords == "string"){
            mineCoords=mineCoords.split(", ");
            returnObj.sector=new installObj.objects.SectorObj(...mineCoords);
          }
          let mineType=toStringIfPossible(mineData.match(/(?<=mineType=)[^,]+/));
          if (typeof mineType == "string"){
            returnObj.KillerMineType=mineType;
            // Looks like this:
            // MINE_TYPE_CANNON
            // TODO:  Find all the mine types to document them
          }
        }
      } else {
        // TODO:  Figure out mine deaths, warheads, and test if NPC fleets (or fleets in general) show differently
        // } else if ((/\(design\)/).test(responsible)) {
        //   deathType = "shipyarddesign";
        deathType="unknown"; // This should cover shipyard deaths or anything I might not be considering right now
      }
      returnObj.deathType=deathType;
      if (deathType != "suicide" && owner !== null){
        returnObj.killerPlayer=new installObj.objects.PlayerObj(owner);
      }
      // planet/asteroid/star/blackHole/suicide/player/station/ship
      if (returnObj.deathType == "station" || returnObj.deathType == "ship"){
        if (typeof responsibleText == "string"){
          returnObj.killerEntityName=responsibleText;
        }
      }
      // Look up the UID, which should be available for: station, ship, planet, and asteroid
      if (deathType == "station" || deathType == "ship" || deathType == "planet" || deathType == "asteroid"){
        let entityUID=toStringIfPossible(dataInput.match(/(?<=, UID={)[^}]*/));
        if (typeof entityUID == "string"){
          returnObj.killerEntity=new installObj.objects.EntityObj(entityUID);
        }
      }

      // Look up faction number
      let factionNum=toNumIfPossible(toStringIfPossible(dataInput.match(/(?<=\[Faction=)[-]{0,1}[0-9]+/)));
      if (factionNum != 0){
        returnObj.killerFaction=new installObj.objects.FactionObj(factionNum);
        // Look up a faction name, if possible
        // possible for: bases, ships, and planets
        if (deathType == "station" || deathType == "ship" || deathType == "planet"){
          let responsibleTest=toStringIfPossible(dataInput.match(/(?<=Responsible: [^[]*\[)[^\]]*/)); // A player was NOT in the entity
          if (typeof responsibleTest == "string"){
            returnObj.killerFactionName=responsibleTest;
          } else { 
            let killerText=toStringIfPossible(dataInput.match(/(?<=Killer: [^[]*\[)[^\]]*/)); // A player WAS in the entity
            if (typeof killerText == "string"){
              returnObj.killerFactionName=killerText;
            }
          }
        }
      }


      // The returnObj should now have the following elements:
      // player
      // killerEntity
      // killerPlayer
      // killerEntity
      // killerEntityName
      // killerFaction
      // killerFactionName
      // sector
      // deathType

      // Time to emit the object
      event.emit('playerDeath',returnObj);
      // var exampleDeathObj={
      //   player:playerObj, // player who died
      //   killerPlayer:playerObj, // Player who killed that player - only provided IF a player was in the entity.  Available in the "Owner" info part of the line.
      //   killerEntity:entityObj, // responsible - entity that killed the player
      //   killerEntityName:"Entity Name",
      //   killerFaction:factionObj, // Only provided if faction information is available (only for factioned entities)
      //   killerFactionName:"factionName", // Only available if faction information is available
      //   sector:sectorObj, // only available IF a black hole or star killed the player
      //   controllable:???, // This determines if the player
      //   deathType:"planet/asteroid/star/blackHole/suicide/player/station/ship"
      // }

      // ### New Ship or Base Creation (not blueprints) ###
    } else if (theArguments[0].match(/\[BLUEPRINT\].*/)) { // Various Blueprint events
      if (theArguments[0] == "[BLUEPRINT][BUY]") { // New Ship spawn from blueprint
        // Event found!: [BLUEPRINT][BUY] Benevolent27 bought blueprint from metaItem: "Isanth-VI" as "Isanth-VI1523389134208"; Price: 194625; to sector: (2, 2, 2) (loadTime: 80ms, spawnTime: 0ms)
        // [SERVER][META] removing metaID: 100320Arguments: 1
        // theArguments[0]: [BLUEPRINT][BUY]
        // theArguments[1]: Benevolent27
        // theArguments[2]: bought
        // theArguments[3]: blueprint
        // theArguments[4]: from
        // theArguments[5]: metaItem:
        // theArguments[6]: "Isanth-VI"
        // theArguments[7]: as
        // theArguments[8]: "Isanth-VI1523389134208";
        // theArguments[9]: Price:
        // theArguments[10]: 194625;
        // theArguments[11]: to
        // theArguments[12]: sector:
        // theArguments[13]: (2,
        // theArguments[14]: 2,
        // theArguments[15]: 2)
        // theArguments[16]: (loadTime:
        // theArguments[17]: 80ms,
        // theArguments[18]: spawnTime:
        // theArguments[19]: 0ms)
        // [SERVER][META]
        // theArguments[20]: removing
        // theArguments[21]: metaID:
        // theArguments[22]: 100320

        thisConsole.log("Some blueprint buy event happened."); // This might only be relevant if a server uses credits to buy blueprints?






      } else if (theArguments[0] == "[BLUEPRINT][LOAD]") { // New ship from load - possibly /spawn_mobs command
        // TODO:  Figure out why this isn't firing off on the first blueprint spawn.  It is ALWAYS the second blueprint spawn and all later spawns for some strange reason.
        thisConsole.log("Some blueprint load event happened.");
        let theUser = theArguments[1];
        thisConsole.log("theUser:" + theUser);
        var spawnType;
        if (theUser == "<admin>") {
          spawnType = "admin"
        } else if (theUser == "<system>") {
          spawnType = "massSpawn"
        } else {
          spawnType = "player"
        }
        thisConsole.log("spawnType:" + spawnType);

        let bluePrintName = dataInput.match(/loaded .*as "/)[0].replace(/^loaded /, "").replace(/ as "$/, "");
        thisConsole.log("bluePrintName:" + bluePrintName);
        let shipName = dataInput.match(/".*"/)[0].replace(/"/g, "");
        thisConsole.log("shipName:" + shipName);
        let coordsArray = dataInput.match(/\(.*\)/)[0].replace(/[()]/g, "").split(', ');
        thisConsole.log("coordsArray:" + coordsArray);
        thisConsole.log("X:" + coordsArray[0]);
        thisConsole.log("Y:" + coordsArray[1]);
        thisConsole.log("Z:" + coordsArray[2]);
        let factionNumber = dataInput.match(/(\d+)$/)[0];
        thisConsole.log("factionNumber:" + factionNumber);
        thisConsole.log(" ");
        thisConsole.log(" ");



        // starNet.getUIDfromName(shipName)
        return getUIDfromName(shipName, "", function (err, result) {
          if (err) {
            thisConsole.log("Error getting entity UID from name!", err);
          } else {
            let entityObj = new installObj.objects.EntityObj(result);
            console.dir(entityObj);
            thisConsole.log("Creating new coordsObj with: " + coordsArray);
            let coordsObj = new installObj.objects.CoordsObj(coordsArray);
            console.dir(coordsObj);
            let sectorObj = new installObj.objects.SectorObj(coordsObj.x, coordsObj.y, coordsObj.z);
            console.dir(sectorObj);
            // let coordsObj=new installObj.objects.CoordsObj(coordsArray[0],coordsArray[1],coordsArray[2]);

            let playerObj;
            if (spawnType == "player") {
              playerObj = new installObj.objects.PlayerObj(theUser);
              playerObj.msg("The playerObj was successful: " + shipName);
              // playerObj.msg("entityObj.loaded:" + entityObj.loaded);
            }
            console.dir(playerObj);

            let blueprintObj = new installObj.objects.BlueprintObj(bluePrintName);
            console.dir(blueprintObj);

            let factionObj = new installObj.objects.FactionObj(factionNumber);
            console.dir(factionObj);

            event.emit('blueprintSpawn', spawnType, playerObj, blueprintObj, entityObj, sectorObj, factionObj); // playerObj will be undefined if the blueprint was spawned by admin or mass spawned
          }
        });



        // Examples:
        // Filling blueprint and spawning as player
        // [BLUEPRINT][LOAD] Benevolent27 loaded Isanth Type-Zero B- as "This is the ship" in (1000, 1000, 1000) as faction 10001

        // Admin loading:
        // [BLUEPRINT][LOAD] <admin> loaded Isanth Type-Zero B- as "Isanth Type-Zero B-_1561352308449" in (1000, 1000, 1000) as faction 10001

        // Using "Mass Spawn Ships" as an admin
        // [BLUEPRINT][LOAD] <system> loaded Isanth Type-Zero Cb as "MOB_Isanth Type-Zero Cb_1561353688999_0" in (1000, 1000, 1000) as faction 0

        // Event found!: [BLUEPRINT][LOAD] <admin> loaded Isanth-VI as "Isanth-VI_1523389201663" in (2, 2, 2) as faction 0Arguments: 1
        // theArguments[0]: [BLUEPRINT][LOAD]
        // theArguments[1]: <admin>
        // theArguments[2]: loaded
        // theArguments[3]: Isanth-VI
        // theArguments[4]: as
        // theArguments[5]: "Isanth-VI_1523389201663"
        // theArguments[6]: in
        // theArguments[7]: (2,
        // theArguments[8]: 2,
        // theArguments[9]: 2)
        // theArguments[10]: as
        // theArguments[11]: faction
        // theArguments[12]: 0



      }
      // Player Disconnects
      // Event found!: [SERVER][DISCONNECT] Client 'RegisteredClient: Benevolent27 (1) connected: true' HAS BEEN DISCONNECTED . PROBE: false; ProcessorID: 0Arguments: 1
      // theArguments[0]: [SERVER][DISCONNECT]
      // theArguments[1]: Client
      // theArguments[2]: 'RegisteredClient:
      // theArguments[3]: Benevolent27
      // theArguments[4]: (1)
      // theArguments[5]: connected:
      // theArguments[6]: true'
      // theArguments[7]: HAS
      // theArguments[8]: BEEN
      // theArguments[9]: DISCONNECTED
      // theArguments[10]: .
      // theArguments[11]: PROBE:
      // theArguments[12]: false;
      // theArguments[13]: ProcessorID:
      // theArguments[14]: 0


      // Event found!: [SERVER][PLAYERMESSAGE] received message request from PlS[Benevolent27 ; id(2)(1)f(0)] for 10 messagesArguments: 1
      // theArguments[0]: [SERVER][PLAYERMESSAGE]
      // theArguments[1]: received
      // theArguments[2]: message
      // theArguments[3]: request
      // theArguments[4]: from
      // theArguments[5]: PlS[Benevolent27
      // theArguments[6]: ;
      // theArguments[7]: id(2)(1)f(0)]
      // theArguments[8]: for
      // theArguments[9]: 10
      // theArguments[10]: messages

    } else if (dataInput.match(/^\[SERVER\] PlayerCharacter\[.*/) || dataInput.match(/^\[SERVER\] Ship\[.*/) || dataInput.match(/^\[SERVER\] ManagedAsteroid\(.*/) || dataInput.match(/^\[SERVER\] Planet\(.*/)) {
      // thisConsole.log("Sector change detected: " + dataInput);
      var excerptArray = dataInput.match(/has players attached. Doing Sector Change for PlS.*/);
      // thisConsole.log("excerptArray: ");
      // console.dir(excerptArray);
      if (excerptArray) {
        var excerpt = excerptArray[0];
        var whittled = excerpt.replace(/^has players attached. Doing Sector Change for PlS\[/, "");
        var whittledArray = whittled.split(" ");
        // Example line: Weedle [Benevolent27]*; id(1712)(8)f(10533)]: Sector[2067](665, 666, 666) -> Sector[1960](666, 666, 666)
        var playerNameCaptured = whittledArray[0];
        // var playerSMNameCaptured=whittledArray[1].replace(/[\[\]\*;]/g,""); // Working
        var playerSMNameCaptured = whittledArray[1].replace(/[[\]*;]/g, ""); // Making ESLINT Happy

        var coordsArray = excerpt.match(/Sector\[[0-9]+\]\([-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+\)/g);
        // [ 'Sector[2067](665, 666, 666)', 'Sector[1960](666, 666, 666)' ]
        var cleanCoordsArray = [];
        for (let i = 0;i < coordsArray.length;i++) {
          cleanCoordsArray.push(coordsArray[i].match(/[-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+/)[0].split(","))
        }
        // thisConsole.log("Coords:");
        // console.dir(cleanCoordsArray); // First set is the sector starting in, second is going to
        // thisConsole.log("Player Name: " + playerNameCaptured);
        // thisConsole.log("Player SM Name:" + playerSMNameCaptured);


        var startingCoords = new installObj.objects.SectorObj(cleanCoordsArray[0]);
        var endingCoords = new installObj.objects.SectorObj(cleanCoordsArray[1]);
        var player = new installObj.objects.PlayerObj(playerNameCaptured);
        var playerSMName = new installObj.objects.SMNameObj(playerSMNameCaptured);

        // TODO:  Test this to see if it works
        thisConsole.log("Sector change detected for player, '" + player.toString() + "', with registry name, '" + playerSMName.toString() + "', from sector, '" + startingCoords.toString() + "', to sector, '" + endingCoords.toString() + "'.");
        event.emit('playerSectorChange', player, startingCoords, endingCoords, playerSMName); // playerObj will be undefined if the blueprint was spawned by admin or mass spawned
      }
      // Bash scripting:  (needs converting to javascript)
      // tempVar=$(echo "${@}" | grep -o "has players attached. Doing Sector Change for PlS.*")
      // if [ "w${tempVar}" != "w" ]; then
      //   theInfo=$(echo "${tempVar}" | sed 's/^has players attached. Doing Sector Change for PlS\[//g')
      //   set -- ${theInfo}
      //   playerName="${1//\[}"
      //   playerSMName="$(echo "${2}" | tr -d '[]*;')"
      //   set -- $(echo ${theInfo} | grep -Po "(?<=Sector\[)[0-9]*\]\([-]{0,1}[0-9]*, [-]{0,1}[0-9]*, [-]{0,1}[0-9]*" | sed 's/^[0-9]*\][(]//g' | tr -d ',')
      //   startingSector="${1}, ${2}, ${3}"
      //   endingSector="${4}, ${5}, ${6}"
      // fi


    } else if (theArguments[0] == "[FACTION]") { // Player joined a faction
      // STDERR: [FACTION] Added to members Benevolent27 perm(4) of Faction [id=10004, name=TheFaction, description=Faction name, size: 1; FP: 100] on Server(0)
      if (theArguments[1] == "Added") {
        console.debug("Player left faction.  dataInput: " + dataInput);
        let name = theArguments[4];
        let factionID = toStringIfPossible(dataInput.match(/(?<=Faction \[id=)[-]{0,1}[0-9]+/));
        let factionNameString = toStringIfPossible(dataInput.match(/(?<=name=)[^,]+/));
        let playerObj = new installObj.objects.PlayerObj(name);
        let factionObj = new installObj.objects.FactionObj(factionID);
        event.emit('playerFactionJoin', playerObj, factionObj, factionNameString);
      }

    } else if (theArguments[0] == "[FACTIONMANAGER]") { // Player left a faction, system claims, and possibly more
      // STDERR: [FACTIONMANAGER] removing member: Benevolent27 from Faction [id=10003, name=whatever, description=Faction name, size: 1; FP: -142]; on Server(0)
      if (theArguments[1] == "removing") {
        console.debug("Player joined faction.  dataInput: " + dataInput);
        let name = theArguments[3];
        let factionID = toStringIfPossible(dataInput.match(/(?<=Faction \[id=)[-]{0,1}[0-9]+/));
        let factionName = toStringIfPossible(dataInput.match(/(?<=name=)[^,]+/));
        let nameObj = new installObj.objects.PlayerObj(name);
        let factionObj = new installObj.objects.FactionObj(factionID);
        event.emit('playerFactionLeave', nameObj, factionObj, factionName);
      } else if ((/^\[FACTIONMANAGER\] System ownership called Server.*/).test(dataInput)){
        var factionNum=toNumIfPossible(toStringIfPossible(dataInput.match(/(?<=New Values: FactionId )[0-9]+(?=;)/)));
        var systemNum=toStringIfPossible(dataInput.match(/(?<=; System \()[-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+(?=[)])/));
        var entityUID=toStringIfPossible(dataInput.match(/(?<=\) UID\()[^)]*/));
        if (typeof factionNum == "number" && factionNum != 0){
          var factionObj=new installObj.objects.FactionObj(factionNum);
        }
        if (typeof systemNum == "string"){
          var systemObj=new installObj.objects.SystemObj(systemNum);
        }
        if (typeof entityUID == "string"){
          var entityObj=new installObj.objects.EntityObj(entityUID);
        }
        if (typeof factionObj == "object"){
          // System was claimed
          event.emit('systemFactionClaimed',systemObj,entityObj,factionObj);
        } else {
          // System was unclaimed
          event.emit('systemFactionUnclaimed',systemObj,entityObj);
        }
        // Working on:
        // Revoking system ownership (1, 1, 5) is the system:
        // STDERR: [FACTIONMANAGER] System ownership called Server(0): New Values: FactionId 0; System (1, 1, 5) UID(ENTITY_SPACESTATION_DestroyerOfWorlds_1590755298320)
        // Adding ownership:
        // Base (STDERR): [FACTIONMANAGER] System ownership called Server(0): New Values: FactionId 10004; System (1, 1, 5) UID(ENTITY_SPACESTATION_DestroyerOfWorlds_1590755298320)
        // Planet (STDERR): [FACTIONMANAGER] System ownership called Server(0): New Values: FactionId 10004; System (1, 1, 5) UID(ENTITY_PLANET_25_25_85_1_1590761413541)

      }



    } else if (theArguments[0] == "[SEND][SERVERMESSAGE]") { // player connect
      // STDERR: [SEND][SERVERMESSAGE] [SERVERMSG (type 0): [484, Weedle]] to RegisteredClient: Weedle (5) [Benevolent27]connected: true
      console.debug("Possible player connection: " + dataInput);
      if ((/connected: true$/).test(dataInput)) {
        let playerName = dataInput.match(/(?<=RegisteredClient: )[^ ]+/);
        if (playerName !== null) {
          playerName = playerName.toString();
        }
        let playerSMName = dataInput.match(/[^[]+(?=]connected: true)/);
        if (playerSMName !== null) {
          playerSMName = playerSMName.toString();
        }
        let playerObj = new installObj.objects.PlayerObj(playerName);
        let playerSmNameObj = new installObj.objects.SMNameObj(playerSMName);
        event.emit('playerConnect', playerObj, playerSmNameObj);
      }

    } else if (theArguments[0] == "[SERVER][DISCONNECT]") { // Player left a faction
      // Player disconnect
      // STDERR: STDERR: [SERVER][DISCONNECT] Client 'RegisteredClient: Weedle (8) [Benevolent27]connected: true' HAS BEEN DISCONNECTED . PROBE: false; ProcessorID: 25
      let playerName = dataInput.match(/(?<=RegisteredClient: )[^ ]+/);
      if (playerName !== null) {
        playerName = playerName.toString();
      }
      let playerSMName = dataInput.match(/[^[]+(?=]connected: true)/);
      if (playerSMName !== null) {
        playerSMName = playerSMName.toString();
      }
      let playerObj = new installObj.objects.PlayerObj(playerName);
      let playerSmNameObj = new installObj.objects.SMNameObj(playerSMName);
      event.emit('playerDisconnect', playerObj, playerSmNameObj);
    } else if (dataInput.match(/^\[SERVER\] MAIN CORE STARTED DESTRUCTION/)) {
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SHIP_overheatingShip] (666, 666, 666) in 60 seconds - 
      // started 1568254747519 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SHIP_overheatingShip] (666, 666, 666) in 60 seconds - started 1568254747519 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]

      // Pirates in a ship
      // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SPACESTATION_stoppedOverHeated] (666, 666, 666) in 60 seconds - started 1568339467031 caused by null
      let entityUID = toStringIfPossible(dataInput.match(/(?<=^.*DESTRUCTION \[)[^\]]+/));

      console.debug("entityUID: " + entityUID);
      let theCoords = toStringIfPossible(dataInput.match(/(?<=\] \()[-]{0,1}[0-9]+, [-]{0,1}[0-9]+, [-]{0,1}[0-9]+/));
      console.debug("theCoords: " + theCoords);
      let theCoordsArray = theCoords.split(", ");
      console.debug("theCoordsArray: " + theCoordsArray);
      let theSeconds = toNumIfPossible(toStringIfPossible(dataInput.match(/(?<=\) in )[0-9]+/)));
      console.debug("theSeconds: " + theSeconds);
      let thePlayerString = toStringIfPossible(dataInput.match(/(?<=PlS\[)[^[ ]+/));
      console.debug("thePlayerString: " + thePlayerString);
      let thePlayerSmName = toStringIfPossible(dataInput.match(/(?<=PlS\[[^\]]+\[)[^\]]+/));
      console.debug("thePlayerSmName: " + thePlayerSmName);

      let entityObj = new installObj.objects.EntityObj(entityUID);
      return entityObj.exists("", function (err, result) {
        if (err) {
          return err;
        }
        if (result) {
          let sectorObj = new installObj.objects.SectorObj(...theCoordsArray);
          // theSeconds
          if (typeof thePlayerString == "string") {
            var playerObj = new installObj.objects.PlayerObj(thePlayerString);
          }
          if (typeof thePlayerSmName == "string") {
            var playerSMNameObj = new installObj.objects.SMNameObj(thePlayerSmName);
          }
          return event.emit('entityOverheat', entityObj, sectorObj, playerObj, playerSMNameObj);
          // the playerObj and playerSMNameObj are of the player who caused the overheat to occur

        } // If the entity does not exist, this must be the duplicate overheat that occurs when an entity is destroyed
        return false; // This is to make ESLint happy
      });

    } else if (theArguments[0] == 'Server(0)') {
      // STDERR: Server(0) Ship[destroyThisShip](19) STOPPED OVERHEATING
      console.debug("Possible overheat stop..");
      serverObj.log("Possible overheat stop: " + dataInput); // temp
      if ((/STOPPED OVERHEATING$/).test(dataInput)) {
        console.debug("Overheat stop confirmed!");
        // STDERR: Server(0) Ship[newNameStopped](186) STOPPED OVERHEATING
        // STDERR: Server(0) SpaceStation[ENTITY_SPACESTATION_oldNameBase(187)] STOPPED OVERHEATING
        let theType = toStringIfPossible(dataInput.match(/(?<=Server\(0\) )[^[]*/));
        console.debug("theType: " + theType);

        if (theType == "Ship") {
          var theName = toStringIfPossible(dataInput.match(/(?<=^Server\(0\) Ship\[)[^\]]+/));
          console.debug("theName: " + theName);
          return getUIDfromName(theName, "", function (err, theUID) {
            if (err) {
              thisConsole.log("There was an error!", err);
              return err;
            }
            console.debug("ship theUID: " + theUID);
            if (testIfInput(theUID)) {
              let theEntityObj = new installObj.objects.EntityObj(theUID);
              return event.emit("entityOverheatStopped", theEntityObj);
            }
            return false;
          })
        } else if (theType == "SpaceStation") {
          let theUID = toStringIfPossible(dataInput.match(/(?<=Server\(0\) SpaceStation\[)[^(]+/));
          console.debug("spacestation theUID: " + theUID);
          if (testIfInput(theUID)) {
            let theEntityObj = new installObj.objects.EntityObj(theUID)
            return event.emit("entityOverheatStopped", theEntityObj);
          }
        } else {
          console.debug("Invalid entity type detected for overheat: " + theType);
        }
      }
    }

    // Ship death
    // STDERR: [SERVER][DESTROY] CORE OVERHEATED COMPLETELY: KILLING ALL SHIP CREW Ship[dyingShip](1184)
    // STDOUT: [SEGMENTCONTROLLER] ENTITY Ship[dyingShip](1184) HAS BEEN DESTROYED...
    // STDERR: [SERVER] Core AT 0 HP destroyed for Ship[dyingShip](1184), which is in new power system, is not docked, and has no active reactor (-> death on core destruction)
    // STDERR: [SERVER] Overheating triggered for Ship[dyingShip](1184)
    // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SHIP_dyingShip] (666, 666, 666) in 60 seconds - started 1568254505636 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
    // base death
    // STDERR: [SERVER][DESTROY] CORE OVERHEATED COMPLETELY: KILLING ALL SHIP CREW SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]
    // STDOUT: [SEGMENTCONTROLLER] ENTITY SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)] HAS BEEN DESTROYED...
    // STDERR: [SERVER] Overheating triggered for SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]
    // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SPACESTATION_overheatedBase] (666, 666, 666) in 60 seconds - started 1568255108412 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
    // STDERR: [ENTITIES] removed object from loaded state SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]; 1188
    // STDERR: [DELETE][Server(0)] Sendable 1188(SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]) Physically DELETING DONE and Notified!
    // STDERR: [SERVER][SEGMENTCONTROLLER] PERMANENTLY DELETING ENTITY: ENTITY_SPACESTATION_overheatedBase.ent
    // STDERR: [ENTITIES] removed object from loaded state obfuscated.asP@5ba10ef6; 1188
    // STDERR: [DELETE][Server(0)] Sendable 1188(obfuscated.asP@5ba10ef6) Physically DELETING DONE and Notified!


    // Ship OVERHEATED
    // STDERR: [SERVER] Overheating triggered for Ship[overheatingShip](1186)
    // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SHIP_overheatingShip] (666, 666, 666) in 60 seconds - started 1568254747519 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]
    // base OVERHEATED
    // STDERR: [SERVER] Overheating triggered for SpaceStation[ENTITY_SPACESTATION_overheatedBase(1188)]
    // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SPACESTATION_overheatedBase] (666, 666, 666) in 60 seconds - started 1568255048394 caused by PlS[Weedle [Benevolent27]*; id(1015)(9)f(0)]

    // Ship stopped overheating
    // STDERR: Server(0) Ship[shipStoppedOverHeating](1187) STOPPED OVERHEATING
    // Base stopped overheating by placing block on it and then rebooting it when asked:
    // STDERR: Server(0) SpaceStation[ENTITY_SPACESTATION_stoppedOverHeated(1189)] STOPPED OVERHEATING
    // STDERR: [SERVER] Overheating triggered for SpaceStation[ENTITY_SPACESTATION_stoppedOverHeated(1189)]
    // STDERR: [SERVER] MAIN CORE STARTED DESTRUCTION [ENTITY_SPACESTATION_stoppedOverHeated] (666, 666, 666) in 60 seconds - started 1568255234685 caused by
    // STDERR: Server(0) SpaceStation[ENTITY_SPACESTATION_stoppedOverHeated(1189)] STOPPED OVERHEATING





  }
  return false; // this is just to make ESLint happy
}

// For serverlog.0.log
var lastMessage; // Used for player deaths since the console gets spammed with multiple death messages per player when more than 1 output of a weapon exists, which was responsible for the player's death.
function processServerlogDataInput(dataInput) { // This function is run on every single line that is output by the server log.
  if (testMatchServerLog(dataInput)) { // Check to see if the message fits any of the regex patterns
    let theArguments = arguments[0].split(" "); // This is to allow easier parsing of each individual word in the line
    // enumerateEventArguments=true; // Temporary
    if (settings.enumerateEventArguments == true) {
      for (let i = 0;i < theArguments.length;i++) {
        thisConsole.log("theArguments[" + i + "]: " + theArguments[i]);
      }
    }
    // ### New Ship or Base Creation (not blueprints) ###
    if (theArguments[0] == "[SPAWN]") {
      // Event found!: [SERVER] Object Ship[Benevolent27_1523387756157](1447) didn't have a db entry yet. Creating entry!Arguments: 1
      thisConsole.log("Parsing possible ship or base spawn: " + theArguments.join(" ").toString());
      var playerName = theArguments[1];
      var playerObj = new installObj.objects.PlayerObj(playerName);
      console.dir(playerObj); // temp
      // var shipName=arguments[0].match(/spawned new ship: "[0-9a-zA-Z _-]*/);
      var shipName = arguments[0].match(/spawned new ship: ["][0-9a-zA-Z _-]*/);
      if (shipName) {
        thisConsole.log("Temp shipName: " + shipName);
        shipName = shipName.toString().replace(/^spawned new ship: ["]/, '');
        // shipName=shipName.toString().split(":").pop();
        thisConsole.log("Temp shipName: " + shipName);
        return getUIDfromName(shipName, "", function (err, result) {
          if (err) {
            thisConsole.log("Error getting entity UID from name!", err);
          } else {
            let entityObj = new installObj.objects.EntityObj(result);
            entityObj.spawnTime = Math.floor((new Date()).getTime() / 1000);
            console.dir(entityObj); // temp
            event.emit('shipSpawn', playerObj, entityObj);
          }
        });
      } else {
        // var baseName=arguments[0].match(/spawned new station: "[0-9a-zA-Z _-]*/);
        var baseName = arguments[0].match(/spawned new station: ["][0-9a-zA-Z _-]*/);
        if (baseName) {
          // baseName=baseName.split(":").pop();
          baseName = baseName.toString().replace(/^spawned new station: ["]/, '');

          // baseNameArray=baseName.split()
          return getUIDfromName(baseName, "", function (err, result) {
            if (err) {
              thisConsole.log("Error getting entity UID from name!", err);
            } else {
              let entityObj = new installObj.objects.EntityObj(result);
              entityObj.spawnTime = Math.floor((new Date()).getTime() / 1000);
              event.emit('baseSpawn', playerObj, entityObj);
            }
          });
        }
      }
    } else if (theArguments[0] == "[DEATH]") {
      // Post 2.0 weapons update: -- no longer relevant
      // [2018-07-15 13:21:05] [DEATH] TheDerpGamer has been killed by 'Responsible: Mine//1342'; controllable: Mine [id=1342, sectorPos=(22, 28, 36), mineType=MINE_TYPE_MISSILE, active=true(5)]
      // [2018-07-15 10:17:31] [DEATH] Starjet1 has been killed by 'Killer: Starjet1 (0.0/120.0 HP left)'; controllable: PlS[Starjet1 [Starjet]; id(2704)(15)f(0)]
      // [2018-07-15 21:04:33] [DEATH] WARLOCKZIKE has been killed by 'Killer: WARLOCKZIKE (0.0/120.0 HP left)'; controllable: PlS[WARLOCKZIKE [WARLOCKZIKE]; id(27544)(80)f(0)]
      // [2018-07-15 21:33:48] [DEATH] jacknickels2 has been killed by 'Responsible: Small Cargo Shitrl80[Phantomhive]'; controllable: Ship[Small Cargo Shitrl80](97)
      // [2018-07-15 21:36:15] [DEATH] Spongy9698 has been killed by 'Responsible: MASS REMOVERrl00[V I R U S]'; controllable: Ship[MASS REMOVERrl00](4120)
      // [2018-07-15 22:45:58] [DEATH] Danger89 committed suicide
      // [2018-07-15 22:45:58] [DEATH] Danger89 has been killed by 'Killer: Danger89 (0.0/120.0 HP left)'; controllable: PlS[Danger89 [Danger89]*; id(17964)(55)f(0)]
      // [2018-07-16 00:01:30] [DEATH] Eidolon2 has been killed by 'Responsible: Pirate-Tok-Jake_Forager-OT-H-2 85-0[Pirates]'; controllable: Ship[Pirate-Tok-Jake_Forager-OT-H-2 85-0](31790)


      var person = toStringIfPossible(dataInput.match(/(?<=\[DEATH\] )[^ ]+(?= has been killed by.*)/));
      if (person) {
        var personObj = new installObj.objects.PlayerObj(person);
        var theCurrentDate = new Date();
        var theMonth;
        theMonth = theCurrentDate.getMonth() + 1;
        if (theMonth < 10) {
          theMonth = "0" + theMonth.toString();
        }
        var theDay;
        theDay = theCurrentDate.getDate() + 1;
        if (theDay < 10) {
          theDay = "0" + theDay;
        }

        var theYear = theCurrentDate.getFullYear();
        var theDate = theMonth + "-" + theDay + "-" + theYear;

        var theHour;
        theHour = theCurrentDate.getHours();
        if (theHour < 10) {
          theHour = "0" + theHour;
        }
        var theMinute;
        theMinute = theCurrentDate.getMinutes();
        if (theMinute < 10) {
          theMinute = "0" + theMinute;
        }
        var theSeconds;
        theSeconds = theCurrentDate.getSeconds();
        if (theSeconds < 10) {
          theSeconds = "0" + theSeconds;
        }
        var theTime = theHour + ":" + theMinute + ":" + theSeconds;

        var message = `[${theDate}] [${theTime}]: ${person}`
        // Updating after weapons 2.0
        var responsible = toStringIfPossible(dataInput.match(/(?<=Responsible: )[^']+(?='.*)/));
        var controllable = toStringIfPossible(dataInput.match(/(?<=; controllable: ).*$/));
        // var killer=toStringIfPossible(dataInput.match(/(?<='Killer: )[^(]*(?= \()/));

        // Shipyard:  D_1508536985403 (design)
        var deathType;
        var responsibleEntity;
        if (responsible == "Sun") {
          deathType = "star";
        } else if (responsible == "Black Hole") {
          deathType = "blackhole";
        } else if (responsible == "Floating Rock <can be harvested>") {
          // TODO:  Fix manned asteroid kills.
          // This was a kill while a player was controlling an asteroid with a weapon on it
          // Example (09-21-19):  [DEATH] Weedle has been killed by 'Killer: Benevolent27 (120.0/120.0 HP left)'; controllable: ManagedAsteroid(355)sec[284](!)

          // Regular example:  Working
          // Example of factioned asteroid, unmanned:  serverlog.0.log: [DEATH] Weedle has been killed by 'Responsible: Floating Rock <can be harvested>'; controllable: ManagedAsteroid(16)sec[13](!)
          deathType = "asteroid";
        } else if (responsible == "PlanetSegment(Planet);") {
          deathType = "planetSegment";
        } else if ((/\(design\)/).test(responsible)) {
          deathType = "shipyarddesign";
        } else if ((/Mine#[0-9]+/).test(responsible)) {
          deathType = "mine";
        } else {
          var killer = toStringIfPossible(dataInput.match(/(?<='Killer: )[^(]*(?= \()/));
          if (typeof killer == "string") { // will be null if no killer
            if (person == killer) {
              // This probably should be broadened to include suiciding via their own ship
              message = `[${theDate}] [${theTime}]: ${person} killed themselves.`
              deathType = "suicide"
            } else {
              // If there was a killer, let's see what type the controllable was
              var responsibleType = toStringIfPossible(dataInput.match(/(?<=controllable: )[^^(]*/));

              responsibleEntity = toStringIfPossible(dataInput.match(/(?<=controllable: Ship\[)[^\]]*/));
              if (responsibleEntity) {
                // Since we know the killer's name and also the entity, set to having been perpetrated by a person in an entity
                message = `[${theDate}] [${theTime}]: ${person} was killed by ${killer}, in entity ${responsibleEntity}`
                deathType = "personInShip"

                // Let's look up the responsible faction, if there is one.
                // responsibleFaction=$(echo "$responsible" | sed -E 's/((^.*\[)|(\]$))//g')
                var responsibleFactionTest = toStringIfPossible(responsible);
                var responsibleFaction;
                if (typeof responsibleFactionTest == "string") {
                  responsibleFaction = responsibleFactionTest.match(/(?<=\[)[^\]]+/);
                }
                if (testIfInput(responsibleFaction)) {
                  message = `${message}, of the faction, '${responsibleFaction}'`
                }
              } else {
                message = `[${theDate}] [${theTime}]: ${person} was killed by ${killer}.`
                deathType = "person"
              }
            }
          } else {
            killer = toStringIfPossible(responsible.match(/(?<=<)[^>]*(?=>.*)/));
            thisConsole.log("Secondary killer string: " + killer);
            // thisConsole.log(`killer: ${killer}`);
            if (person == killer) {
              // This probably should be broadened to include suiciding via their own ship
              message = `${message} killed themselves.`
              deathType = "suicide"
            } else if (responsible) {
              if (killer) {
                message = `${message} was killed by ${killer}`
                deathType = "person"
              } else {
                // If no killer was found with the first or second check, then we have to assume an entity will be found, but we'll double check anyhow.
                deathType = "entity"
              }

              // This will only work IF there are [ brackets ], such as a faction name in there, so I need to branch out here as well
              responsibleEntity = responsible.replace(/(\[.*$|<.*$)/g, "");
              if (testIfInput(responsibleEntity)) {
                // responsibleFaction=$(echo "$responsible" | grep -o '[\[].*' | sed 's/[\[\]]//g')
                responsibleFaction = toStringIfPossible(responsible.match(/(?<=\[)[^\]]*(?=\].*$)/));
                // echo "responsibleFaction: ${responsibleFaction}"
                if (testIfInput(responsibleFaction)) {
                  message = `${message} of the faction, '${responsibleFaction}'`;
                }
                message = `${message}, via the entity, '${responsibleEntity}'`;
                if (testIfInput(killer)) {
                  // We know an entity was found and also a person, so set the death type to being killed by a person in a ship
                  deathType = "personInShip";
                } else {
                  // Since there was no killer, but there was a responsible entity, set to entity only
                  deathType = "entity";
                }

                // Here we double check to ensure the deathType is reset if no responsible entity was found
              } else if (!testIfInput(killer)) {
                // player died, but no responsible entity nor killer was found!  This should never happen!"
                deathType = "mystery";
              }
            } else {
              // no responsible found!  This should never happen!"
              deathType = "mystery";
            }

            // We have a 'killer' type death, so we need to look for the entity now if not a suicide.


          }
        }
        if (killer) {
          var killerObj = new installObj.objects.PlayerObj(killer);
        }
        if (responsibleEntity) {
          var responsibleEntityObj = new installObj.objects.EntityObj(responsibleEntity);
        }
        // Cannot create a faction object here since we only have the name to work with.  We have to run an async function to get that FactionObj at the time of emitting

        if (lastMessage == String(message)) {
          console.debug("### SKIPPING DUPLICATE DEATH MESSAGE ###: " + lastMessage);
        } else {
          thisConsole.log(message);
          lastMessage = String(message); // This is needed to filter out any duplicate death messages, such as when a weapon has several outputs and they all killed a player at the same time.  Note we do not want to link to the "message" variable, but rather set a new string based on it.
          thisConsole.log("##### INFOS ######");
          // thisConsole.log("# Everything: ${b}"
          thisConsole.log(`# theDate: ${theDate}  theTime: ${theTime}  deathType: ${deathType}`);
          thisConsole.log(`# responsibleEntity: ${responsibleEntity}`);
          thisConsole.log(`# killer: ${killer}  responsibleFaction: ${responsibleFaction}`);
          thisConsole.log("dataInput: " + dataInput);
          thisConsole.log(`#### END INFOS #####`);
          thisConsole.log(" ");
          if (deathType == "suicide") {
            event.emit('playerDeath', personObj, deathType);
          } else if (deathType == "person") {
            console.debug(`${killer} killed ${person}.`);
            event.emit('playerDeath', personObj, deathType, "", "", killerObj);
          } else if (deathType == "personInShip") {
            var ofTheFaction = "";
            if (testIfInput(responsibleFaction)) {
              ofTheFaction = `, of the faction '${responsibleFaction}',`
            }
            thisConsole.log(`${killer}${ofTheFaction} killed ${person} while piloting the entity, '${responsibleEntity}'.`);
            if (testIfInput(responsibleFaction)) {
              return getFactionObjFromName(serverObj, responsibleFaction, "", function (err, responsibleFactionObj) {
                if (err) {
                  thisConsole.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!", err);
                } else {
                  event.emit('playerDeath', personObj, deathType, responsibleEntityObj, responsibleFactionObj, killerObj);
                }
              });
            } else {
              event.emit('playerDeath', personObj, deathType, responsibleEntityObj, "", killerObj);
            }
          } else if (deathType == "entity") {
            if (testIfInput(responsibleFaction)) {
              thisConsole.log(`${person} was killed by an entity, '${responsibleEntity}', from the faction, ${responsibleFaction}.`);
              return getFactionObjFromName(serverObj, responsibleFaction, "", function (err, responsibleFactionObj) {
                if (err) {
                  thisConsole.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!", err);
                } else {
                  event.emit('playerDeath', personObj, deathType, responsibleEntityObj, responsibleFactionObj, killerObj);
                }
              });

            } else {
              thisConsole.log(`${person} was killed by an entity, '${responsibleEntity}'.`);
              event.emit('playerDeath', personObj, deathType, responsibleEntityObj, "", killerObj);
            }
          } else if (deathType == "blackhole") {
            thisConsole.log(`${person} was killed by a black hole.`);
            event.emit('playerDeath', personObj, deathType);

          } else if (deathType == "star") {
            thisConsole.log(`${person} was killed by a star.`);
            event.emit('playerDeath', personObj, deathType);
          } else if (deathType == "asteroid") {
            thisConsole.log(`${person} was killed by an asteroid.`);
            event.emit('playerDeath', personObj, deathType);
          } else if (deathType == "planetSegment") {
            thisConsole.log(`${person} was killed by a planet segment.`);
            event.emit('playerDeath', personObj, deathType, responsibleEntityObj); // responsibleEntityObj will be undefined if no EntityObj was given.  //TODO: This needs to be tested.
          } else if (deathType == "planetCore") { // This is currently not used.  If functional, this would be for planet cores.
            thisConsole.log(`${person} was killed by a planet core.`);
            event.emit('playerDeath', personObj, deathType, responsibleEntityObj);
          } else if (deathType == "shipyarddesign") {
            thisConsole.log(`${person} was killed by a shipyard design.  How did that happen?!`);
            event.emit('playerDeath', personObj, deathType);
          } else if (testIfInput(responsibleFaction)) {
            return getFactionObjFromName(serverObj, responsibleFaction, "", function (err, responsibleFactionObj) {
              if (err) {
                thisConsole.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!", err);
              } else {
                thisConsole.log(`${person} was killed ${killer}, in the entity, ${responsibleEntity}, from the faction, ${responsibleFaction}.`);
                event.emit('playerDeath', personObj, deathType, responsibleEntityObj, responsibleFactionObj, killerObj);
              }
            });
          } else {
            thisConsole.log(`${person} was killed.  Deathtype was: ${deathType} --Responsible entity was: ${responsibleEntity}.`);
            event.emit('playerDeath', personObj, deathType, responsibleEntityObj, "", killerObj);
          }
        }

        // Here is where I need to run any sort of default death scripts, if desired.
      }
    }
  }
  return true; // added to make ESLint happy
}

function testMatch(valToCheck) { // This function will be called on EVERY line the wrapper outputs to see if the line matches a known event or not.
  // TODO: It might be better to simply return the match, then forward for processing, rather than running a test and processing the matches against it.
  // So really this should simply be replaced with a "getMatch" function which only returns the line if it matches

  // TODO:  There needs to be a separate check AND processing for the serverlog.0.log file, since there are some duplicates between the console.  This would also be faster.
  if (includePatternRegex.test(valToCheck)) {
    if (!excludePatternRegex.test(valToCheck)) {
      return true;
    }
    return false;

  } else {
    return false;
  }
}

function testMatchServerLog(valToCheck) { // This function will be called on EVERY line the wrapper outputs to see if the line matches a known event or not.
  // TODO: It would be much better to simply run the match, then forward for processing, rather than running a test and processing the matches against it.
  // So really this should simply be replaced with a "getMatch" function which only returns the line if it matches
  if (includePatternServerLogRegex.test(valToCheck)) {
    if (!excludePatternServerLogRegex.test(valToCheck)) {
      return true;
    }
    return false;
  } else {
    return false;
  }
}
