module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  requireBin,
  isPidAlive,
  smartSpawnSync // This allows executing a jar file or .exe file with the same spawn command, specifying arguments to use and ignoring any java arguments provided if it's not a jar file.
};

const path=require('path');
const http=require('http');
const binFolder=path.resolve(__dirname,"../bin/");
// const objectCreator=require(path.join(binFolder,"objectCreator.js"));

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
