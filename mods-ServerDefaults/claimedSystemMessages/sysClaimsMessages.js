/* eslint-disable no-unmodified-loop-condition */
/* eslint-disable no-await-in-loop */

// TODO:  Add adding and removing of system claims as they occur to allClaimedSystems var

// This mod allows founders of factions to set a message for a system that their faction has claimed.
// Whenever any player moves to any sector within the system, they will receive the message.
// This message should only display once to the player, till they move out of the system.
// There is an exception for spawns.  It will always display if a player spawns within that system.

// ################
// ### SETTINGS ###
// ################
// Seconds to wait after server start before grabbing the faction owned systems via SQL Query. Note that if a player joins the server before this time, the query will happen then instead.
const millisecondsToWaitTillSQLQuery=10000; // Default is 120000, which is 2 minutes.

// ### Script Set up
const {objectHelper,miscHelpers,sleep} = global; // Some random, but very useful helper functions I added.
const {i} = miscHelpers;
const {getOption}=objectHelper;
// ### Get the installObj and set things up ###
const installObj = global.getInstallObj(__dirname);
const {event,console:thisConsole} = installObj;
var systemMessages=installObj.getJSON(__dirname,"sysClaimsMessages");
// example:
// {
//   "1 2 3":{
//     10000:"This is a message for faction 10000",
//     10001:"This is a message for a different faction"
//   },
//   "2 3 0":{
//     10003:"This is a message that displays to people who enter this system, IF it is claimed by this faction"
//   }
// }
var serverObj={};
var allClaimedSystems=null; // Will remain undefined or null until it is built
var allSystemClaimsBuilding=false;
var commandOperator="!";
var playerTracking={};
event.on("start",function(theServerObj){
  serverObj=theServerObj;
  commandOperator=serverObj.settings.commandOperator;
  startEvent();
});
event.on("serverStart",function(){
  startEvent();
});
event.on("serverStop",function(){
  allSystemClaimsBuilding=null; // Will allow the command to run again if the server is restarted.
});
event.on("commandStart",function(regCommand){
  thisConsole.log("Registering commands for sysClaimsMessages.js..");
  regCommand("SetSystemMessage", "System Commands", false, true,{},setSystemMessage);
  regCommand("RemoveSystemMessage", "System Commands", false, true,{},removeSystemMessage);
  regCommand("ShowSystemMessage", "System Commands", false, true,{},showSystemMessage);
});

function wasPlayerMessagedForSystem(playerName,systemCoords){
  if (playerTracking.hasOwnProperty(playerName)){
    if (playerTracking[playerName] == systemCoords){
      return true;
    }
  }
  return false;
}
event.on("playerSectorChange", function(player, startingCoords, endingCoords, playerSMName){
  let playerSystem=endingCoords.system.toString();
  let playerLastSystem=startingCoords.system.toString();
  if (playerSystem != playerLastSystem){ // If the player moves out of a system, reset the tracker for it if had been messaged for that system
    if (wasPlayerMessagedForSystem(player.name,playerLastSystem)){
      delete playerTracking[player.name];
    }
  }
  if (!wasPlayerMessagedForSystem(player.name,playerSystem)){ // Only message the player if they haven't already been messaged for this system.  This is to avoid duplicate messages if the player moves around the same system.
    let systemMessage=getSystemMessage(playerSystem);
    if (systemMessage !== null){
      playerTracking[player.name]=playerSystem;
      return sendPlayerSystemMessage(player,`${systemMessage}`,{fast:true}).catch(dispErr);
    }
  }
  return false;
});

async function showSystemMessage(player, command, args, messageObj, options){
  if (getOption(options,"help") == true || (/^help$/i).test(args[0])){ 
    return showSystemMessageHelp(player,command,{fast:true});
  }
  var playerSystem=await player.system().catch(dispErr);
  if (playerSystem === null){
    return player.botMsg("There was a problem finding your current system!  Please try again!").catch(dispErr);
  } else {
    let theMsg=getSystemMessage(playerSystem.toString());
    if (typeof theMsg == "string"){ // Will be null if not exist
      return player.msg(`[ System greeting for current system ]: ${theMsg}`,{fast:true}).catch(dispErr);
    } else {
      return player.botMsg(`There is currently no message active for the system, ${playerSystem.toString()}!`,{fast:true}).catch(dispErr);
    }
  }
}
function showSystemMessageHelp(player,command,options){
  player.botMsg("This command shows the active system message for the system you currently are within, if one has been set.",options).catch(dispErr);
  player.msg(`Usage: ${commandOperator}${command}`,options).catch(dispErr);
  player.msg("Note:  If a message was set previously but the system is no longer owned by that faction, no message will show.",options).catch(dispErr);
}

async function removeSystemMessage(player, command, args, messageObj, options){
  if (getOption(options,"help") == true || (/^help$/i).test(args[0])){ 
    return removeSystemMessageHelp(player,command,{fast:true});
  }
  var playerSystem=await player.system().catch(dispErr);
  if (playerSystem === null){
    return player.botMsg("There was a problem finding your current system!  Please try again!").catch(dispErr);
  } else {
    var playerFaction=await player.faction().catch(dispErr);
    if (playerFaction === null){
      return player.botMsg("You are not currently in a faction!  Cannot remove a system claim message for this system unless you are IN a faction and have claimed the system!",{fast:true}).catch(dispErr);
    } else {
      // Check to ensure the player is faction rank 5 (founder)
      let playerRank=await player.getFactionRank().catch(dispErr);
      if (playerRank === null){
        return player.botMsg("ERROR: There was a problem when attempting to determine your faction rank!  Please try again!",{fast:true}).catch(dispErr);
      } else if (playerRank == 5){ // Player is a founder
        // Check to see if the system has a current message for this faction
        let oldMsg=getSystemMessage(playerSystem.toString(),playerFaction.number);
        if (typeof oldMsg == "string"){ // Will be null if not exist
          player.botMsg(`Deleting your factions message for this current system (${playerSystem.toString()})..`,{fast:true}).catch(dispErr);
          player.msg(`Old System Message: ${oldMsg}`,{fast:true}).catch(dispErr);
          removeSystemMessagesForFactionAndSystem(playerFaction.number,playerSystem.toString());
          return player.msg("When players enter your system, they will no longer see a message.",{fast:true}).catch(dispErr);
        } else {
          return player.msg(`Your faction did not have a system message set for this current system (${playerSystem.toString()})!  Nothing to delete!`,{fast:true}).catch(dispErr);
        }
      } else { // Player was not founder
        return player.msg("ERROR:  Only faction founders can remove a system message for their faction!",{fast:true}).catch(dispErr);
      }
    }
  }
}
function removeSystemMessageHelp(player,command,options){
  player.botMsg("This command is used to remove a system message that your faction has previously set for the system you currently are within.",options).catch(dispErr);
  player.msg(`Usage: ${commandOperator}${command}`,options).catch(dispErr);
  player.msg(" ",options);
  player.msg("Note that this command can only be used by faction owners.",options).catch(dispErr);
}
async function setSystemMessage(player, command, args, messageObj, options){
  if (getOption(options,"help") == true || (/^help$/i).test(args[0])){ 
    return setSystemMessageHelp(player,command,{fast:true});
  }
  var playerSystem=await player.system().catch(dispErr);
  if (playerSystem === null){
    return player.botMsg("There was a problem finding your current system!  Please try again!").catch(dispErr);
  } else {
    var playerFaction=await player.faction().catch(dispErr);
    if (playerFaction === null){
        return player.botMsg("You are not currently in a faction!  Cannot set a system claim message unless you are IN a faction and have claimed the system you are currently in!",{fast:true}).catch(dispErr);
    } else {
      // Ensure the player is a founder
      let playerRank=await player.getFactionRank().catch(dispErr);
      if (playerRank === null){
        return player.botMsg("ERROR: There was a problem when attempting to determine your faction rank!  Please try again!",{fast:true}).catch(dispErr);
      } else if (playerRank == 5){ // Player is a founder
        // Check to see if the player's faction owns the system.
        await serverObj.forceSave().catch(dispErr); // This is to ensure the check is accurate
        let checkOwnership=await serverObj.sqlQuery(`SELECT OWNER_FACTION FROM PUBLIC.SYSTEMS WHERE OWNER_FACTION='${playerFaction.number}' AND X=${playerSystem.x} AND Y=${playerSystem.y} AND Z=${playerSystem.z}`); // Should return an array, which will have 1 entry if the person's faction owns the system or will be an empty array if not.
        if (Array.isArray(checkOwnership)){
          if (checkOwnership.length==0){ // Player's faction does NOT own the current system
            return player.botMsg("Sorry but your faction has not claimed this system!  Cannot set a system message for a system you do not currently control!",{fast:true});
          } else if (args.length > 0){ // Player's faction owns the current system and a message was given
              var newMsg=args.join(" ");
              player.botMsg("Setting the display message for this current system..",{fast:true}).catch(dispErr);
              let oldMsg=getSystemMessage(playerSystem.toString());
              if (typeof oldMsg == "string"){ // Will be null if not exist
                player.msg(`Old System Message: ${oldMsg}`,{fast:true}).catch(dispErr);
              }
              setSystemDataMessage(playerSystem.toString(),playerFaction.number,newMsg)
              player.msg(`Set system message to: ${newMsg}`,{fast:true}).catch(dispErr);
              return player.msg("When players enter your system, they will now see this message!",{fast:true}).catch(dispErr);
          } else { // No message was given
            player.botMsg("Error:  You must provide the message you would like to display for players who enter this system!",{fast:true}).catch(dispErr);
            player.msg(`Example: ${commandOperator}${command} Hello and welcome to my home system!`,{fast:true}).catch(dispErr);
            return player.msg(`For more help on this command, type: ${commandOperator}help ${command}`,{fast:true}).catch(dispErr);
          }
        } else {
          return player.botMsg("There was an error checking if you own this current system!  Please try again!").catch(dispErr);
        }
      } else { // Player was not founder
        return player.msg("ERROR:  Only faction founders can set a system message for their faction!  You are not ranked as a founder!",{fast:true}).catch(dispErr);
      }
    }
  }
}
function setSystemMessageHelp(player,command,options){
  player.botMsg("This command is used to set a message that will display to players who join this current system.",options).catch(dispErr);
  player.msg("You must be in a faction and it MUST own this current system!  You must also be the owner of the faction to use this!",options).catch(dispErr);
  player.msg(`Usage: ${commandOperator}${command} [message]`,options).catch(dispErr);
  player.msg(`Example: ${commandOperator}${command} Hello and welcome to my system!`,options).catch(dispErr);
  player.msg(` `,options);
  player.msg(`Related commands: RemoveSystemMessage and ShowSystemMessage.`,options);
}

function sendPlayerSystemMessage(playerObj,message,options){
  return playerObj.msg(`MESSAGE FROM SYSTEM OWNER: ${message}`,options).catch(dispErr);
}
event.on("playerSpawn",async function(playerObj){ // This is for displaying the system message to a player upon spawn
  while (allClaimedSystems === null){ // This is to ensure the first player who joins within the 2 minute timeframe will get a message after the system claim data has been pulled
    await sleep(5000);
  }
  var playerSystem=await playerObj.system().catch(dispErr);
  if (playerSystem !== null){ // The player may go offline or there may be some other error getting their system, so we should just not do anything if that happens.
    var systemMessage=getSystemMessage(playerSystem.toString());
    if (typeof systemMessage == "string"){
      playerTracking[playerObj.name]=playerSystem.toString();
      return sendPlayerSystemMessage(playerObj,`${systemMessage}`,{fast:true}).catch(dispErr);
    }
  }
  return false;
});
event.on("playerSpawn",getSystemClaimsOnPlayerSpawn);
function getSystemClaimsOnPlayerSpawn(){ // This is is to build the database with the first player join if it happens before the default 2 minute starter
  return getAllClaimedSystems();
};
event.on("factionDisbanded",function(factionObj,factionNameStr){ // All system messages for this faction should be removed if it is disbanded.
  thisConsole.log(`Removing System Messages for faction: ${factionNameStr}`);
  removeSystemMessagesForFaction(factionObj.number);
});

async function startEvent(){
  await sleep(millisecondsToWaitTillSQLQuery); // Wait 2 minutes to give the server time to boot
  return getAllClaimedSystems();
}
async function getAllClaimedSystems(){
  if (allSystemClaimsBuilding){
    return true;
  }
  allSystemClaimsBuilding=true; // Makes sure we only run this once
  event.removeListener("playerSpawn",getSystemClaimsOnPlayerSpawn); // We don't need to listen to spawns anymore, since this is running.
  var test=null;
  while (test !== null){ // Wait till the server is online.  This will be null if server not online.
    test=await serverObj.status().catch(ignoreErr);
    await sleep(5000);
  }
  // Server should be started now.
  var tempClaims=null;
  thisConsole.log("sysClaimsMessages.js: Gathering system claims..");
  while (tempClaims === null){
    tempClaims=await getAllSystemClaims().catch(dispErr); // will return null on error
    if (tempClaims === null){
      await sleep(5000);
    }
  }
  thisConsole.log(`sysClaimsMessages.js: Found ${tempClaims.length} system claims.`);
  // Let's do some post processing to make checking coordinates easier.
  // Example array after being built:
  // [
  //   {
  //     X:2,
  //     Y:3,
  //     Z:2,
  //     OWNER_FACTION:10000
  //   },
  //   {
  //     X:4,
  //     Y:0,
  //     Z:1,
  //     OWNER_FACTION:10001
  //   }
  // ]

  // Now to build the allClaimedSystems object, with each system XYZ as an element that contains the faction number.
  allClaimedSystems=tempClaims.reduce((theObj,objVal) => {
    theObj[`${objVal.X} ${objVal.Y} ${objVal.Z}`]=objVal.OWNER_FACTION;
    return theObj;
  },{});
  // Should look similar to:
  // {
  //   "2 3 2":10000,
  //   "4 0 1":10001
  // }
  // Note:  These are system coordinates, not sector coordinates.
  // Also note that if no system claims have happened, this will be an empty object
  return true;
}

function dispErr(err){
  thisConsole.log(err);
}
function ignoreErr(){
  thisConsole.debug("Ignored error");
}
function getAllSystemClaims(){
  return serverObj.sqlQuery("SELECT X,Y,Z,OWNER_FACTION FROM PUBLIC.SYSTEMS WHERE OWNER_FACTION!='0';"); // Includes NPC factions
  // return serverObj.sqlQuery("SELECT X,Y,Z,OWNER_FACTION FROM PUBLIC.SYSTEMS WHERE OWNER_FACTION!='0' AND OWNER_FACTION NOT LIKE '-%';"); // Excludes NPC factions which are negative numbers
}

function getSystemMessage(systemCoords,factionNum){ // systemCoords must always be provided, factionNum is optional
  // Gets the system message of a system if there is a message designated for the current faction that is controlling it.
  // If a factionNum is provided, it will look for the system message for this faction, EVEN IF that faction does NOT currently own the system!
  if (typeof factionNum == "undefined"){
    if (allClaimedSystems !== null){
      if (allClaimedSystems.hasOwnProperty(systemCoords)){
        if (systemMessages.hasOwnProperty(systemCoords)){
          if (systemMessages[systemCoords].hasOwnProperty(allClaimedSystems[systemCoords])){
            return systemMessages[systemCoords][allClaimedSystems[systemCoords]]; //  This will be the message assigned to it.
          }
        }
      }
    }
    // No message exists or the allClaimedSystems variable has not been set yet.
  } else if (systemMessages.hasOwnProperty(systemCoords)){
    if (systemMessages[systemCoords].hasOwnProperty(factionNum)){
      return systemMessages[systemCoords][factionNum];
    }
  }
  return null;
}
function setSystemDataMessage(systemCoords,factionNum,theMessage){ // Overwrites any existing message without warning
  if (allClaimedSystems !== null){
    if (!systemMessages.hasOwnProperty(systemCoords)){
      systemMessages[String(systemCoords)]={};
    }
    systemMessages[systemCoords][factionNum]=theMessage;
    return true;
  }
  return false; // Indicates no change happened
}
function removeSystemMessagesForFaction(factionNum){
  var systemMessagesKeys=systemMessages.keys();
  for (let i=0;i<systemMessagesKeys.length;i++){
    if (systemMessages[systemMessagesKeys[i]].hasOwnProperty(factionNum)){
      thisConsole.log(`Removing System Message for system, ${systemMessagesKeys[i]}, and faction, ${factionNum}.`);
      delete systemMessages[systemMessagesKeys[i]][factionNum];
    }
  }
  return true;
}
function removeSystemMessagesForFactionAndSystem(factionNum,systemCoords){
  if (systemMessages.hasOwnProperty(systemCoords)){
    if (systemMessages[systemCoords].hasOwnProperty(factionNum)){
      thisConsole.log(`Removing System Message for system, ${systemCoords}, and faction, ${factionNum}.`);
      delete systemMessages[systemCoords][factionNum];
      return true;
    }
  }
  return false; // Nothing to remove.
}
