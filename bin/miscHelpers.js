module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  requireBin,
  isPidAlive,
  smartSpawnSync, // This allows executing a jar file or .exe file with the same spawn command, specifying arguments to use and ignoring any java arguments provided if it's not a jar file.
  ensureFolderExists,
  waitAndThenKill
};

const path              = require('path');
const http              = require('http');
const fs                = require('fs');
const binFolder         = path.resolve(__dirname,"../bin/");
// const objectCreator=require(path.join(binFolder,"objectCreator.js"));
const installAndRequire = requireBin("installAndRequire");
const makeDir           = installAndRequire('make-dir'); // https://www.npmjs.com/package/make-dir This allows creating folders recursively if they do not exist, with either async or sync functionality.
const sleep             = requireBin("mySleep.js").softSleep;

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
}
