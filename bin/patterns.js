
// This file has all the base patterns that match things like player messages, deaths, gravity changes, etc.

var includePatterns=[];
var excludePatterns=[];
function included(){ // Include Patterns
  includePatterns.push("^\\[SERVER\\] MAIN CORE STARTED DESTRUCTION"); // This is for ship overheats.  It was implemented with systems 2.0, but it's bugged.  It fires off not only when ships overheat but also when they are destroyed.
  includePatterns.push("^\\[SERVER\\]\\[SPAWN\\]");
  includePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\]"); // Player disconnects
  includePatterns.push("^\\[PLAYER\\]\\[DEATH\\]");
  includePatterns.push("^\\[SERVER\\] PlS\\[");
  includePatterns.push("^\\[SERVER\\]\\[PLAYERMESSAGE\\]");
  includePatterns.push("^\\[CHANNELROUTER\\]"); // These are messages sent from players
  includePatterns.push("^\\[SERVER\\] Object Ship\\[");
  includePatterns.push("^\\[CHARACTER\\]\\[GRAVITY\\] # This is the main gravity change");
  includePatterns.push("^PlayerCharacter\\["); // # This handles killing creatures as a player as well as some wonky gravity changes.  I need to compare this to the main gravity changes to see if I should utilize it or not for that.
  includePatterns.push("^Ship\\[ "); // # This handles killing NPC creatures from a ship and possibly other things.. but I haven't seen anything else in the logs to indicate the "other things"
  includePatterns.push("^SpaceStation\\["); // # This handles killing NPC creatures from a station
  includePatterns.push("^AICharacter\\["); // # This handles NPC creature deaths from other NPC characters
  includePatterns.push("^Sector\\["); // # This handles NPC creature deaths via black hole or star damage
  includePatterns.push("^Planet[(]"); // # This handles NPC creature death via planet
  includePatterns.push("^ManagedAsteroid[(]"); // This handles NPC creature deaths via asteroids that have been modified in some way
  includePatterns.push("^\\[DEATH\\]");
  includePatterns.push("^\\[SPAWN\\]"); // This is for the serverlog.0.log, which shows when a player spawns in a ship -- this information is not found in the console output or elsewhere.
  includePatterns.push("^\\[BLUEPRINT\\]"); // Blueprint spawns, including admin spawns.  They can be separated.
  includePatterns.push("^\\[SEGMENTCONTROLLER\\] ENTITY");
  includePatterns.push("^\\[FACTION\\]");
  includePatterns.push("^\\[FACTIONMANAGER\\]");
  includePatterns.push("^\\[SHUTDOWN\\]");  // When the server shuts down naturally
  var includePatternRegexTemp="(" + includePatterns[0];
  for (var i=1;i<includePatterns.length;i++){ includePatternRegexTemp+="|" + includePatterns[i]; }
  includePatternRegexTemp+=")"
  var includePatternRegex=new RegExp(includePatternRegexTemp);
  return includePatternRegex;
}
// Exclude Patterns
function excluded(){
  excludePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'null'"); // These spam all over the damn place so we want to filter them out.
  excludePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'Info-Pinger \\(server-lists\\)'"); // Every time someone refreshes their server list from the main menu of the game, all servers have a message on their console.
  excludePatterns.push(".*Narrowphase of Sector.*");
  excludePatterns.push("^\\[BLUEPRINT\\]\\[SPAWNINDB\\]");
  var excludePatternRegexTemp="(" + excludePatterns[0];
  for (let i=1;i<excludePatterns.length;i++){ excludePatternRegexTemp+="|" + excludePatterns[i]; }
  excludePatternRegexTemp+=")"
  var excludePatternRegex=new RegExp(excludePatternRegexTemp);
  return excludePatternRegex;
}

module.exports={
  "includes":included,
  "excludes":excluded
};
