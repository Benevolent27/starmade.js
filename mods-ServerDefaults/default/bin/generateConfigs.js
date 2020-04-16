
// This is a workaround script to generate the needed configs after an install.
// After an install is completed, certain config files needed by the wrapper do not exist yet.
// The workaround was to run StarMade.jar with invalid command line arguments.  eg. java -jar StarMade.jar -nonsense
// Previous to the last update, it would create the config files and then exit with an error,
// but now it is remaining open, so I'm having to get creative here.
// I wrote the install routine purposely in a sychronous way so that nothing happens till
// the server is installed and ready.  But now, since StarMade.jar is staying open, I have to
// run it in an asynchnous way and listen for a line "java.lang.IllegalStateException: Sorry, it doesn't work this way!"
// and then kill the process.  So, rather than changing all the code for the install routine,
// This script will be ran by starmade.js from the command line synchronously, but will
// asychronously read the input from StarMade.js and kill the process when it displays the line.


// "java.lang.IllegalStateException: Sorry, it doesn't work this way!""


const path  = require('path');
// const fs    = require('fs');
const child = require('child_process');
const parametersNeededForAllOS=[]; // none right now, but this could change
const windowsSpecificJavaArguments=["-Xincgc","-Xshare:off"]; // These may need to change in teh future

const theLineToLookFor=/java.lang.IllegalStateException: Sorry, it doesn't work this way!/;
var createConfigFilesSpawn;

if (__filename == require.main.filename){ 
  // Only run the arguments IF this script is being run by itself and NOT as a require.
  
  // Example: node generateConfigs.js "C:\coding\temp1\starmade.js\starmade\StarMade"
  var theArgsArray=process.argv;
  if (typeof theArgsArray[2]=="string"){
    console.log("Generating config files..");
    generateConfigFiles(theArgsArray[2]);
  } else {
    console.log("ERROR: Please provide the path to the StarMade install!");
    process.exit(1);
  }
}

function generateConfigFiles (pathToSMInstall){
  // If StarMAde install files and folders don't exist, we can actually run the StarMade.jar file with an invalid argument and it will generate config files/folders and then exit.
  // IMPORTANT:  This method may not be future-proof!
  try {
    var pathToUse=getSMInstallPath(pathToSMInstall);
  } catch (err) {
    throw new Error("No path to SM install provided!  Cannot generate config files!");  // This is a bit harsh, but hey we will need to ensure the config files are generated.
  }
  var starMadeJarFile=path.join(pathToUse,"StarMade.jar");
  console.log("Path to StarMade.jar: " + starMadeJarFile);
  console.log("Generating config files..");
  var commandLineParametersArray=parametersNeededForAllOS;
  if (process.platform=="win32"){
    commandLineParametersArray=commandLineParametersArray.concat(windowsSpecificJavaArguments);
  }
  // Add the rest of the command line parameters
  commandLineParametersArray=commandLineParametersArray.concat(["-jar",starMadeJarFile,"-nonsense4534"]);
  console.log("commandLineParametersArray:" + commandLineParametersArray);
  createConfigFilesSpawn=child.spawn("java",commandLineParametersArray,{"cwd": v});
  createConfigFilesSpawn.stdout.on('data',processData);
  createConfigFilesSpawn.stderr.on('data',processData);
  createConfigFilesSpawn.on('exit',finish);
  // on exit with an error, exit this process with an error
  createConfigFilesSpawn.on('error', function (err){
    if (err){
      console.error('Failed to start StarMade.jar to create the configs!');
      process.exit(1); // Exit with an error code so starmade.js knows it failed to create the configs
    }
  });
}
function finish(){ // This is redundant
  console.log("Configs should have been created successfully!");
  process.exit();
}

function processData(theText){
  console.log(String(theText));
  // When the text displays, kill the process.
  if (theLineToLookFor.test(theText)){
    console.log("Found end text!  Killing process!");
    createConfigFilesSpawn.kill('SIGINT'); // SIGTERM would probably be fine, but some programs seem to treat them differently, so let's simulate a user shutdown instead of a TERM
    return finish();
  }
  return false;
}

function getSMInstallPath(thePath){
  // This function simply tacks on StarMade to a path if not provided at the end of the path.
  // This was created because there can be confusion about what folder is the StarMade install folder.
  // For example, if StarMade is installed to /path/to/install/, it creates a folder at /path/to/install/StarMade/.  Which would you consider to be the "install folder"?
  // This script ensures we have the path StarMade.jar and other install files should be in, covering any instance where the starmade install folder is NOT equal to "StarMade".  // TODO: Make it so the installer process is intelligent and will not install UNDER a "StarMade" folder but rather TO it, so that this function behaves as intended in every scenario.
  if (!thePath) {
    throw new Error("No path provided!"); // It is expected that anywhere this function is used, the error will be handled and a custom error given instead.
  }
  var pathToUse=thePath;
  if (!thePath.match(/StarMade$/)){
    pathToUse=path.join(thePath, "StarMade");
  }
  return pathToUse;
}
