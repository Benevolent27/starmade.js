// Updated to use installObj
var installObj=global.getInstallObj(__dirname);
var {event,settings,log}=installObj; // TODO: Add console back once it's working.
const thisConsole=installObj.console;
var {toNumIfPossible,toStringIfPossible,getOption}=global.objectHelper;
var {i} = global.miscHelpers;
var thisServerObj={};



event.on('start',function(theServerObj){
  thisServerObj=theServerObj;
  // #####  SERVER CONTROL  #####
  thisConsole.regCommand("Start","Server Controls",start);
  thisConsole.regCommand("Stop","Server Controls",stop);
  thisConsole.regCommand("Install","Server Controls",install);
  thisConsole.regCommand("AutoRestart","Server Controls",autoRestart);
  // #####  SERVER INFO  #####
  thisConsole.regCommand("Status","Server Info",currentStatus);
  thisConsole.regCommand("Players","Server Info",onlinePlayers);
  // #####  SERVER TEXT TO DISPLAY  #####
  thisConsole.regCommand("ShowAllEvents","Server Text Display",showAllEvents);
  thisConsole.regCommand("Stdout","Server Text Display",stdout);
  thisConsole.regCommand("Stderr","Server Text Display",stderr);
  thisConsole.regCommand("StderrFilter","Server Text Display",stderrFilter);
  thisConsole.regCommand("stdoutFilter","Server Text Display",stdoutFilter);
  
});

function showAllEvents(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    return showAllEventsHelp();
  } else if (theArguments.length == 0){
    thisConsole.log("showAllEvents is currently set to: " + thisServerObj.settings["showAllEvents"]);
    thisConsole.log("For help on this command, type !help showAllEvents");
  } else if (i(theArguments[0],"on")){
    thisConsole.log("Setting showAllEvents to true!");
    thisServerObj.settings["showAllEvents"]=true;
  } else if (i(theArguments[0],"off")){
    thisConsole.log("Setting showAllEvents to false!");
    thisServerObj.settings["showAllEvents"]=false;
  } else {
    thisConsole.log("Invalid parameter given!");
    showAllEventsHelp();
  }
  return true;
}
function showAllEventsHelp(){
  thisConsole.log("This command is used to force display STDERR, STDOUT output from the server.");
  thisConsole.log("Usage: !showAllEvents [on/off]");
  thisConsole.log("Note:  If off, the individual settings for stderr and stdout apply.");
}
function autoRestart(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    showAutoRestartHelp();
  } else if (theArguments.length == 0){
    thisConsole.log("autoRestart is currently set to: " + thisServerObj.settings["autoRestart"]);
    thisConsole.log("For help on this command, type !help autoRestart");
  } else if (i(theArguments[0],"on")){
      thisConsole.log("Setting autoRestart to true!");
      thisServerObj.settings["autoRestart"]=true;
  } else if (i(theArguments[0],"off")){
    thisConsole.log("Setting autoRestart to false!");
    thisServerObj.settings["autoRestart"]=false;
  } else {
    thisConsole.log("Invalid parameter given!");
    showAutoRestartHelp();
  }
  return true;
}
function showAutoRestartHelp(){
  thisConsole.log("This command is used to turn auto-restart on or off for the server.  This triggers when the server shuts down unexpectedly.");
  thisConsole.log("Usage: !autoRestart [on/off]");
}
function stdout(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    showStdoutHelp();
  } else if (theArguments.length == 0){
    thisConsole.log("showStdout is currently set to: " + thisServerObj.settings["showStdout"]);
    thisConsole.log("For help on this command, type !help stdout");
  } else if (i(theArguments[0],"on")){
    thisConsole.log("Setting showStdout to true!");
    thisServerObj.settings["showStdout"]=true;
  } else if (i(theArguments[0],"off")){
    thisConsole.log("Setting showStdout to false!");
    thisServerObj.settings["showStdout"]=false;
  } else {
    thisConsole.log("Invalid parameter given!");
    showStdoutHelp();
  }
  return true;
}
function showStdoutHelp(){
  thisConsole.log("This command is used to turn the wrapper display for STDOUT ON or OFF for the server.");
  thisConsole.log("Usage: !stdout [on/off]");
  thisConsole.log("Note:  If ShowAllEvents is on, this setting is ignored.");
}
function stderr(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    showStderrHelp();
  } else if (theArguments.length == 0){
    thisConsole.log("showStderr is currently set to: " + thisServerObj.settings["showStderr"]);
    thisConsole.log("For help on this command, type !help stderr");
  } else if (i(theArguments[0],"on")){
    thisConsole.log("Setting showStderr to true!");
    thisServerObj.settings["showStderr"]=true;
  } else if (i(theArguments[0],"off")){
    thisConsole.log("Setting showStderr to false!");
    thisServerObj.settings["showStderr"]=false;
  } else {
    thisConsole.log("Invalid parameter given!");
    showStderrHelp();
  }
  return true;
}
function showStderrHelp(){
  thisConsole.log("This command is used to turn the wrapper display for STDERR ON or OFF for the server.");
  thisConsole.log("Usage: !stderr [on/off]");
  thisConsole.log("Note:  If ShowAllEvents is on, this setting is ignored.");
}
function stderrFilter(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    stderrFilterHelp();
  } else if (theArguments.length == 0){
    if (thisServerObj.settings["stderrFilter"]){
      thisConsole.log("stderrFilter is currently set to: " + thisServerObj.settings["stderrFilter"]);
    } else {
      thisConsole.log("No stderrFilter has been set." + thisServerObj.settings["stderrFilter"]);
    }
    thisConsole.log("For help on this command, type !help stderrFilter");
  } else if (theArguments[0] == "-clear"){
      thisServerObj.settings["stderrFilter"]=false;
  } else {
    try {
      thisServerObj.settings["stderrFilter"]=new RegExp(theArguments.join(""));
    } catch (err){
      thisConsole.log("Error creating regExp pattern!  Please correct for the following error and try again:");
      thisConsole.log(err);
      stderrFilterHelp();
    }
  }
  return true;
}
function stderrFilterHelp(){
  thisConsole.log("This command is used to set a filter for what stderr lines to display to the wrapper console.");
  thisConsole.log("Usage:  !stderrfilter [Filter/-clear]")
  thisConsole.log("Example1 !stderrfilter ^\\[SPAWN\\]");
  thisConsole.log("Example2: !stderrfilter -clear");
}
function stdoutFilter(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    stdoutFilterHelp();
  } else if (theArguments.length == 0){
    if (thisServerObj.settings["stdoutFilter"]){
      thisConsole.log("stdoutFilter is currently set to: " + thisServerObj.settings["stdoutFilter"]);
    } else {
      thisConsole.log("No stdoutFilter has been set." + thisServerObj.settings["stdoutFilter"]);
    }
    thisConsole.log("For help on this command, type !help stdoutFilter");
  } else if (theArguments[0] == "-clear"){
      thisServerObj.settings["stdoutFilter"]=false;
  } else {
    try {
      thisServerObj.settings["stdoutFilter"]=new RegExp(theArguments.join(""));
    } catch (err){
      thisConsole.log("Error creating regExp pattern!  Please correct for the following error and try again:");
      thisConsole.log(err);
      stdoutFilterHelp();
    }
  }
  return true;
}
function stdoutFilterHelp(){
  thisConsole.log("This command is used to set a filter for what stdout lines to display to the wrapper console.");
  thisConsole.log("Usage:  !stdoutFilter [Filter/-clear]")
  thisConsole.log("Example1 !stdoutFilter ^\\[SPAWN\\]");
  thisConsole.log("Example2: !stdoutFilter -clear");
}
async function onlinePlayers(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    onlinePlayersHelp();
  } else if (thisServerObj.hasOwnProperty("spawnStatus")){
    if (thisServerObj.spawnStatus == "started"){
      let theResult=await thisServerObj.onlinePlayers().catch((err) => console.error(err));
      // thisConsole.log("This is the results.. " + typeof theResult); // temp
      // thisConsole.dir(theResult); // temp
      if (Array.isArray(theResult)){
        var theResultsArray=[];
        for (let i=0;i<theResult.length;i++){
          theResultsArray.push(theResult[i].toString());
        }
        if (theResultsArray.length > 0){
          thisConsole.log(`There are ${theResultsArray.length} player(s) online currently:`);
          for (let e=0;e<theResultsArray.length;e++){
            thisConsole.log(theResultsArray[e]);
          }
          thisConsole.log(" ");
        } else {
          thisConsole.log("No players were online!");
        }
      } else {
        thisConsole.log("There was an error retreiving the list of online players!  Please try again!");
      }
    } else {
      thisConsole.log("The server is not currently running!  No players can be online!");
    }
  }
  return true;
}
function onlinePlayersHelp(){
  thisConsole.log("This command shows the players that are currently online.");
  thisConsole.log("Usage: !onlinePlayers");
}

async function currentStatus(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    currentStatusHelp();
  } else {
    var theResults=[];
    var firstSet={};
    var spawnStatus;
    if (thisServerObj.hasOwnProperty("spawnStatus")){
      spawnStatus=thisServerObj.spawnStatus;
      firstSet["spawnStatus"]=spawnStatus;
    }
    if (thisServerObj.hasOwnProperty("spawnStatusWanted")){
      firstSet["spawnStatusWanted"]=thisServerObj.spawnStatusWanted;
    }
    if (Object.keys(firstSet).length > 0){
      theResults.push("### SERVER INFO ###")
      theResults.push(firstSet);
    }
    if (spawnStatus == "started"){
      let theResult=await thisServerObj.status().catch((err) => console.error(err));
      if (typeof theResult != "undefined"){
        theResults.push("### SERVER STATUS COMMAND RESULTS ###");
        theResults.push(theResult);
      }
    }
    for (let i=0;i<theResults.length;i++){
      thisConsole.table(theResults[i]);
    }
  }
  return true;
}
function currentStatusHelp(){
  thisConsole.log("This command shows the current status of the server.");
  thisConsole.log("Usage: !status");
}

function start(theProperCommand,theArguments,options){ // Display errors, but do not crash the wrapper.
  if (getOption(options,"help") == true){
    thisConsole.log("This command attempts to start the server.  It will do nothing if the server is already started.");
    thisConsole.log("Usage:  !start");
  } else {
    return thisServerObj.start("",function(err){ 
      if (err){ 
        thisConsole.error(err) 
      } 
    });
  }
  return true;
}
function stop(theProperCommand,theArguments,options){ // Any arguments given to the command should be given as arguments here.
  if (getOption(options,"help") == true){
    thisConsole.log("This command attempts to stop the server.  It will do nothing if the server is already stopped.");
    thisConsole.log("Usage:  !stop (# of seconds) (message)");
    thisConsole.log("Example 1:  !stop 1");
    thisConsole.log("Example 2:  !stop 60 Settings have been updated.");
    thisConsole.log("Note:  If no seconds given, a default wait period of 10 seconds is used.  If no message, a generic message is used.");
  } else {
    // duration, message
    thisConsole.log("input given to stop command: " + theArguments); // temp
    var theMessage=""; // default values
    var theDuration="10";
    if (Array.isArray(theArguments)){
      let tempNum=toNumIfPossible(theArguments[0]);
      if (typeof tempNum == "number"){
        theDuration=tempNum;
      }
      theArguments.shift();
      theMessage=theArguments.join(" "); // Will be blank if nothing provided.
    }
    return thisServerObj.stop(theDuration,theMessage,"",function(err){ thisConsole.error(err) });
  }
  return true;
}
function install(theProperCommand,theArguments,options){
  if (getOption(options,"help") == true){
    thisConsole.log("This command attempts to install the StarMade server.  Nothing will happen if the server is already installed.");
    thisConsole.log("Usage:  !install (-pre/-dev)");
    thisConsole.log("Usage:  !install");
    thisConsole.log("Note:  Normally you shouldn't have to use this command because the wrapper auto-installs the StarMade server if it doesn't exist.");
    thisConsole.log("This command is only useful if you need to perform a reinstall of the starmade server without restarting the wrapper.");
  } else {
    return thisServerObj.install("",function(err){ 
      thisConsole.error(err); // Display errors, but do not crash the wrapper.
    }); 
  }
  return true;
}
