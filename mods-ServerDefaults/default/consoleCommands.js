// Updated to use installObj
var installObj=global.getInstallObj(__dirname);
var {event,settings,log}=installObj; // TODO: Add console back once it's working.
const thisConsole=installObj.console;
var {toNumIfPossible,toStringIfPossible}=global.objectHelper;
var {i} = global.miscHelpers;
var thisServerObj={};



event.on('start',function(theServerObj){
  thisServerObj=theServerObj;
  // #####  SERVER CONTROL  #####
  thisConsole.regCommand("Start",start,"Server Controls");
  thisConsole.regCommand("Stop",stop,"Server Controls");
  thisConsole.regCommand("Install",install,"Server Controls");
  thisConsole.regCommand("AutoRestart",autoRestart,"Server Controls");
  // #####  SERVER INFO  #####
  thisConsole.regCommand("Status",currentStatus,"Server Info");
  thisConsole.regCommand("Players",onlinePlayers,"Server Info");
  // #####  SERVER TEXT TO DISPLAY  #####
  thisConsole.regCommand("ShowAllEvents",showAllEvents,"Server Text Display");
  thisConsole.regCommand("Stdout",stdout,"Server Text Display");
  thisConsole.regCommand("Stderr",stderr,"Server Text Display");
  thisConsole.regCommand("StderrFilter",stderrFilter,"Server Text Display");

  
});

function showAllEvents(theArguments){
  if (i(theArguments[0],"on")){
    thisConsole.log("Setting showAllEvents to true!");
    thisServerObj.settings["showAllEvents"]=true;
  } else if (i(theArguments[0],"off")){
    thisConsole.log("Setting showAllEvents to false!");
    thisServerObj.settings["showAllEvents"]=false;
  } else {
    thisConsole.log("Invalid parameter.  Usage:  !ShowAllEvents on/off")
  }
}
function autoRestart(theArguments){
  if (i(theArguments[0],"on")){
    thisConsole.log("Setting autoRestart to true!");
    thisServerObj.settings["autoRestart"]=true;
  } else if (i(theArguments[0],"off")){
    thisConsole.log("Setting autoRestart to false!");
    thisServerObj.settings["autoRestart"]=false;
  } else {
    thisConsole.log("Invalid parameter.  Usage:  !AutoRestart on/off")
  }
}
function stdout(theArguments){
  if (i(theArguments[0],"on")){
    thisConsole.log("Setting showStdout to true!");
    thisServerObj.settings["showStdout"]=true;
  } else if (i(theArguments[0],"off")){
    thisConsole.log("Setting showStdout to false!");
    thisServerObj.settings["showStdout"]=false;
  } else {
    thisConsole.log("Invalid parameter.  Usage:  !stdout on/off")
  }
}
function stderr(theArguments){
  if (i(theArguments[0],"on")){
    thisConsole.log("Setting showStderr to true!");
    thisServerObj.settings["showStderr"]=true;
  } else if (i(theArguments[0],"off")){
    thisConsole.log("Setting showStderr to false!");
    thisServerObj.settings["showStderr"]=false;
  } else {
    thisConsole.log("Invalid parameter.  Usage:  !stderr on/off")
  }
}
function stderrFilter(theArguments){
  if (theArguments.length > 0){
    thisServerObj.settings["showStderr"]=new RegExp(theArguments[0]);
  } else {
    thisConsole.log("Invalid parameter.  Usage:  !stderrfilter [Filter]")
    thisConsole.log("Example: !stderrfilter ^\\[SPAWN\\]");
  }
}

async function onlinePlayers(){
  if (thisServerObj.hasOwnProperty("spawnStatus")){
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
  // This should never happen.
}


async function currentStatus(){
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

function start(){ // Display errors, but do not crash the wrapper.
  return thisServerObj.start("",function(err){ 
    if (err){ 
      thisConsole.error(err) 
    } 
  });
}
function stop(input){ // Any arguments given to the command should be given as arguments here.
  // duration, message
  thisConsole.log("input given to stop command: " + input); // temp
  var theMessage=""; // default values
  var theDuration="10";
  if (Array.isArray(input)){
    let tempNum=toNumIfPossible(input[0]);
    if (typeof tempNum == "number"){
      theDuration=tempNum;
    }
    input.shift();
    theMessage=input.join(" "); // Will be blank if nothing provided.
  }
  return thisServerObj.stop(theDuration,theMessage,"",function(err){ thisConsole.error(err) });
}
function install(){
  return thisServerObj.install("",function(err){ 
    thisConsole.error(err); // Display errors, but do not crash the wrapper.
  }); 
}
