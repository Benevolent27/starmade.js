module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  log, // This should only ever be used from the global object or from starmade.js directly, so we don't open multiple write streams to the log file.
  requireBin,
  isPidAlive,
  smartSpawnSync, // This allows executing a jar file or .exe file with the same spawn command, specifying arguments to use and ignoring any java arguments provided if it's not a jar file.
  ensureFolderExists,
  waitAndThenKill,
  deleteFile,
  touch,
  isDirectory,
  getDirectories,
  isFile, // Will throw an error if it does not exist.
  getFiles,
  isSeen,
  existsAndIsFile, // Returns false if the path exists but is not a file, ie. it is a directory.
  isFileInFolderCaseInsensitive, // Only performs an insensitive search on the file, not directory path.
  areCoordsBetween // TODO: Test to ensure this works correctly
};


const path              = require('path');
const http              = require('http');
const fs                = require('fs');
var mainFolder          = path.dirname(require.main.filename); // This is where the starmade.js is.  I use this method instead of __filename because starmade.js might load itself or be started from another script
const binFolder         = path.resolve(__dirname,"../bin/");
const logFolder         = path.resolve(mainFolder,"logs/");
// const objectCreator=require(path.join(binFolder,"objectCreator.js"));
const installAndRequire = requireBin("installAndRequire");
const makeDir           = installAndRequire('make-dir'); // https://www.npmjs.com/package/make-dir This allows creating folders recursively if they do not exist, with either async or sync functionality.
const sleep             = requireBin("mySleep.js").softSleep;
const objectHelper      = requireBin("objectHelper.js");
ensureFolderExists(logFolder); // Let's just do this once the helper being loaded.

// Set up aliases
const {getOption,trueOrFalse}       = objectHelper;

// TESTING BEGIN
if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.
  var testSuit={ // This is used to match a command line argument to an element to then run a specific test function
    isPidAlive:isPidAliveTest
  }
  var clArgs=process.argv.slice(2);

  if (testSuit.hasOwnProperty(clArgs[0])){
    console.log("Running test suit: " + clArgs[0]);
    testSuit[clArgs[0]](clArgs[1]);
  } else {
    if (clArgs[0]){ console.log("Test suit does not exist: " + clArgs[0]) }
    console.log("Available tests:");
    for (let key in testSuit){
      if (testSuit.hasOwnProperty(key)){
        console.log("- " + key);
      }
    }
    console.log("\nTo run an individual test, include it as the first argument.");
    console.log("Example:  node miscHelpers.js downloadToString");
  }
}
function isPidAliveTest(){
  console.log("Is this process alive? " + isPidAlive(process.pid));
}
// TESTING END

// The FUNCTIONS

function areCoordsBetween(compare,first,second){ // Takes CoordsObj as input for all values
  // example areCoordsBetween(new CoordsObj(1,1,1),new CoordsObj(0,0,0),new CoordsObj(2,2,2));  // Returns true
  var cX=compare.x;
  var cY=compare.y;
  var cZ=compare.z;

  var sX=Math.min(first.x,second.x);
  var sY=Math.min(first.y,second.y);
  var sZ=Math.min(first.z,second.z);

  var bX=Math.max(first.x,second.x);
  var bY=Math.max(first.y,second.y);
  var bZ=Math.max(first.z,second.z);
  return cX >= sX && cX <= bX && cY >= sY && cY <= bY && cZ >= sZ && cZ <= bZ;
}

function existsAndIsFile(pathToFile){ // This returns false if the path is to a directory
  if (isSeen(pathToFile)){
    if (isFile(pathToFile)){
      return true;
    }
  }
  return false;
}

function isSeen(thePath){ // This checks to see if a file/folder/symlink/whatever can simply be seen.
  try {
    fs.accessSync(thePath,fs.constants.F_OK);
    return true;
  } catch (error){
    return false;
  }
}

function ensureFolderExists (folderPath){ // Returns true if the folder exists or if it can be created and then exists, otherwise throws an error.
  let resolvedFolderPath=path.resolve(folderPath); // Using resolve to ensure the path is specified in the right way for the OS.  Resolve tack on the current working directory to make it a full path if needed, which may NOT be the same as the folder starmade.js is in because this is meant to be a general purpose function and not necessarily tied to the starmade.js script.
  try {
    fs.accessSync(resolvedFolderPath,fs.constants.F_OK);  //  Check if the path can be seen.
      if (fs.statSync(resolvedFolderPath).isFile()) { // Check if it is a file
        let theError = new Error("Cannot create folder!  File already exists at this path!  Please delete or move: '" + resolvedFolderPath);
        throw theError;
      } else if (fs.statSync(resolvedFolderPath).isFIFO()) {
        let theError = new Error("Cannot create folder!  Named Pipe already exists at this path!  Please delete or move: '" + resolvedFolderPath);
        throw theError;
      } else { return true; } // it might be a symlink, but I don't know how to check if it's symlinked to a file or folder, so let's just assume it is fine.
  } catch (err) {
    console.log("Folder not found, creating: " + folderPath);
    try {
      makeDir.sync(folderPath); // This will create the folder and any inbetween needed, but requires the make-dir module.
      return true;
    } catch (error) {
      console.error("ERROR: Unable to create folder: " + folderPath);
      throw error; // Forward the error given by makeDir and throw it.
    }
  }
}

function smartSpawnSync(executible,argumentsArray,optionsObject,javaArgumentsArray){
  // This script will run a .jar file with java, and anything else directly

  // "executible" should be the full path to an executible file that can be ran.  This function does NOT ensure it exists or not, it just tries to run it.
  // "argumentsArray" must be an array of values that will be given to the executible as arguments
  // "optionsObject" is given to child.spawnSync as options, such as {cwd:"/whatever"}.
  // "javaOptions" are only used if it's a jar file.  These are inserted BEFORE the -jar argument, to provide arguments to the java runtime rather than to a jar file being ran
  var argumentsToUse=[];
  var optionsToUse={};
  if (typeof optionsObject == "object"){ // I don't really have a way of testing to ensure the RIGHT type of object is provided, so this will have to do for now.
    optionsToUse=optionsObject;
  } else if (optionsObject){
    throw new Error("Invalid values given as optionsObject for smartSpawnSync function!");
  }
  if (argumentsArray){ // We need to ensure a value was actually provided first, otherwise pulling the constructor name would throw an error
    if (argumentsArray.constructor.name == "Array"){
      argumentsToUse=argumentsArray;
    } else {
      throw new Error("ERROR: Non-Array value given as argumentsArray for smartSpawnSync function: " + argumentsArray);
    }
  }
  if ((/[.]jar$/i).test(executible)){ // Run with java
    argumentsToUse=["-jar",executible].concat(argumentsToUse);
    if (javaArgumentsArray){
      if (javaArgumentsArray.constructor.name == "Array"){
        argumentsToUse=javaArgumentsArray.concat(argumentsToUse); // If java arguments array given, insert BEFORE the -jar arguments
      } else {
        throw new Error("Non array value given as argumentsArray for smartSpawnSync function: " + javaArgumentsArray);
      }
    }
    return require('child_process').spawnSync("java",argumentsToUse,optionsToUse);
  } else { // Run directly.  Ignore any javaArgumentsArray values given.
    return require('child_process').spawnSync(executible,argumentsToUse,optionsToUse);
  }
}

function requireBin(scriptFile){
  return require(path.join(binFolder,scriptFile));
}

function isPidAlive(thePID){
  try {
    process.kill(thePID,0);
    return true;
  } catch (err) {
    return false;
  }
}

function waitAndThenKill(mSeconds,thePID,options){ // options are optional.  This can be used on any PID as a sync function
  // By default this will send a SIGKILL signal to the PID if it has not ended within the specified timeout
  // options example:
  // {
  //    interval:'2',
  //    sigType:'SIGTERM'
  // }
  var mSecondsCount=0;
  var intervalVar=1000;
  var sigType="SIGKILL";
  if (mSeconds && thePID){
    if (options){
      if (options.hasOwnProperty("interval")){
        intervalVar=options["interval"];
      }
      if (options.hasOwnProperty("sigType")){
        sigType=options["sigType"];
      }
    }
    if (isPidAlive(thePID)){
      process.stdout.write("\nWaiting for process to die.");
      while (isPidAlive(thePID) && mSecondsCount < mSeconds){
        sleep(intervalVar);
        process.stdout.write(".");
        mSecondsCount+=intervalVar;
      }
      process.stdout.write("\n");
      if (isPidAlive(thePID)){
        console.log("PID (" + thePID + ") still alive after waiting " + mSecondsCount + " milliseconds!  Killing it with: " + sigType);
        process.kill(thePID,sigType);
      } else if (mSecondsCount>0){
          console.log("PID (" + thePID + ") died of natural causes after " + mSecondsCount + " milliseconds.  No need to send a " + sigType + " signal to it.  Phew!");
      } else {
        console.log("PID (" + thePID + ") died of natural causes.  No need to send a " + sigType + " signal to it.  Phew!");
      }
    } else {
      console.log("Process already died on it's own!  GREAT!  :D");
    }
  } else {
    throw new Error("Insufficient parameters given to waitAndThenSigKill function!");
  }
  return true; // if we made it this far the process should be killed.
}

// #########################################
// ######### File System Functions #########
// #########################################

function isDirectory(source) { 
  return fs.lstatSync(source).isDirectory(); 
};
function getDirectories(source) {
  return fs.readdirSync(source).map((name) => path.join(source, name)).filter(isDirectory);
};
function isFile(source) { 
  return fs.lstatSync(source).isFile(); 
};
function getFiles(source) {
  return fs.readdirSync(source).map((name) => path.join(source, name)).filter(isFile);
};

function isFileInFolderCaseInsensitive(filePath){ // This does a case insensitive match search for a file.  The path still needs to be 100% right.
  //  This should probably not be used in linux unless StarMade doesn't mind it.
  var filePathToUse=path.resolve(filePath);
  var sourceDir=path.dirname(filePathToUse);
  var baseFile=path.basename(filePath);
  var baseFileTest;
  var theReg;
  if (isSeen(sourceDir)){
    if (isDirectory(sourceDir)){
      var theFiles=getFiles(sourceDir);
      for (let i=0;i<theFiles.length;i++){
        baseFileTest=path.basename(theFiles[i]);
        theReg=new RegExp('^' + baseFileTest + '$',"i");
        if (theReg.test(baseFile)){
          return true;
        }
      }
    }
  }
  return false;
}

function deleteFile (fileToDelete,options){ // options can be:  {"quiet":true/false}  This will still display an error if the file exists but cannot be deleted for some reason.
  // Resolves files to use main script path as root if given relative path.
  // Also throws an error if it cannot delete the file.
  var quiet=trueOrFalse(getOption(options,"quiet",false));
  let resolvedFile = path.resolve(mainFolder,fileToDelete); // This will resolve relative paths back to the main script's root dir as the base
  if (fs.existsSync(resolvedFile)){
    try {
      fs.unlinkSync(resolvedFile);
      if (quiet != true){
        console.log("Deleting: " + fileToDelete);
      }
    } catch (err) {
      console.error("ERROR: Could not delete file: " + resolvedFile);
      console.error("Please manually remove this file and ENSURE you have access to delete files at this location!")
      throw err;
    }
  } else if (quiet != true){
      console.error("ERROR: Cannot delete file.  File not found: " + resolvedFile);
  }
}

function touch (file){ // This creates an empty file quickly.
  fs.closeSync(fs.openSync(file, 'w'));
}

function getSimpleDate(input){
  let theDate;
  if (input){
    theDate=input;
  } else {
    theDate=new Date();
  }
  let theMonth=theDate.getMonth() + 1;
  let output=theMonth + "-" + theDate.getDate() + "-" + theDate.getFullYear();
  return output;
}
function getSimpleTime(input){
  let theDate;
  if (input){
    theDate=input;
  } else {
    theDate=new Date();
  }  
  let hours=theDate.getHours();
  let amPM="AM";
  if (hours>11 && hours!=24){
    amPM="PM";
  }
  if (hours>11 && hours!=24){
    hours-=12;
  } else if (hours==24){
    hours=12;
  }
  let output=hours + ":" + theDate.getMinutes() + " " + amPM;
  return output;
}
var logFileName=getSimpleDate() + ".log";
var logFilePath=path.join(logFolder,logFileName);
var logStream=fs.createWriteStream(logFilePath, {flags:'a'}); // We create a stream here so the handle will not be opened a million times.  This will automatically close when the program ends, and does not need to be ended.

function log (logMsg){ // Writes to a log file with the current date into the /log subfolder
  // ensureFolderExists(logFolder);  // This shouldn't be necessary since the folder is created if it doesn't exist at the beginning of this script
  if (typeof logMsg=="string"){
    let lineWrite=getSimpleTime() + " - " + logMsg;
    // First check to ensure the correct date will be used.
    let logFileNameTemp=getSimpleDate() + ".log";
    if (logFileNameTemp != logFileName){ // The date must have changed
      logFileName=logFileNameTemp; // Set up the filenames correctly, end the old log stream, and create a new one.
      logFilePath=path.join(logFolder,logFileName);
      logStream.end();
      logStream=fs.createWriteStream(logFilePath, {"flags":'a'});
    }
    // touch(logFilePath);
    logStream.write(lineWrite + "\n");
  } else {
    console.error("ERROR:  Invalid input given to log function!  Expects a string!");
  }

}
