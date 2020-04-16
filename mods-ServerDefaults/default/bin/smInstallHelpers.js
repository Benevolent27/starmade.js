
// This script should handle all installing, updating, etc. for StarMade installs themselves.
module.exports={
  spawnStarMadeInstallTo,
  verifyInstall,
  generateConfigFiles,
  getSMInstallPath,
  isInstalled
}

const path  = require('path');
const fs    = require('fs');
const child = require('child_process');

const miscHelpers = global["miscHelpers"]
const {smartSpawn}=miscHelpers;
const objectHelper = global["objectHelper"];
const {simplePromisifyIt,getOption}=objectHelper;

// Setup for how to run the StarMade.jar file
const parametersNeededForAllOS=[]; // none right now, but this could change
const windowsSpecificJavaArguments=["-Xincgc","-Xshare:off"]; // These may need to change in teh future
// Don't touch below
var argumentsNeededForStarMadeJar=parametersNeededForAllOS;
if (process.platform=="win32"){ // If running on windows, include the windows Specific arguments, otherwise leave it as is.
  argumentsNeededForStarMadeJar=argumentsNeededForStarMadeJar.concat(windowsSpecificJavaArguments);
}
// This is for creating config files.  Right now this is a temporary workaround method.  Run StarMade.jar with invalid parameters. This generates the needed configs, displays an error code, and stays loaded, so we have to kill it.
const theLineToLookFor=/java.lang.IllegalStateException: Sorry, it doesn't work this way!/;
var createConfigFilesSpawn;

function showData(input){
  console.log(String(input));
}
function spawnStarMadeInstallTo(pathToInstall,installerExec,options,cb){  // This always requires the installerJar path because this will be offloaded to a require later.
  // This needs to be able to use a Jar file or .exe file, depending on the OS.
  // Returns true if an install was completed successfully, an error if there was a problem, and false if no install was needed
  // TODO:  We need to add pre/dev options here.
  if (typeof cb == "function"){
    var branch=getOption(options,"branch","normal"); // accepts pre or dev
    branch=branch.toLowerCase();
    try {
      var starMadeInstallFolder=getSMInstallPath(pathToInstall);
    } catch (err) {
      return cb(new Error("No path to SM install provided!  Cannot spawn server install!"),false);  // This is a bit harsh, but hey we will need to ensure the config files are generated.
    }
    // var starMadeJarFile=path.join(starMadeInstallFolder,"StarMade.jar"); // TODO: Remove this line
    return isInstalled(starMadeInstallFolder,options,function(err,result){
      if (err){
        return cb(err,false);
      }
      if (result == true){
        console.log("No need to install! Found StarMade install at: " + starMadeInstallFolder);
        return cb(null,false); // False here means an install was not performed, because there was no need to do the install
      } else {
        console.log("Spawning StarMade Install to: " + starMadeInstallFolder);
        console.debug("Using Spawner Jar: " + installerExec);
        console.debug("Using CWD: " + pathToInstall);
        // This needs to use java for .jar files and just run any .exe
        var installerArguments=["-nogui"];
        if (branch != "normal"){
          installerArguments.push("-" + branch); // will look like -pre or -dev
        }
        var smInstallerProcess=smartSpawn(installerExec,installerArguments,"",{"cwd": pathToInstall}); // Returns a child.spawn object. Arguments represent: installer, arguments given to installer, arguments given to java (if it is a jar file), options given to spawn
        // Display the install process
        smInstallerProcess.stdout.on('data', showData);
        smInstallerProcess.stderr.on('data', showData);
        var installFailed;
        smInstallerProcess.on('error',function(err){
          console.log("Install failed!");
          installFailed=true;
          return cb(err,false);
        });
        smInstallerProcess.on('exit',function(){
          if (!installFailed){ // must be undefined.  This is to avoid duplicating cb return
            console.log("Spawned StarMade install successfully to: " + starMadeInstallFolder);
            // Now let's generate the configs.
            return generateConfigFiles(starMadeInstallFolder,options,function(err,result){
              if (err){
                return cb(err,false);
              }
              if (result == true){
                return cb(null,true); // Install fully successful
              } else {
                return cb(null,false); // generateConfigFiles should never give a false value without an error, but this is here to be redundant for possible future changes
              }
            });
          }
          return false; // Do nothing because the cb should have already been returned by the error handler
        });
        return true; // This is to make ESLINT happy
      }
    });
  }
  return simplePromisifyIt(spawnStarMadeInstallTo,options,pathToInstall,installerExec);
}

var generateConfigsProcessKilled; // Used to ensure there are not duplicate callbacks returned
function generateConfigFiles (pathToSMInstall,options,cb){
  // If StarMAde install files and folders don't exist, we can actually run the StarMade.jar file with an invalid argument and it will generate config files/folders and then exit.
  // IMPORTANT:  This method may not be future-proof!
  if (typeof cb == "function"){
    try {
      var pathToUse=getSMInstallPath(pathToSMInstall);
    } catch (err) {
      return cb(new Error("No path to SM install provided!  Cannot generate config files!"),false);  // This is a bit harsh, but hey we will need to ensure the config files are generated.
    }
    var starMadeJarFile=path.join(pathToUse,"StarMade.jar");
    // console.log("Path to StarMade.jar: " + starMadeJarFile);
    console.log("Generating config files..");

    var tempArgumentsArray=argumentsNeededForStarMadeJar.concat(["-jar",starMadeJarFile,"-nonsense4534"]);
    console.log("commandLineParametersArray:" + tempArgumentsArray);
    var createConfigFilesSpawn=child.spawn("java",tempArgumentsArray,{"cwd": pathToUse});
    createConfigFilesSpawn.stdout.on('data',processData); // These next few lines will kill the process if the error message is found
    createConfigFilesSpawn.stderr.on('data',processData);
    createConfigFilesSpawn.on('exit',function(){
      // This sparks on any exit.
      if (typeof generateConfigsProcessKilled == "undefined" || generateConfigsProcessKilled === true){ 
        // The process died on it's own OR was killed by our helper function.  Let's assume it was successful.
        console.log("Configs created!");
        return cb(null,true);
      }
      return false;
      // if generateConfigsProcessKilled == false, then  an error happened, so we should not duplicate returning the callback.
    });
    // on exit with an error, exit this process with an error
    createConfigFilesSpawn.on('error', function (err){
      console.error(`Failed to start StarMade.jar to create the configs for install: ${pathToUse}`);
      generateConfigsProcessKilled=false;
      return cb(err,false);
    });
  }
  return simplePromisifyIt(generateConfigFiles,options,pathToSMInstall);
}
function processData(theText){
  // Helper function for generateConfigFiles function
  var theTextToLookAt=String(theText);
  console.log(theTextToLookAt); // temp
  // When the text displays, kill the process.
  if (theLineToLookFor.test(theTextToLookAt)){
    console.log("Found end text!  Killing process!");
    createConfigFilesSpawn.kill('SIGINT'); // SIGTERM would probably be fine, but some programs seem to treat them differently, so let's simulate a user shutdown instead of a TERM
    generateConfigsProcessKilled=true;
    return true;
  }
  return false;
}
function isInstalled(pathToSMInstall,options,cb){
  // I am writing this in an asynchronous way to leave my options open for verification, in case the verification process is expanded on later.
  // This only checks for the StarMade.jar file.  It does not check for configs
  if (typeof cb=="function"){
    try {
      var pathToUse=getSMInstallPath(pathToSMInstall); // adds "/StarMade" if not already in the path
    } catch (err) {
      return cb(new Error("No path to SM install provided!  Cannot verify install!"),false);  // This is a bit harsh, but hey we will need to ensure the config files are generated.
    }
    // Right now we use a pretty rudimentary check, just checking if the server.cfg file exists

    var starMadeJar=path.join(pathToUse,"StarMade.jar");
    // Right now our "verification" is pretty simple.  Just check for the install folder and then server.cfg + StarMade.jar file.  
    // This can be expanded on later if needed to verify all preloaded configs and needed folders exist.
    if (fs.existsSync(pathToSMInstall)){
      if (fs.existsSync(starMadeJar)){ 
        return cb(null,true);
      }
      return cb(null,false);
    } else {
      return cb(null,false);
    }
  }
  return simplePromisifyIt(isInstalled,options,pathToSMInstall);
}

function verifyInstall (pathToSMInstall,options,cb){
  // Used to generate configs on an already completed install.  Will not complete an install if not installed.
  // This checks the install has been done AND config files exist.  If not, gets the configs made.
  // used by the starter.js file
  try {
    var pathToUse=getSMInstallPath(pathToSMInstall);
  } catch (err) {
    throw new Error("No path to SM install provided!  Cannot verify install!");  // This is a bit harsh, but hey we will need to ensure the config files are generated.
  }
  var starMadeServerCfg=path.join(pathToUse,"server.cfg");
  console.log("Verifying install..");
  return isInstalled(pathToUse,"",function(err,result){
    if (err){
      return cb(err,result);
    }
    if (result == true){
      console.log("Install found!");
      if (fs.existsSync(starMadeServerCfg)){ // Right now our "verification" is pretty simple.  Just check for the server.cfg file.  This can be expanded on later if needed to verify all preloaded configs and needed folders exist.
        // file exists, so return true that it is verified.
        return cb(null,true);
      } else { // If the install does not verify, then we'll need to repair it.
        return generateConfigFiles(pathToUse,options,function(err,result){
          if (err){
            console.log("Could not generate config files!");
            return cb(err,result);
          }
          if (result == true){
            console.log("Config files created successfully!");
            return cb(null,true);
          }
          console.log("Config file generation failed!"); // This is redundant and should never happen
          return cb(new Error(`Failed to generate config files for install: ${pathToUse}`),false); 
        });
      }
    } else {
      return cb(new Error("Could not verify install! No install found at path: " + pathToUse),false);
    }
  });
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



function generateConfigFilesOld2(starMadeInstallFolder,options,cb){
  // TODO:  Change this so that it runs asynchronously
  let theBinFolder=path.join(__dirname,"bin");
  let generateConfigsScript=path.join(theBinFolder,"generateConfigs.js");
  console.log("Generating configs..");
  var theResult=child.spawnSync("node",[generateConfigsScript,starMadeInstallFolder],{"cwd": theBinFolder});

  // Check to ensure it did not exit with a code, otherwise this means the process failed to start.  This should not happen normally.
  if (typeof theResult.status == "number"){
    if (theResult.status > 0){
      console.log("ERROR: Could not start the StarMade.jar file to generate configs!");
      if (theResult.stdout){
        console.log(theResult.stdout);
      }
      if (theResult.stderr){
        console.log(theResult.stderr);
      }
      if (theResult.error){
        console.dir(theResult.error);
      }
      process.exit(1); // Keep in mind, this should never happen.
    }
  }
}

function generateConfigFilesOld (pathToSMInstall){
  // If StarMAde install files and folders don't exist, we can actually run the StarMade.jar file with an invalid argument and it will generate config files/folders and then exit.
  // IMPORTANT:  This method may not be future-proof!
  try {
    var pathToUse=getSMInstallPath(pathToSMInstall);
  } catch (err) {
    throw new Error("No path to SM install provided!  Cannot generate config files!");  // This is a bit harsh, but hey we will need to ensure the config files are generated.
  }
  var starMadeJarFile=path.join(pathToUse,"StarMade.jar");
  console.log("Generating config files..");
  var createConfigFilesSpawn;
  if (process.platform=="win32"){
    createConfigFilesSpawn=child.spawnSync("java",["-Xincgc","-Xshare:off","-jar",starMadeJarFile,"-nonsense4534"],{"cwd": pathToUse});  // Starting the StarMade.jar file with an invalid argument will generate the config files and then exit with a 0 exit code.  This may very well not be future proof!
  } else {
    createConfigFilesSpawn=child.spawnSync("java",["-jar",starMadeJarFile,"-nonsense4534"],{"cwd": pathToUse});  // Starting the StarMade.jar file with an invalid argument will generate the config files and then exit with a 0 exit code.  This may very well not be future proof!
  }
  console.log("PID: " + createConfigFilesSpawn.pid);
  if (createConfigFilesSpawn.status && createConfigFilesSpawn.status != 0){ // temporary instance of the StarMade.jar with a non-zero exit code.  This might happen if there isn't enough RAM available or some other error when running it.
    console.error("ERROR: Failed to generate config files to folder: " + pathToUse);
    if (createConfigFilesSpawn.signal){  // Instance of StarMade was killed!
      console.error("ERROR INFO: Temporary StarMade Instance killed! Exit code (" + createConfigFilesSpawn.status + ") and signal (" + createConfigFilesSpawn.signal + ").");
    } else {  // Installer exited on it's own with an error code
      console.error("ERROR INFO: Temporary StarMade Instance exited with error code (" + createConfigFilesSpawn.status + ").");
    }
    if (createConfigFilesSpawn.stderr){ console.error("Error output: " + createConfigFilesSpawn.stderr); }
    process.exitCode=35;
    throw new Error("Install error!");
    // exitNow(35); // Exit the main script, since we cannot run a wrapper without a valid install.
  } else { console.log("Config files and folders generated successfully to: " + pathToUse); }
}

