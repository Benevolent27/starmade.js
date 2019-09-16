
// This file has all the base patterns that match things like player messages, deaths, gravity changes, etc.


// TODO: Create pattern matching JUST for the serverlog.0.log and stdout

function includedServerLog(){
  var includePatternsServerLog=[];
  includePatternsServerLog.push("^\\[DEATH\\]");
  includePatternsServerLog.push("^\\[SPAWN\\]"); // Ship spawns -- this information is not found in the console output or elsewhere.
  // includePatternsServerLog.push("^\\[BLUEPRINT\\]"); // Blueprint spawns, including admin spawns.  They can be separated.  I believe this is in BOTH the serverlog.0.log AND the console output.  Console output should be preferred.
  includePatternsServerLog.push("^\\[SEGMENTCONTROLLER\\] ENTITY");
  includePatternsServerLog.push("^\\[FACTION\\]");
  includePatternsServerLog.push("^\\[FACTIONMANAGER\\]");
  includePatternsServerLog.push("^\\[SHUTDOWN\\]");  // When the server shuts down naturally

  var includePatternServerLogRegexTemp="(" + includePatternsServerLog[0];
  for (var i=1;i<includePatternsServerLog.length;i++){ includePatternServerLogRegexTemp+="|" + includePatternsServerLog[i]; }
  includePatternServerLogRegexTemp+=")"
  var includePatternServerLogRegex=new RegExp(includePatternServerLogRegexTemp);
  return includePatternServerLogRegex;
}

// Exclude Patterns
function serverLogExcluded(){
  var excludeServerLogPatterns=[];
  excludeServerLogPatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'null'"); // This spams both the serverlog.0.log AND console output.
  excludeServerLogPatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'Info-Pinger \\(server-lists\\)'"); // This is in both serverlog.0.log AND console output.  Every time someone refreshes their server list from the main menu of the game, all servers have a message on their console.
  excludeServerLogPatterns.push("^\\[BLUEPRINT\\]\\[SPAWNINDB\\]"); // I'm not sure if this shows in the serverlog.0.log file or not.  Might be safe to remove.
  var excludePatternServerLogRegexTemp="(" + excludeServerLogPatterns[0];
  for (let i=1;i<excludeServerLogPatterns.length;i++){ excludePatternServerLogRegexTemp+="|" + excludeServerLogPatterns[i]; }
  excludePatternServerLogRegexTemp+=")"
  var excludeServerLogPatternRegex=new RegExp(excludePatternServerLogRegexTemp);
  return excludeServerLogPatternRegex;
}


function included(){ // Include Patterns
  var includePatterns=[];
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
  includePatterns.push("^\\[BLUEPRINT\\]"); // Blueprint spawns, including admin spawns.  They can be separated.  I believe this is in BOTH the serverlog.0.log AND the console output.  Console output should be preferred.


  // TODO:  Translate the sector movement patterns to starmade.js for interpretation
  includePatterns.push("^\\[SERVER\\] PlayerCharacter\\["); // Sector movement while in astronaut mode
  includePatterns.push("^\\[SERVER\\] Ship\\["); // Sector movement while in a ship (including movement and jumping)
  includePatterns.push("^\\[SERVER\\] Planet[(]"); // Sector movement while attache to a planet
  includePatterns.push("^\\[SERVER\\] ManagedAsteroid[(]"); // Sector movement while attached to an asteroid

  includePatterns.push("^Server[(]0[)] .*STOPPED OVERHEATING$"); // Entity stopped overheating
  // overheat stopped: STDERR: Server(0) Ship[destroyThisShip](19) STOPPED OVERHEATING
  // false positive: STDERR: Server(0); Faction [id=-2001, name=Neutral Fauna Fac 1, description=A Neutral Fanua Faction, size: 0; FP: 100] ON RULE CHANGED: []
  includePatterns.push("^\\[FACTION\\]"); // Faction joins
  includePatterns.push("^\\[FACTIONMANAGER\\]"); // Faction leaves

  // serverlog.0.log - TODO: Futher testing is needed to ensure these are not included in the console output.
  // includePatterns.push("^\\[DEATH\\]");
  // includePatterns.push("^\\[SPAWN\\]"); // This is for the serverlog.0.log, which shows when a player spawns in a ship -- this information is not found in the console output or elsewhere.
  // includePatterns.push("^\\[SEGMENTCONTROLLER\\] ENTITY");
  // includePatterns.push("^\\[SHUTDOWN\\]");  // When the server shuts down naturally



  var includePatternRegexTemp="(" + includePatterns[0];
  for (var i=1;i<includePatterns.length;i++){ includePatternRegexTemp+="|" + includePatterns[i]; }
  includePatternRegexTemp+=")"
  var includePatternRegex=new RegExp(includePatternRegexTemp);
  return includePatternRegex;
}
// Exclude Patterns
function excluded(){
  var excludePatterns=[];
  excludePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'null'"); // This spams both the serverlog.0.log AND console output.
  excludePatterns.push("^\\[SERVER\\]\\[DISCONNECT\\] Client 'Info-Pinger \\(server-lists\\)'"); // This is in both serverlog.0.log AND console output.  Every time someone refreshes their server list from the main menu of the game, all servers have a message on their console.
  excludePatterns.push(".*Narrowphase of Sector.*");
  excludePatterns.push("^\\[BLUEPRINT\\]\\[SPAWNINDB\\]");
  excludePatterns.push("^\\[BLUEPRINT\\] BASE PATH:"); // These seem to be firing off in the latest version, very annoying.
  excludePatterns.push("^\\[BLUEPRINT\\] USING TRANSIENT:"); // These seem to be firing off in the latest version, very annoying.
  excludePatterns.push("^\\[BLUEPRINT\\]\\[MIGRATION\\]"); // This happens when the server starts.  Might be useful later, but not now.
  
  var excludePatternRegexTemp="(" + excludePatterns[0];
  for (let i=1;i<excludePatterns.length;i++){ excludePatternRegexTemp+="|" + excludePatterns[i]; }
  excludePatternRegexTemp+=")"
  var excludePatternRegex=new RegExp(excludePatternRegexTemp);
  return excludePatternRegex;
}

module.exports={
  "includes":included,
  "excludes":excluded,
  "serverLogIncludes":includedServerLog,
  "serverLogExcluded":serverLogExcluded
};
