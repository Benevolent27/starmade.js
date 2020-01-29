// This script ensures a "settings.json" file exists and has valid settings.
// If settings do not exist, it will ask for them.
// It then returns the settings as an object.

// To use this in the main starmade.js file, use as:
// const setSettings = require("./bin/setSettings.js");
// var settings = setSettings();

// This should ONLY ever be ran from the starmade.js script, never as itself, otherwise it's script requires won't load properly.

// TODO:  Add formatting options for how a bot message appears.
if (require.main.filename == __filename) {
  console.error("This script should only ever be run by the starmade.js script!  Exiting!");
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

module.exports = function (serverSettingsObj) { // If no serverSettingsObj provided, this will return a new one.
  // I'm simplifying this to do no file reads or writes, but to simply act on a server settings object to complete it or create a new one, then return the completed object

  var mainFolder = path.dirname(require.main.filename);
  var binFolder = path.join(mainFolder, "bin");
  var installAndRequire = require(path.join(binFolder, "installAndRequire.js")); // This is used to install missing NPM modules and then require them without messing up the require cache.
  var objectHelper = require(path.join(binFolder, "objectHelper.js"));
  var miscHelpers = require(path.join(binFolder, "miscHelpers.js"));
  var {
    isAlphaNumeric,
    testIfInput,
    toNumIfPossible,
    mergeObjs
  } = objectHelper; // Aliases
  var {
    ensureFolderExists
  } = miscHelpers;
  // console.log("Loading dependencies..");
  const prompt = installAndRequire("prompt-sync", '^4.1.7')({
    "sigint": true
  }); // https://www.npmjs.com/package/prompt-sync - This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
  const isInvalidPath = installAndRequire("is-invalid-path", '^1.0.2'); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
  const mkdirp = installAndRequire("mkdirp", '^0.5.1'); // https://www.npmjs.com/package/mkdirp - Great for sync or async folder creation, creating all folders necessary up to the end folder


  function isValidCommandOperator(testString) {
    // Command operators cannot be / characters, alphanumeric, blank, and must be 1 character
    if (!testString) {
      return true;
    } else if (isAlphaNumeric(testString) || testString.indexOf("/") != -1 || testString.length > 1) {
      return false;
    }
    return true;
  }

  function ramValueToBytes(input) {
    var output;
    if (isRamValue(input)) {
      let testTextArray = input.toString().toLowerCase().split("");
      let lastNum = testTextArray.length - 1;
      let modifier;
      let modifierNum = 1;
      if ((/[kmg]/i).test(testTextArray[lastNum])) {
        modifier = testTextArray.pop();
      }
      if (modifier == "k") {
        modifierNum = 1024;
      } else if (modifier == "m") {
        modifierNum = 1024 * 1024;
      } else if (modifier == "g") {
        modifierNum = 1024 * 1024 * 1024;
      }
      let testVal = toNumIfPossible(testTextArray.join(""));
      if (typeof testVal == "number") {
        output = testVal * modifierNum;
      }
    }
    return output; // Returns undefined if the input was invalid.
  }

  function isRamValue(testVal) {
    let testTextArray;
    if (testIfInput(testVal)) {
      testTextArray = testVal.toString().toLowerCase().split("");
      if ((/[0-9kmg]/i).test(testTextArray.pop())) { // Check to see if the last value is a number, k, m, or g.  Pop also removes it from the array.
        for (let i = 0; i < testTextArray.length; i++) { // Loop through the rest of values
          if (!(/[0-9]/).test(testTextArray[i])) { // if the current value we are checking is NOT a number, then return false
            return false;
          }
        }
        return true; // After checking all the values, they were all numbers, so return true.
      }
      return false; // No valid input given
    }
    return false; // The first check failed.  The last value in the string was not a number, k, m, nor g, so return false.
  }

  function portValueTest(num) {
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

  function testStarMadeDirValue(installDir) {
    if (!installDir) {
      return path.join(mainFolder, "starmade");
    }
    if (!isInvalidPath(installDir)) { // If the path provided was valid
      let resolvedInstallDir = path.resolve(mainFolder, installDir); // This will resolve from right to left, so if the install dir is a full path, it will not use the main starmade directory as the first part.  Otherwise, it will be relative to the folder starmade.js is in.
      if (fs.existsSync(resolvedInstallDir)) { // If the path exists, check to see if it is a file or named pipe.  IF so, we cannot use it.
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

  function loadSettings(serverSettingsObj) {
    var settings = { // these are the default settings to use if not otherwise specified
      showStderr: true, // Normally this would be true but can be turned to false if testing
      stderrFilter: null,
      showStdout: false,
      stdoutFilter: null,
      showServerlog: true,
      serverlogFilter: null,
      showAllEvents: false,
      enumerateEventArguments: false,
      announceSpawnsToMainChat: true // Announces publicly when a player spawns.  More useful than the "connected" announcement, since they can now talk.
    };
    var settingsLoadedCheck = false;
    if (typeof serverSettingsObj == "object") {
      settings = mergeObjs(settings, serverSettingsObj);
      settingsLoadedCheck = true;
    }

    // this.loadSettings = function () {  // This is an alternative way to do it so "loadSettings();" would be how the function would be called from the main script.. but it's really not necessary.  I'm only leaving this here for future reference.
    var changeMadeToSettings = false;

    // IF there was a settings.json file imported, ensure that all values are set, asking for any that do not exist.
    if (!settings.hasOwnProperty('javaMin')) {
      // TODO: Add Protection so the person cannot set something ridiculous like 128 bytes.  Make MB the default if just a number is typed.
      // Also add protection to ensure the min value is not higher than the max and that neither exceeds the RAM of the PC.  Perhaps add a warning if over 80% if this is possible.
      console.log("");
      if (settingsLoadedCheck == true) {
        console.log("Well that's funny, this ole setting seems to have been unset..");
      }
      var javaMin;
      while (!isRamValue(javaMin)) {
        javaMin = prompt("Java MIN RAM to use? (Recommended: 512m or higher): ");
        if (!isRamValue(javaMin)) {
          console.log("ERROR: Input invalid!  Please specify a number!  Note: It can end in k, m, or g.");
        } else if (ramValueToBytes("128m") > ramValueToBytes(javaMin)) { // Minimum value here is 128m
          console.log("ERROR: Input number too small!  Please specify a number larger than 128m!");
          javaMin = "";
        }
      }
      settings["javaMin"] = javaMin; // Only set the value after it is successfully created
      // while (!isRamValue(settings["javaMin"]=prompt("Java MIN RAM to use? (Recommended: 512m or higher): "))){ console.log("Please specify a number!  Note: It can end in k, m, or g."); }
      console.log("Min RAM usage set to: " + settings["javaMin"]);
      changeMadeToSettings = true;
    }
    if (!settings.hasOwnProperty('javaMax')) {
      console.log("");
      if (settingsLoadedCheck == true) {
        console.log("Hmm.. A setting has gone missing!");
      }
      var javaMax;
      while (!isRamValue(javaMax)) {
        javaMax = prompt("Java MAX RAM to use? (Recommended: 4096m or higher): ");
        if (!isRamValue(javaMax)) {
          console.log("ERROR: Input invalid!  Please specify a number!  Note: It can end in k, m, or g.");
        } else if (ramValueToBytes("512m") > ramValueToBytes(javaMax)) { // Minimum value here is 512m
          console.log("ERROR: Input number too small!  Please specify a number larger than 512m!");
          javaMax = "";
        }
      }
      settings["javaMax"] = javaMax; // Only set the value after it is successfully created
      // while (!isRamValue(settings["javaMax"]=prompt("Java MAX RAM to use? (Recommended: 4096m or higher): "))){ console.log("Please specify a number!  Note: It can end in k, m, or g."); }
      console.log("Max RAM usage set to: " + settings["javaMax"]);
      changeMadeToSettings = true;
    }
    if (!settings.hasOwnProperty('port')) {
      console.log("");
      if (settingsLoadedCheck == true) {
        console.log("Why doth port not set proper-like?");
      }
      while (isNaN(parseInt(settings["port"] = portValueTest(prompt("What port shall we use? (Default: 4242): "))))) {
        // console.log("Please specify a number to use as the port!");
      }
      console.log("Port set to: " + settings["port"]);
      changeMadeToSettings = true;
    }
    if (!settings.hasOwnProperty('commandOperator')) {
      if (settingsLoadedCheck == true) {
        console.log("Command Operator went AWOL?!");
      }
      console.log("What would you like your command operator to be?");
      console.log("For example, if users type '!help' to receive help then '!' is the command operator.");
      console.log("Note:  The command operator MUST be a symbol, but it cannot be the '/' character since StarMade uses that.");
      while (!isValidCommandOperator(settings["commandOperator"] = prompt("(Default='!'):  "))) {
        console.log("Please specifiy a non-alphanumeric character!  Mkaythx!");
      }
      if (!settings["commandOperator"]) {
        settings["commandOperator"] = "!";
      } // If nothing was entered, set the default.
      console.log("Command Operator set to: '" + settings["commandOperator"] + "'");
      changeMadeToSettings = true;
    }
    if (!settings.hasOwnProperty('installFolder')) { // It always should have this if it was created through the starmade.js file.  We only have this here in case someone wants to create a ServerObj that is not tracked by the main starmade.js script for some reason.  Originally this script created the directory, so since it serves some kind of purpose, I'm leaving it.
      if (settingsLoadedCheck == true) {
        console.log("Not sure why, but your install folder is not like.. set in the settings.json.  D:");
      }
      console.log("\nWhat StarMade installation folder should we use?");
      console.log("By default, 'starmade' in the same folder as starmade.js is used. (recommended)");
      while (!(settings["installFolder"] = testStarMadeDirValue(prompt(": ")))) {
        /* empty on purpose */
      }
      console.log("StarMade Install Folder set to: " + settings["installFolder"]);
      if (!fs.existsSync(settings["installFolder"])) {
        console.log("\nThe StarMade Install folder does not exist!");
        if (prompt("Press [ENTER] to confirm creating the folder.")) {
          console.log("Something else was typed!  Abort ABORT!");
          process.exit(130);
        }
        try {
          if (ensureFolderExists(settings["installFolder"]) != true) {
            throw new Error("Folder could not be created: " + settings["installFolder"]);
          }
          console.log("Successfully created directory: " + settings["installFolder"]);
        } catch (err) {
          // console.error("ERROR: Could not create directory, '" + settings["installFolder"] + "'!  Exiting script!");
          console.error("ERROR: " + err);
          console.error("Please run this script again and choose a different install directory to use!");
          process.exit(31);
        }
      }
      changeMadeToSettings = true;
    }

    function isValidBuildType(type) {
      if (typeof type == "string") {
        var input = type.toLowerCase().trim();
        if (input.length > 0) {
          if (input == "normal" || input == "dev" || input == "pre") {
            return true;
          }
          return false;
        } else {
          return true;
        }
      }
      return false;
    }
    if (!settings.hasOwnProperty('buildBranch')) {
      if (settingsLoadedCheck == true) {
        console.log("No Build branch currently specified in your settings file?!  Let's fix that!");
      }
      console.log("What build of StarMade would you like to your server? NORMAL/PRE/DEV");
      console.log("Normally, you'd use 'NORMAL', unless doing debugging for Schema or testing features of an up-coming release.");
      console.log("WARNING:  If specifying PRE or DEV, you may not be able to downgrade your world and blueprints back down to normal!");

      while (!isValidBuildType(settings["buildBranch"] = prompt("(Default='NORMAL'):  "))) {
        console.log("Please specifiy either 'NORMAL', 'DEV', or 'PRE', without the quotes.  Specifying nothing will default to 'NORMAL'.  MkayThx!");
      }
      if (settings["buildBranch"] == "") {
        settings["buildBranch"] = "normal";
      } // If nothing was entered, set the default.
      console.log("Using build branch: '" + settings["buildBranch"] + "'");
      changeMadeToSettings = true;
    }

    if (!settings.hasOwnProperty('botName')) {
      if (settingsLoadedCheck == true) {
        console.log("Your bot name has not been set up yet!");
      }
      console.log("\nWhat shall we call your bot?  Please use only alphanumeric characters!");
      var botName;
      while (!(settings["botName"])) {
        botName = prompt(": ");
        if (isAlphaNumeric(botName)) {
          settings["botName"] = botName;
        }
      }
      console.log("Successfully named your bot " + settings["botName"]);
      changeMadeToSettings = true;
    }
    // botName

    // These are default settings that normally a player would not set up when running the wrapper, but can be changed later in the config if desired
    if (!settings.hasOwnProperty('autoStart')) {
      settings["autoStart"] = true;
      changeMadeToSettings = true;
    }
    if (!settings.hasOwnProperty('autoRestart')) { // This auto-restarts the server if it shuts down when it shouldn't be shut down, such as on a crash or if a bug crash happens which appears like a normal shutdown but cannot be.  This would also trigger if an admin uses the /shutdown command rather than wrapper controls to shut down the server.
      settings["autoRestart"] = true;
      changeMadeToSettings = true;
    }
    if (!settings.hasOwnProperty('autoExit')) { // This makes the wrapper shut down on a normal exit of the game.
      settings["autoExit"] = false; // This is false by default because some shutdowns which appear to be normal are, in fact, caused by bug crashes that initiate a normal looking shutdown.
      changeMadeToSettings = true;
    }

    function complete(commands) {
      // console.log("commands: " + commands);
      return function (str) {
        var ret = [];
        for (let i = 0; i < commands.length; i++) {
          // console.log("Working on: " + commands[i]);
          if (commands[i].indexOf(str) == 0) {
            ret.push(commands[i]);
          }
        }
        return ret;
      };
    }

    if (!settings.hasOwnProperty('smTermsAgreedTo')) {
      if (settingsLoadedCheck == true) {
        console.log("\nTerms and Conditions setting seems to have been forgotten!");
      }
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
      settings["smTermsAgreedTo"] = prompt(": ", {
        autocomplete: complete(["ardvark", "babelfish", "conch", "doge", "earwig", "fritiniency", "gadzooks!", "hereticide", "ichthyoacanthotoxism", "jackalope", "kickie-wickie", "lactescent", "milquetoast", "nougat", "nubile", "odiferous", "pupillarity", "quackle", "rencounter", "shrieval", "tabernacular", "uraniscus", "vulgus", "wharfinger", "xenodocheionology", "zyzzyva", "yabbadabbadoo!"])
      }).toLowerCase();
      if (settings["smTermsAgreedTo"] != "yes") {
        console.log("\nSince you have not already agreed to Schine's terms of service for StarMade,");
        console.log("You have indicated that you are not authorized to download nor use their software,");
        console.log("therefore this wrapper cannot run!");
        console.log("If you agree to them in the future, feel free to run this script again.  Mkaythxbai!");
        process.exit(32);
      }
      changeMadeToSettings = true;
    }
    if (changeMadeToSettings == true) {
      console.log("Finished settings setup!");
    }
    return settings;
  }
  return loadSettings(serverSettingsObj);

  //  Below is an example of how to ask the questions in an asyncronous way, but we're going to use syncronous since we want to ensure all of these values are set before we do anything anyhow.  If we ever need to have things going off in the background while people are being asked questions, I'll switch to the async method.

  // // For async Function at bottom of script.
  // function sleep(ms) {
  //   return new Promise(resolve => setTimeout(resolve, ms));
  // }
  //
  // var questionsArray = [
  //     "What is your StarMade Directory?"            ,
  //     "What is the Minimum Memory?"                 ,
  //     "What is the Maximum memory?"                 ,
  //     "What is the Port?"
  // ];
  // var questions = questionsArray.length;
  //   // Ask for the path to the starmade folder and put into a "result" variable.
  //
  //
  // function askQuestions() {
  //   if (questions > 0) {
  //     process.stdout.write("Question #" + questions + " : " + questionsArray[(questions-1)].toString());
  //     process.stdin.once('data', function (data) {
  //       console.log("You typed:" + data.toString().trim());
  //        if (questions==3) { // We just got the answer for the 1st question(ports)
  //          if (data){
  //            settings["port"]=data.toString().trim();
  //          } else {
  //            settings["port"]='4242'
  //          }
  //        } else if (questions==2) { // We just got the answer to the 2nd question(javaMax)
  //          if (data){
  //            settings["javaMax"]=data.toString().trim();
  //          } else {
  //            settings["javaMax"]='1024'
  //          }
  //        } else if (questions==1) { // We just got the answer to the 3rd question(javaMin)
  //          if (data){
  //            settings["javaMin"]=data.toString().trim();
  //          } else {
  //            settings["javaMin"]='512'
  //          }
  //        } else if (questions==0) { // We just got the answer to the 4th (StarMade Folder)
  //          if (data){
  //            settings["installFolder"]=data.toString().trim();
  //          } else {
  //            settings["installFolder"]='/starmade/'
  //          }
  //        }
  //       askQuestions();
  //     });
  //     } else {
  //       process.stdin.end();
  //     }
  //     questions--;
  // };
  //
  //
  // askQuestions();
  //
  // async function end () {
  //     while(questions>-1){
  //         await sleep(1000);
  //     }
  //     console.log("Done!");
  //     console.dir(settings);
  // }
  // end();
}