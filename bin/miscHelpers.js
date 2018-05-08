module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  requireBin,
  isPidAlive
};

const path=require('path');
const http=require('http');
const binFolder=path.resolve(__dirname,"../bin/");
// const objectCreator=require(path.join(binFolder,"objectCreator.js"));


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
