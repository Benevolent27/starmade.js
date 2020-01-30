// Updated to use installObj

module.exports = { // IMPORTANT: These cannot be used until the serverObj has been created for the install
  processDataInput,
  processServerlogDataInput
}

// This script needs to read from the server settings, so it needs the installObj
var installObj = global.getInstallObj(__dirname);
var {settings,event}=installObj;
var serverObj = {}; // This will be set after the "start" is given.
event.on("start", function (theServerObj) {
  serverObj = theServerObj;
});

const path = require('path');
const patterns = require(path.join(__dirname,"patterns.js")); // Import the patterns that will be used to match to in-game events like deaths and messages.
var includePatternRegex = patterns.includes();
var excludePatternRegex = patterns.excludes();
var includePatternServerLogRegex = patterns.serverLogIncludes();
var excludePatternServerLogRegex = patterns.serverLogExcluded();

const starNet = require(path.join(__dirname,"starNet.js"));
var {
  getUIDfromName,
  getFactionNumberFromName,
  getFactionObjFromName
} = starNet;


const mainFolder = path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself for testing purposes.
const wrapperBinFolder = path.join(mainFolder, "bin");
const objectHelper = require(path.join(wrapperBinFolder, "objectHelper.js"));
const miscHelpers = require(path.join(wrapperBinFolder, "miscHelpers.js"));
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

function processDataInput(dataInput) { // This function is run on every single line that is output by the server console.
  if (testMatch(dataInput)) { // Check to see if the message fits any of the regex patterns

    // TODO:  There needs to be a separate processing for the serverlog.0.log file, console, and stdout since there are some duplicates between the console.  This would also be faster.

    if (settings.showAllEvents == true) {
      console.log("Event found!: " + dataInput + "Arguments: " + arguments.length);
    }
    let theArguments = arguments[0].split(" "); // This is to allow easier parsing of each individual word in the line

    // enumerateEventArguments=true; // Temporary
    if (settings.enumerateEventArguments == true) {
      for (let i = 0;i < theArguments.length;i++) {
        console.log("stderr--theArguments[" + i + "]: " + theArguments[i]);
      }
    }
    // ### Player Messages ###
    if (theArguments[0] == "[CHANNELROUTER]") { // This is for all messages, including commands.
      let sender = dataInput.match(/\[sender=[A-Za-z0-9_-]*/).toString().replace(/^\[sender=/, "");
      let receiver = dataInput.match(/\[receiver=[A-Za-z0-9_-]*/).toString().replace(/^\[receiver=/, "");
      let receiverType = dataInput.match(/\[receiverType=[A-Za-z0-9_-]*/).toString().replace(/^\[receiverType=/, "");
      let message = dataInput.match(/\[message=.*(?=\]$)/).toString().replace(/^\[message=/, "");
      //arguments[0]: [CHANNELROUTER] RECEIVED MESSAGE ON Server(0): [CHAT][sender=Benevolent27][receiverType=CHANNEL][receiver=all][message=words]
      // console.log("Message found: ");
      // console.log("sender: " + sender);
      // console.log("receiver: " + receiver);
      // console.log("receiverType: " + receiverType);
      // console.log("message: " + message);
      event.emit('playerMessage', new serverObj.objects.MessageObj(sender, receiver, receiverType, message));

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
          // console.log("Player Spawned: " + playerName);
          if (settings["announceSpawnsToMainChat"] == "true") {
            let mMessage = "/server_message_broadcast plain " + "'" + playerName + " has spawned.'";
            serverObj.spawn.stdin.write(mMessage.toString().trim() + "\n");
          }
          let theReg = new RegExp(("(?<=PlS\\[" + playerName + " \\[)[^\\]]+"));
          let playerSMName = toStringIfPossible(dataInput.match(theReg));
          let playerObj = new serverObj.objects.PlayerObj(playerName);
          let playerSMNameObj;
          if (typeof playerSMName == "string") {
            playerSMNameObj = new serverObj.objects.SMNameObj(playerSMName);
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

        console.log("Some blueprint buy event happened."); // This might only be relevant if a server uses credits to buy blueprints?






      } else if (theArguments[0] == "[BLUEPRINT][LOAD]") { // New ship from load - possibly /spawn_mobs command
        // TODO:  Figure out why this isn't firing off on the first blueprint spawn.  It is ALWAYS the second blueprint spawn and all later spawns for some strange reason.
        console.log("Some blueprint load event happened.");
        let theUser = theArguments[1];
        console.log("theUser:" + theUser);
        var spawnType;
        if (theUser == "<admin>") {
          spawnType = "admin"
        } else if (theUser == "<system>") {
          spawnType = "massSpawn"
        } else {
          spawnType = "player"
        }
        console.log("spawnType:" + spawnType);

        let bluePrintName = dataInput.match(/loaded .*as "/)[0].replace(/^loaded /, "").replace(/ as "$/, "");
        console.log("bluePrintName:" + bluePrintName);
        let shipName = dataInput.match(/".*"/)[0].replace(/"/g, "");
        console.log("shipName:" + shipName);
        let coordsArray = dataInput.match(/\(.*\)/)[0].replace(/[()]/g, "").split(', ');
        console.log("coordsArray:" + coordsArray);
        console.log("X:" + coordsArray[0]);
        console.log("Y:" + coordsArray[1]);
        console.log("Z:" + coordsArray[2]);
        let factionNumber = dataInput.match(/(\d+)$/)[0];
        console.log("factionNumber:" + factionNumber);
        console.log(" ");
        console.log(" ");



        // starNet.getUIDfromName(shipName)
        return getUIDfromName(shipName, "", function (err, result) {
          if (err) {
            console.log("Error getting entity UID from name!", err);
          } else {
            let entityObj = new serverObj.objects.EntityObj(result);
            console.dir(entityObj);
            console.log("Creating new coordsObj with: " + coordsArray);
            let coordsObj = new serverObj.objects.CoordsObj(coordsArray);
            console.dir(coordsObj);
            let sectorObj = new serverObj.objects.SectorObj(coordsObj.x, coordsObj.y, coordsObj.z);
            console.dir(sectorObj);
            // let coordsObj=new serverObj.objects.CoordsObj(coordsArray[0],coordsArray[1],coordsArray[2]);

            let playerObj;
            if (spawnType == "player") {
              playerObj = new serverObj.objects.PlayerObj(theUser);
              playerObj.msg("The playerObj was successful: " + shipName);
              // playerObj.msg("entityObj.loaded:" + entityObj.loaded);
            }
            console.dir(playerObj);

            let blueprintObj = new serverObj.objects.BlueprintObj(bluePrintName);
            console.dir(blueprintObj);

            let factionObj = new serverObj.objects.FactionObj(factionNumber);
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
      // console.log("Sector change detected: " + dataInput);
      var excerptArray = dataInput.match(/has players attached. Doing Sector Change for PlS.*/);
      // console.log("excerptArray: ");
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
        // console.log("Coords:");
        // console.dir(cleanCoordsArray); // First set is the sector starting in, second is going to
        // console.log("Player Name: " + playerNameCaptured);
        // console.log("Player SM Name:" + playerSMNameCaptured);


        var startingCoords = new serverObj.objects.SectorObj(cleanCoordsArray[0]);
        var endingCoords = new serverObj.objects.SectorObj(cleanCoordsArray[1]);
        var player = new serverObj.objects.PlayerObj(playerNameCaptured);
        var playerSMName = new serverObj.objects.SMNameObj(playerSMNameCaptured);

        // TODO:  Test this to see if it works
        console.log("Sector change detected for player, '" + player.toString() + "', with registry name, '" + playerSMName.toString() + "', from sector, '" + startingCoords.toString() + "', to sector, '" + endingCoords.toString() + "'.");
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
        let playerObj = new serverObj.objects.PlayerObj(name);
        let factionObj = new serverObj.objects.FactionObj(factionID);
        event.emit('playerFactionJoin', playerObj, factionObj, factionNameString);
      }

    } else if (theArguments[0] == "[FACTIONMANAGER]") { // Player left a faction
      // STDERR: [FACTIONMANAGER] removing member: Benevolent27 from Faction [id=10003, name=whatever, description=Faction name, size: 1; FP: -142]; on Server(0)
      if (theArguments[1] == "removing") {
        console.debug("Player joined faction.  dataInput: " + dataInput);
        let name = theArguments[3];
        let factionID = toStringIfPossible(dataInput.match(/(?<=Faction \[id=)[-]{0,1}[0-9]+/));
        let factionName = toStringIfPossible(dataInput.match(/(?<=name=)[^,]+/));
        let nameObj = new serverObj.objects.PlayerObj(name);
        let factionObj = new serverObj.objects.FactionObj(factionID);
        event.emit('playerFactionLeave', nameObj, factionObj, factionName);
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
        let playerObj = new serverObj.objects.PlayerObj(playerName);
        let playerSmNameObj = new serverObj.objects.SMNameObj(playerSMName);
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
      let playerObj = new serverObj.objects.PlayerObj(playerName);
      let playerSmNameObj = new serverObj.objects.SMNameObj(playerSMName);
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

      let entityObj = new serverObj.objects.EntityObj(entityUID);
      return entityObj.exists("", function (err, result) {
        if (err) {
          return err;
        }
        if (result) {
          let sectorObj = new serverObj.objects.SectorObj(...theCoordsArray);
          // theSeconds
          if (typeof thePlayerString == "string") {
            var playerObj = new serverObj.objects.PlayerObj(thePlayerString);
          }
          if (typeof thePlayerSmName == "string") {
            var playerSMNameObj = new serverObj.objects.SMNameObj(thePlayerSmName);
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
              console.log("There was an error!", err);
              return err;
            }
            console.debug("ship theUID: " + theUID);
            if (testIfInput(theUID)) {
              let theEntityObj = new serverObj.objects.EntityObj(theUID);
              return event.emit("entityOverheatStopped", theEntityObj);
            }
            return false;
          })
        } else if (theType == "SpaceStation") {
          let theUID = toStringIfPossible(dataInput.match(/(?<=Server\(0\) SpaceStation\[)[^(]+/));
          console.debug("spacestation theUID: " + theUID);
          if (testIfInput(theUID)) {
            let theEntityObj = new serverObj.objects.EntityObj(theUID)
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
        console.log("theArguments[" + i + "]: " + theArguments[i]);
      }
    }
    // ### New Ship or Base Creation (not blueprints) ###
    if (theArguments[0] == "[SPAWN]") {
      // Event found!: [SERVER] Object Ship[Benevolent27_1523387756157](1447) didn't have a db entry yet. Creating entry!Arguments: 1
      console.log("Parsing possible ship or base spawn: " + theArguments.join(" ").toString());
      var playerName = theArguments[1];
      var playerObj = new serverObj.objects.PlayerObj(playerName);
      console.dir(playerObj); // temp
      // var shipName=arguments[0].match(/spawned new ship: "[0-9a-zA-Z _-]*/);
      var shipName = arguments[0].match(/spawned new ship: ["][0-9a-zA-Z _-]*/);
      if (shipName) {
        console.log("Temp shipName: " + shipName);
        shipName = shipName.toString().replace(/^spawned new ship: ["]/, '');
        // shipName=shipName.toString().split(":").pop();
        console.log("Temp shipName: " + shipName);
        return getUIDfromName(shipName, "", function (err, result) {
          if (err) {
            console.log("Error getting entity UID from name!", err);
          } else {
            let entityObj = new serverObj.objects.EntityObj(result);
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
              console.log("Error getting entity UID from name!", err);
            } else {
              let entityObj = new serverObj.objects.EntityObj(result);
              entityObj.spawnTime = Math.floor((new Date()).getTime() / 1000);
              event.emit('baseSpawn', playerObj, entityObj);
            }
          });
        }
      }
    } else if (theArguments[0] == "[DEATH]") {
      // Post 2.0 weapons update:
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
        var personObj = new serverObj.objects.PlayerObj(person);
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
            console.log("Secondary killer string: " + killer);
            // console.log(`killer: ${killer}`);
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
          var killerObj = new serverObj.objects.PlayerObj(killer);
        }
        if (responsibleEntity) {
          var responsibleEntityObj = new serverObj.objects.EntityObj(responsibleEntity);
        }
        // Cannot create a faction object here since we only have the name to work with.  We have to run an async function to get that FactionObj at the time of emitting

        if (lastMessage == String(message)) {
          console.debug("### SKIPPING DUPLICATE DEATH MESSAGE ###: " + lastMessage);
        } else {
          console.log(message);
          lastMessage = String(message); // This is needed to filter out any duplicate death messages, such as when a weapon has several outputs and they all killed a player at the same time.  Note we do not want to link to the "message" variable, but rather set a new string based on it.
          console.log("##### INFOS ######");
          // console.log("# Everything: ${b}"
          console.log(`# theDate: ${theDate}  theTime: ${theTime}  deathType: ${deathType}`);
          console.log(`# responsibleEntity: ${responsibleEntity}`);
          console.log(`# killer: ${killer}  responsibleFaction: ${responsibleFaction}`);
          console.log("dataInput: " + dataInput);
          console.log(`#### END INFOS #####`);
          console.log(" ");
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
            console.log(`${killer}${ofTheFaction} killed ${person} while piloting the entity, '${responsibleEntity}'.`);
            if (testIfInput(responsibleFaction)) {
              return getFactionObjFromName(serverObj, responsibleFaction, "", function (err, responsibleFactionObj) {
                if (err) {
                  console.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!", err);
                } else {
                  event.emit('playerDeath', personObj, deathType, responsibleEntityObj, responsibleFactionObj, killerObj);
                }
              });
            } else {
              event.emit('playerDeath', personObj, deathType, responsibleEntityObj, "", killerObj);
            }
          } else if (deathType == "entity") {
            if (testIfInput(responsibleFaction)) {
              console.log(`${person} was killed by an entity, '${responsibleEntity}', from the faction, ${responsibleFaction}.`);
              return getFactionObjFromName(serverObj, responsibleFaction, "", function (err, responsibleFactionObj) {
                if (err) {
                  console.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!", err);
                } else {
                  event.emit('playerDeath', personObj, deathType, responsibleEntityObj, responsibleFactionObj, killerObj);
                }
              });

            } else {
              console.log(`${person} was killed by an entity, '${responsibleEntity}'.`);
              event.emit('playerDeath', personObj, deathType, responsibleEntityObj, "", killerObj);
            }
          } else if (deathType == "blackhole") {
            console.log(`${person} was killed by a black hole.`);
            event.emit('playerDeath', personObj, deathType);

          } else if (deathType == "star") {
            console.log(`${person} was killed by a star.`);
            event.emit('playerDeath', personObj, deathType);
          } else if (deathType == "asteroid") {
            console.log(`${person} was killed by an asteroid.`);
            event.emit('playerDeath', personObj, deathType);
          } else if (deathType == "planetSegment") {
            console.log(`${person} was killed by a planet segment.`);
            event.emit('playerDeath', personObj, deathType, responsibleEntityObj); // responsibleEntityObj will be undefined if no EntityObj was given.  //TODO: This needs to be tested.
          } else if (deathType == "planetCore") { // This is currently not used.  If functional, this would be for planet cores.
            console.log(`${person} was killed by a planet core.`);
            event.emit('playerDeath', personObj, deathType, responsibleEntityObj);
          } else if (deathType == "shipyarddesign") {
            console.log(`${person} was killed by a shipyard design.  How did that happen?!`);
            event.emit('playerDeath', personObj, deathType);
          } else if (testIfInput(responsibleFaction)) {
            return getFactionObjFromName(serverObj, responsibleFaction, "", function (err, responsibleFactionObj) {
              if (err) {
                console.log("ERROR: Could not get factionObj from responsibleFaction: " + responsibleFaction + " -- Cannot emit event!!", err);
              } else {
                console.log(`${person} was killed ${killer}, in the entity, ${responsibleEntity}, from the faction, ${responsibleFaction}.`);
                event.emit('playerDeath', personObj, deathType, responsibleEntityObj, responsibleFactionObj, killerObj);
              }
            });
          } else {
            console.log(`${person} was killed.  Deathtype was: ${deathType} --Responsible entity was: ${responsibleEntity}.`);
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
