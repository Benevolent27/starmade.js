// Updated to use installObj
var installObj=global.getInstallObj(__dirname);
var {event,settings,log}=installObj; // TODO: Add console back once it's working.
const thisConsole=installObj.console;
var {toNumIfPossible,toStringIfPossible}=global.objectHelper;
var thisServerObj={};
event.on('start',function(theServerObj){
  thisServerObj=theServerObj;
  // #####  SERVER CONTROL  #####
  thisConsole.regCommand("Start",start,"Server Controls");
  thisConsole.regCommand("Stop",stop,"Server Controls");
  thisConsole.regCommand("Install",install,"Server Controls");
  thisConsole.regCommand("Status",currentStatus,"Server Controls");
// #####  SERVER INFO  #####
  thisConsole.regCommand("Players",onlinePlayers,"Server Info");
});

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
