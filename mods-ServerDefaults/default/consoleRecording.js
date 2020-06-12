// This mod creates a wrapper command, "!record"
// This allows the admin to record excerpts from the console output.
// The files are placed within the install directory for starmade.
// Example:  c:\starmade.js\starmade\recording1.log

if (__filename == require.main.filename){
  console.log("ERROR:  This script cannot be ran from the command line!  Exiting!");
  process.exit();
}

const path=require('path');
const fs=require('fs');
const miscHelpers=require("./helpers/miscHelpers.js");
const objectHelper=require("./helpers/objectHelper.js");
const {simplePromisifyIt}=objectHelper;
const installObj=global.getInstallObj(__dirname);
const {event,console:thisConsole,log}=installObj;
const {i}=miscHelpers;

var serverObj;

var recording = false;
var recordingArray = [];
var recordFileName = "record";
var recordingCounter = 1;
var recordingFile = getRecordFileName();
function getRecordFileName() {
  if (miscHelpers.isSeen(recordingFile)) {
    recordingCounter++;
    recordingFile = path.join(installObj.path, recordFileName + recordingCounter + ".log");
    return getRecordFileName();
  } else {
    return path.join(installObj.path, recordFileName + recordingCounter + ".log");
  }
}
function dumpToRecordFile(options, cb) {
  if (typeof cb == "function") {
    var stringToWrite = recordingArray.join("\n");
    recordingArray = [];
    return fs.writeFile(getRecordFileName(), stringToWrite, cb);
  }
  return simplePromisifyIt(dumpToRecordFile, options);
}

// Register console command
event.on('start',function(theServerObj){
  serverObj=theServerObj;
  thisConsole.regCommand("Record","Server Info",record);
});
event.on('init',function(){
  thisConsole.regCommand("Record","Server Info",record);
});
event.on("unloadMods",function(){
    stopRecording();
});

function record (theProperCommand,theArguments,options){
  if (i(theArguments[0],"start") || typeof theArguments[0] == "undefined"){
    if (recording){
      return thisConsole.log("Recording has already been activated.  If you wish to stop recording and save the results, type: !record stop");
    } else {
      if (serverObj.hasOwnProperty("spawn")){
        if (typeof serverObj.spawn == "object"){
          thisConsole.log(`Beginning recording to file, '${getRecordFileName()}'.  To stop recording type: !record stop`); // This sets the record file
          recording=true;
          // Attach the listeners
          serverObj.spawn.stdout.on('data',recordLineSTDOut);
          serverObj.spawn.stderr.on('data',recordLineSTDErr);
          return true;
        }
      }
      return thisConsole.log("Cannot start recording.  No server spawn existed!  Please start the server before attempting to read the console output!");
    }
  } else if (i(theArguments[0], "stop")) {
    if (recording) {
      return stopRecording();
    } else {
      return thisConsole.log("No recording is happening!  To start recording server output, please type:  !record");
    }
  } else if (i(theArguments[0], "help")){
    thisConsole.log("This command is used to create a 'recording' of the console output.");
    thisConsole.log("This command supports the following usage:");
    thisConsole.log("- !record (start)");
    thisConsole.log("- !record stop");
    thisConsole.log(" ");
    return thisConsole.log(" Note:  When starting a recording, the word 'start' is optional.");
  } else {
    return thisConsole.log("Invalid argument given to !record command.")
  }
}

function stopRecording(){
  if (recording){
    thisConsole.log("Stopping and saving recording..");
    serverObj.spawn.stdout.removeListener('data',recordLineSTDOut);
    serverObj.spawn.stderr.removeListener('data',recordLineSTDErr);
    return dumpToRecordFile("", function (err) {
      if (err) {
        thisConsole.log("Error writing recording to file: " + recordingFile);
        log("Error writing recording to file: " + recordingFile);
        return thisConsole.dir(err);
      }
      recording = false;
      recordingArray=[];
      thisConsole.log("SUCCESS:  Finished writing to record file: " + recordingFile);
      return true;
    });
  }
  return false;
}

function recordLineSTDErr(data){
  // We have to do some pre-processing because the lines can come in chunks rather than 1 line at a time.
  let dataString = data.toString().trim(); // Clear out any blank lines
  if (dataString != "") {
    // Data chunks can have multiple lines, so let's split them up to process each line.
    let dataArray = dataString.replace("\r", "").split("\n"); // simplify to only new line characters and split to individual lines.
    for (let i = 0;i<dataArray.length;i++) {
      if (dataArray[i]) {
        recordingArray.push("STDERR: " + dataArray[i]);    
      }
    }
  }
}
function recordLineSTDOut(data){
  let dataString = data.toString().trim(); // Clear out any blank lines
  if (dataString != "") {
    // Data chunks can have multiple lines, so let's split them up to process each line.
    let dataArray = dataString.replace("\r", "").split("\n"); // simplify to only new line characters and split to individual lines.
    for (let i = 0;i<dataArray.length;i++) {
      if (dataArray[i]) {
        recordingArray.push("STDOUT: " + dataArray[i]);
      }
    }
  }
}



