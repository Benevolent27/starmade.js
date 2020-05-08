// This script can be ran independently from the wrapper.  
// It can also be used as a require for other scripts, but won't have as much functionality as a mod using it would have. (no sendDirectToServer function nor {fast:true} options for sending commands)

module.exports={ 
  getPlayerVotes,
  getPlayerVotesObj
};

if (__filename == require.main.filename){
  console.log("ERROR:  This script cannot be ran from the command line!  Exiting!");
  process.exit();
}

const path=require('path');
const fs=require('fs');
const {miscHelpers}=global;
const {downloadJSON}=miscHelpers;
const {objectHelper}=global;
const {simplePromisifyIt}=objectHelper;
var installObj=global.getInstallObj(__dirname);
var {event,console:thisConsole,log}=installObj;

var notConfiguredAPIKey="replace_this_with_your_api_key";
var votesConfigName="votesConfig";
var config=installObj.getJSON(__dirname,votesConfigName);
var configPath=installObj.getJSONPath(__dirname,votesConfigName);
if (!config.hasOwnProperty("apiKey")){
  console.log("The 'votes' plugin for starmade-servers.com has not been configured yet!");
  console.log("Please enter your Server API Key or press enter to skip.");
  console.log("NOTE:  If you skip, the wrapper will show all players as always having NOT voted to any mods that require voting.");
  config.apiKey=global["prompt"]("Please enter your API key: ");
  if (config.apiKey){
    console.log("Your API key has been set!  If you need to change it in the future, you can edit the config file.");
    console.log("The config file is located here: " + configPath);
  } else {
    console.log("Skipping Vote Check setup for starmade-servers.com!");
    console.log("To set this up later, you can edit the config json and add your API key.");
    console.log("This file is located here: " + configPath);
    config.apiKey=notConfiguredAPIKey;
  }
  global["prompt"]("Press [ENTER] to continue..");
  installObj.writeJSON(__dirname,votesConfigName);
}
var serverObj={};
event.on("start",function(theServerObj){ // the start event indicates that a serverObj has been created.
  serverObj=theServerObj;
  serverObj.getVotes=getPlayerVotes;
  serverObj.getVotesObj=getPlayerVotesObj;
});
function getPlayerVotesObj(options,cb){
  if (typeof cb == "function"){
    if (config.apiKey === notConfiguredAPIKey){
      thisConsole.log("Player votes attempted, but not set up.  Returning empty object!");
      return cb(null,{});
    } else {
      thisConsole.log("Getting votes for the server..");
      let URL=`http://starmade-servers.com/api/?object=servers&element=votes&key=${config.apiKey}&format=json`;
      return downloadJSON(URL,"",function(err,result){
        if (err){
          return cb(err,null);
        }
        if (typeof result == "object"){
          return cb(null,result);
        } else {
          return cb(new Error("Could not retrieve vote info from starmade-servers.com!  Is the API key set up correctly?"),null);
        }
      });
    }
  } else {
    return simplePromisifyIt(getPlayerVotes,options);
  }
  // Example return:
  // {
  //   "name":"Light Vs Dark",
  //   "address":"LightVsDark.net",
  //   "port":"5252",
  //   "month":"202005",
  //   "votes": [
  //         {
  //     "date":"May 7th, 2020 05:48 PM EST",
  //     "timestamp":1588870136,
  //     "nickname":"DestroyerOfWorlds",
  //     "steamid":"",
  //     "claimed":"0"
  //     }  ]
  // }
}
function getPlayerVotes(options,cb){
  if (typeof cb == "function"){
    if (config.apiKey === notConfiguredAPIKey){
      thisConsole.log("Player votes attempted, but not set up.  Returning empty array!");
      return cb(null,[]);
    } else {
      thisConsole.log("Getting votes for the server..");
      return getPlayerVotesObj("",function(err,votesObj){
        if (err){
          return cb(err,null);
        }
        if (typeof votesObj == "object"){
          if (votesObj.hasOwnProperty("votes")){
            var returnArray=[];
            let votesArray=votesObj.votes;
            for (let i=0;i<votesArray.length;i++){
              if (votesArray[i].hasOwnProperty("nickname")){
                if (votesArray[i].nickname != ""){
                  returnArray.push(votesArray[i].nickname);
                }
              }
            }
            return cb(null,returnArray);
          } else {
            return cb(null,[]); // Not set up, so return empty results
          }

        } else {
          return cb(new Error("Could not retrieve vote info from starmade-servers.com!  Is the API key set up correctly?"),null);
        }
      });
    }
  } else {
    return simplePromisifyIt(getPlayerVotes,options);
  }
  // Example return:
  // [ "Benevolent27" , "AnotherPlayer" ]
}
