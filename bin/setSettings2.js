// EDITING TO BE ABLE TO SET UP SETTINGS FOR MULTIPLE SERVER NAMES


// This script ensures a "settings.json" file exists and has valid settings.
// If settings do not exist, it will ask for them.
// It then returns the settings as an object.

// To use this in the main starmade.js file, use as:
// const setSettings = require("./bin/setSettings.js");
// var settings = setSettings();


// CURRENT STRUCTURE



// DESIRED STRUCTURE



// This should ONLY ever be ran from the starmade.js script, never as itself, otherwise it's script requires won't load properly.
if (require.main.filename == __filename){
  console.error("This script should only ever be run by the starmade.js script!  Exiting!");
  process.exit(1);
  // TODO: Add the ability for this to run independently to create new server entries
}

const fs = require('fs');
const path = require('path');

module.exports = function() {
  var mainFolder = path.dirname(require.main.filename);
  var binFolder  = path.join(mainFolder,"bin");
  var installAndRequire = require(path.join(binFolder, "installAndRequire.js")); // This is used to install missing NPM modules and then require them without messing up the require cache.
  var settingsFile=path.join(mainFolder, "/settings.json");

  // console.log("Loading dependencies..");
  const prompt = installAndRequire("prompt-sync")({"sigint":true}); // https://www.npmjs.com/package/prompt-sync - This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
  const isInvalidPath = installAndRequire("is-invalid-path"); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
  const mkdirp = installAndRequire("mkdirp"); // https://www.npmjs.com/package/mkdirp - Great for sync or async folder creation, creating all folders necessary up to the end folder

  function isAlphaNumeric(testString){
    return "/^[A-Za-z0-9]+$/".test(testString);
  }
  function isValidCommandOperator(testString){
    // Command operators cannot be / characters, alphanumeric, blank, and must be 1 character

    if (!testString){
      return true;
    } else if (isAlphaNumeric(testString) || testString.indexOf("/") != -1 || testString.length > 1){
      return false;
    }
    return true;
  }

  function isRamValue(testVal) {
    let testTextArray=testVal.toString().toLowerCase().split("");
    if (/[0-9kmg]/.test(testTextArray.pop())){ // Check to see if the last value is a number, k, m, or g.  Pop also removes it from the array.
      for (let i=0;i<testTextArray.length;i++) { // Loop through the rest of values
        if (!(/[0-9]/).test(testTextArray[i])) { // if the current value we are checking is NOT a number, then return false
          return false;
        }
      }
      return true; // After checking all the  values, they were all numbers, so return true.
    }
    return false; // The first check failed.  The last value in the string was not a number, k, m, nor g, so return false.
  }

  function portValueTest (num){
    if (num) {
      if (isNaN(parseInt(num))) {
        console.log("ERROR: '" + num + "' is not a number!");
        return false;
      }
      if (num > 65535 || num < 0) {
        console.log("ERROR: Port numbers MUST always be between 1 and 65535!  Try again!");
        return false;
      }
      return num;
    }
    return 4242;
  }

  function testStarMadeDirValue (installDir) {
    if (!installDir) { return path.join(mainFolder, "starmade"); }
    if (!isInvalidPath(installDir)) { // If the path provided was valid
      let resolvedInstallDir=path.resolve(mainFolder,installDir); // This will resolve from right to left, so if the install dir is a full path, it will not use the main starmade directory as the first part.  Otherwise, it will be relative to the folder starmade.js is in.
      if (fs.existsSync(resolvedInstallDir)){ // If the path exists, check to see if it is a file or named pipe.  IF so, we cannot use it.
        if (fs.statSync(resolvedInstallDir).isFile()) {
          console.log("ERROR: '" + resolvedInstallDir + "' already exists as a filename.  Please choose a different directory path!");
          return false;
        } else if (fs.statSync(resolvedInstallDir).isFIFO()) {
          console.log("ERROR: '" + resolvedInstallDir + "' already exists as a named pipe.  Please choose a different directory path!");
          return false;
        } else {
          return resolvedInstallDir // The path existed and it was not a file or named pipe so we should be able to use it.. unless it's a symlink to a file.. but I figure if someone is using symlinks to a file they should be smart enough to know not to try to use it as their starmade install folder..
        }
      }
      // The path specified was valid, but did not exist, so let's just return it.  The next part of the scripting will then create it if it does not exist, making SURE this is the path intended.
      return resolvedInstallDir;
    }
    // The path was invalid, so throw crap at the person.
    console.log("ERROR: The path you specified is not valid!");
    console.log("Please enter the folder name OR full path to where you want your StarMade install to be.");
    console.log("Note:  If you simply press enter, we'll use the same folder that starmade.js is in. (Recommended!)");
    return false;
  }

  function loadSettings() {
    // this.loadSettings = function () {  // This is an alternative way to do it so "loadSettings();" would be how the function would be called from the main script.. but it's really not necessary.  I'm only leaving this here for future reference.
    var settings={};
    var changeMadeToSettings=false;
    var settingsLoadedCheck=false;
    try {
      settings = require(settingsFile);
      settingsLoadedCheck=true;
    } catch (ex) {
      console.log("Wrapper does not appear to be set up yet.  Running setup routine! :D");
      // console.log("Temp - Current Dir: " + mainDirName);
    }

    // IF there was a settings.json file imported, ensure that all values are set, asking for any that do not exist.
    if (!settings.hasOwnProperty('javaMin')) {
      // TODO: Add Protection so the person cannot set something ridiculous like 128 bytes.  Make MB the default if just a number is typed.
      // Also add protection to ensure the min value is not higher than the max and that neither exceeds the RAM of the PC.  Perhaps add a warning if over 80% if this is possible.
      console.log("");
      if (settingsLoadedCheck == true) { console.log("Well that's funny, this ole setting seems to have been unset.."); }
      while (!isRamValue(settings["javaMin"]=prompt("Java MIN RAM to use? (Recommended: 512m or higher): "))){ console.log("Please specify a number!  Note: It can end in k, m, or g."); }
      console.log("Min RAM usage set to: " + settings["javaMin"]);
      changeMadeToSettings=true;
    }
    if (!settings.hasOwnProperty('javaMax')) {
      console.log("");
      if (settingsLoadedCheck == true) { console.log("Hmm.. A setting has gone missing!"); }
      while (!isRamValue(settings["javaMax"]=prompt("Java MAX RAM to use? (Recommended: 4096m or higher): "))){ console.log("Please specify a number!  Note: It can end in k, m, or g."); }
      console.log("Max RAM usage set to: " + settings["javaMax"]);
      changeMadeToSettings=true;
    }
    if (!settings.hasOwnProperty('port')) {
      console.log("");
      if (settingsLoadedCheck == true) { console.log("Why doth port not set proper-like?"); }
      while (isNaN(parseInt(settings["port"]=portValueTest(prompt("What port shall we use? (Default: 4242): "))))) {
        // console.log("Please specify a number to use as the port!");
      }
      console.log("Port set to: " + settings["port"]);
      changeMadeToSettings=true;
    }
    if (!settings.hasOwnProperty('commandOperator')) {
      if (settingsLoadedCheck == true) { console.log("Command Operator went AWOL?!"); }
      console.log("What would you like your command operator to be?");
      console.log("For example, if users type '!help' to receive help then '!' is the command operator.");
      console.log("Note:  The command operator MUST be a symbol, but it cannot be the '/' character since StarMade uses that.");
      while (!isValidCommandOperator(settings["commandOperator"]=prompt("(Default='!'):  "))){ console.log("Please specifiy a non-alphanumeric character!  Mkaythx!"); }
      if (!settings["commandOperator"]){ settings["commandOperator"]="!"; } // If nothing was entered, set the default.
      console.log("Command Operator set to: '" + settings["commandOperator"] + "'");
      changeMadeToSettings=true;
    }
    if (!settings.hasOwnProperty('starMadeFolder')) {
      if (settingsLoadedCheck == true) { console.log("Not sure why, but your install folder is not like.. set in the settings.json.  D:"); }
      console.log("\nWhat StarMade installation folder should we use?");
      console.log("By default, 'starmade' in the same folder as starmade.js is used. (recommended)");
      while (!(settings["starMadeFolder"]=testStarMadeDirValue(prompt(": ")))) { /* empty on purpose */ }
      console.log("StarMade Install Folder set to: " + settings["starMadeFolder"]);
      if (!fs.existsSync(settings["starMadeFolder"])){
        console.log("\nThe StarMade Install folder does not exist!");
        if (prompt("Press [ENTER] to confirm creating the folder.")){
          console.log("Something else was typed!  Abort ABORT!");
          process.exit(130);
        }
        try {
          settings["starMadeFolder"]=mkdirp.sync(settings["starMadeFolder"]);
          if (!settings["starMadeFolder"]) {
            throw new Error("Folder could not be created!");
          }
          console.log("Successfully created directory: " + settings["starMadeFolder"]);
        } catch (err) {
          // console.error("ERROR: Could not create directory, '" + settings["starMadeFolder"] + "'!  Exiting script!");
          console.error("ERROR: " + err);
          console.error("Please run this script again and choose a different install directory to use!");
          process.exit(31);
        }
      }
      changeMadeToSettings=true;
    }


    function complete(commands) {
      // console.log("commands: " + commands);
      return function (str) {
        var ret = [];
        for (let i=0;i<commands.length;i++) {
          // console.log("Working on: " + commands[i]);
          if (commands[i].indexOf(str) == 0) {
            ret.push(commands[i]);
          }
        }
        return ret;
      };
    }

    if (!settings.hasOwnProperty('smTermsAgreedTo')) {
      if (settingsLoadedCheck == true) { console.log("\nTerms and Conditions setting seems to have been forgotten!"); }
      console.log("\nIMPORTANT:  In order to run a StarMade server, you MUST have already read and agreed ");
      console.log("to the 'Terms and Conditions' as set forth by Schine.  Otherwise you are not authorized");
      console.log("to download their software via this scripting.\n");
      console.log("If you have not yet read and agreed to them, please visit the StarMade webpage now and ");
      console.log("agree to them before proceeding.");
      console.log("Their 'Terms and Conditions' of service may be located here: ");
      console.log("http://www.star-made.org/terms_and_conditions\n");
      console.log("If you HAVE ALREADY read and agreed to the StarMade Terms and Conditions,");
      console.log("please type 'yes' below.  Anything else will exit the setup process.");

      // var autocompleteTest = prompt('custom autocomplete: ', {"autocomplete": complete(['fuck','bye1234', 'by', 'bye12', 'bye123456'])});
      settings["smTermsAgreedTo"]=prompt(": ",{autocomplete: complete(["ardvark","babelfish","conch","doge","earwig","fritiniency","gadzooks!","hereticide","ichthyoacanthotoxism","jackalope","kickie-wickie","lactescent","milquetoast","nougat","nubile","odiferous","pupillarity","quackle","rencounter","shrieval","tabernacular","uraniscus","vulgus","wharfinger","xenodocheionology","zyzzyva","yabbadabbadoo!"])}).toLowerCase();
      if (settings["smTermsAgreedTo"] != "yes"){
        console.log("\nSince you have not already agreed to Schine's terms of service for StarMade,");
        console.log("You have indicated that you are not authorized to download nor use their software,");
        console.log("therefore this wrapper cannot run!");
        console.log("If you agree to them in the future, feel free to run this script again.  Mkaythxbai!");
        process.exit(32);
      }
      changeMadeToSettings=true;
    }
    // Only write to the file IF new settings were set, otherwise leave it alone.
    if (changeMadeToSettings==true) {
      console.log("");
      try {
        var settingsFileStream=fs.createWriteStream(settingsFile);
        settingsFileStream.write(JSON.stringify(settings, null, 4));
        settingsFileStream.end();
        console.log("I just popped out a new 'settings.json' file!  Yippee!")
      } catch (err) {
        console.error("ERROR: Could not write to settings.json file! AAHH!  I kinda need write access to this folder, ya know?");
        if (err) {
          console.error("Error message: " + err);
        }
        process.exit(32);
      }
    } else {
      console.log("Settings file loaded!")
    }
    // console.log("Settings: " + JSON.stringify(settings));
    return settings;
  }
  return loadSettings();
}
