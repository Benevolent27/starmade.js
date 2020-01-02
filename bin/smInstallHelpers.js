
// This script should handle all installing, updating, etc. for StarMade installs themselves.
module.exports={
  spawnStarMadeInstallTo,
  verifyInstall,
  generateConfigFiles,
  getSMInstallPath
}

const path  = require('path');
const fs    = require('fs');
const child = require('child_process');

const mainFolder  = path.dirname(require.main.filename); // This is where the starmade.js is.  I use this method instead of __filename because starmade.js might load itself or be started from another script
const binFolder   = path.join(mainFolder,"bin");
const miscHelpers = require(path.join(binFolder,"miscHelpers.js"));

function spawnStarMadeInstallTo(pathToInstall,installerExec){  // This always requires the installerJar path because this will be offloaded to a require later.
  // This needs to be able to use a Jar file or .exe file, depending on the OS.
  // TODO:  We need to add pre/dev options here.
  try {
    var starMadeInstallFolder=getSMInstallPath(pathToInstall);
  } catch (err) {
    throw new Error("No path to SM install provided!  Cannot spawn server install!");  // This is a bit harsh, but hey we will need to ensure the config files are generated.
  }
  var starMadeJarFile=path.join(starMadeInstallFolder,"StarMade.jar");
  if (fs.existsSync(starMadeJarFile)){ // Check if the starmade jar file exists. Install StarMade to the installer path if not.
    console.log("Found StarMade install at: " + starMadeInstallFolder);
  } else {
    console.log("Spawning StarMade Install to: " + starMadeInstallFolder);
    console.debug("Using Spawner Jar: " + installerExec);
    console.debug("Using CWD: " + pathToInstall);
    // This needs to use java for .jar files and just run any .exe
    var smInstallerProcess={};
    smInstallerProcess=miscHelpers.smartSpawnSync(installerExec,["-nogui"],{"cwd": pathToInstall})

    // TODO: Delete this section once smartSpawnSync is verified to work correctly.
    // I don't have this function run differently depending on OS, because I want to keep it capable of running the .jar installer on windows if needed.
    // if ((/[.]exe$/i).test(installerExec)){ // An .exe file was provided, so it must be run directly
    //   smInstallerProcess=child.spawnSync(installerExec,["-nogui"],{"cwd": pathToInstall}); // Use pathToInstall because it will create the /StarMade folder.
    // } else if ((/[.]jar$/i).test(installerExec)){ // Run with java
    //   smInstallerProcess=child.spawnSync("java",["-jar",installerExec,"-nogui"],{"cwd": pathToInstall}); // Use pathToInstall because it will create the /StarMade folder.
    // } else {
    //   throw new Error("Invalid installer executible provided: " + installerExec);
    // }

    console.log("Install PID: " + smInstallerProcess.pid);
    if (smInstallerProcess.status && smInstallerProcess.status != 0){ // Installer exited with a non-zero exit code
      console.error("ERROR: StarMade install failed!  Path: " + starMadeInstallFolder);
      if (smInstallerProcess.signal){  // Installer was killed!
        console.error("ERROR INFO: Install process was killed! Exit code (" + smInstallerProcess.status + ") and signal (" + smInstallerProcess.signal + ")!");
      } else {  // Installer exited on it's own with an error code
        console.error("ERROR INFO: Failed to spawn the StarMade install! Failed with exit code (" + smInstallerProcess.status + ").");
      }
      if (smInstallerProcess.stderr){
        console.error("Install Error output: " + smInstallerProcess.stderr);
      }
      process.exitCode=35;
      throw new Error("Install error!");
      // exitNow(35); // Exit the main script, since we cannot run a wrapper without an install.
    } else {
      console.log("Spawned StarMade install successfully to: " + starMadeInstallFolder);
      generateConfigFiles(starMadeInstallFolder); // After every install, we should generate config files/folders.  We don't verify the install because the installation itself should have produced a verified install.
    }
  }
}

function verifyInstall (pathToSMInstall){
  // TODO: Add a more comprehensive check here.. Should at least check for a StarMade.jar file..
  try {
    var pathToUse=getSMInstallPath(pathToSMInstall);
  } catch (err) {
    throw new Error("No path to SM install provided!  Cannot verify install!");  // This is a bit harsh, but hey we will need to ensure the config files are generated.
  }
  var starMadeServerCfg=path.join(pathToUse,"server.cfg");
  console.log("Verifying install..");
  if (fs.existsSync(starMadeServerCfg)){ // Right now our "verification" is pretty simple.  Just check for the server.cfg file.  This can be expanded on later if needed to verify all preloaded configs and needed folders exist.
    console.log("server.cfg file found..")
  } else { // If the install does not verify, then we'll need to repair it.
    generateConfigFiles(pathToUse); // Right now the "repair" is just to generate config files, but later if we have checks to actually verify the install and it's missing things like the StarMade.jar file, we'll need to run a repair install
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
