// This script ensures a "settings.json" file exists and has valid settings.
// If settings do not exist, it will ask for them.
// It then returns the settings as an object.
//
// To use this in the main starmade.js file, use as:
// const setSettings = require("./bin/setSettings.js");
// var settings = setSettings();


module.exports = function() {
  const fs = require('fs');
  const child = require('child_process');
  const path = require('path');
  // https://www.npmjs.com/package/prompt-sync

  var mainDirName = path.dirname(require.main.filename);

  // May be a quick way to uncache required files and then re-require them without need for the "decache" module.
  // function requireUncached(module){
  //     delete require.cache[require.resolve(module)]
  //     return require(module)();
  // }

  var settingsFile=path.join(mainDirName, "/settings.json");

  // NPM Reminders
  // To uninstall from local dependencies:  npm uninstall -save [Package Name]
  // To install to local folder: npm install -save [Package Name]
  // To install to local folder and to only use for TESTING ONLY:  npm install -save-dev [Package Name]


  // Depreciated.  I came up with a better method.  Rather than using the "require" function to check for the module and then requiring the main script, I can avoid using require by checking to see if the module exists and then just use require on it.  This leaves the require cache correct, which is important if the module needs to have "require" ran on it somewhere else in the script, such as loading submodules.
  // function forceRequire(nodeRequire){
  //   // This is intended to replace require, where it will download remote packages needed if not already available
  //   // However there are bugs.  This will ONLY work with packages that install to the node_modules folder bearing the name of the package.
  //   try {
  //     return require(nodeRequire);
  //   } catch (err) {
  //     console.log("'" + nodeRequire + "' dependency not installed!  Installing to local folder..");
  //     try {
  //       var installPromptSync = child.execSync('npm install --save ' + nodeRequire);
  //       if (installPromptSync.stdout) { console.log(installPromptSync.stdout.toString()); }
  //       if (installPromptSync.stderr) { console.log(installPromptSync.stderr.toString()); }
  //       if (installPromptSync.message) { console.log(installPromptSync.message.toString()); }
  //       // var installDeps = child.execSync('npm install'); // This might be necessary if dependencies aren't auto-installed.
  //       console.log("'" + nodeRequire + "' module installed successfully!");
  //     } catch (error) {
  //       console.error("ERROR:  Could not install the dependency, '" + nodeRequire + "'!  Error code: " + error.status);
  //       if (error.message) { console.error("Infos: " + error.message); }
  //       process.exit(error.status);
  //     }
  //   }
  //   // Get the main js file from the package.js file.  This only works if the package uses it's own name as it's install folder.  For example, the "is-valid-path" package DOES NOT, so it fails for that.
  //   let thisModuleFolder=path.join(mainDirName, "node_modules", nodeRequire);
  //   let theMainJSFile=path.join(thisModuleFolder, require(thisModuleFolder + "package.json")["main"]);
  //   return require(theMainJSFile);
  // }

  // Depreciated.  I came up with a better method.  Rather than using the "require" function to check for the module and then requiring the main script, I can avoid using require by checking to see if the module exists and then just use require on it.  This leaves the require cache correct, which is important if the module needs to have "require" ran on it somewhere else in the script, such as loading submodules.
  // function forceRequireWithSettings(nodeRequire,settings){
  // // I had to create this function variation because of the package "prompt-sync", which forces a require('prompt-sync')() <-- note the extra parenthesis
  // // Every other package that I've been looking at gets fucked up if you try to require it with the extra ()
  // let theSettings="";
  // if (settings) { theSettings=settings; }
  //   try {
  //     return require(nodeRequire)(theSettings);
  //   } catch (err) {
  //     console.log("'" + nodeRequire + "' dependency not installed!  Installing to local folder..");
  //     try {
  //       var installPromptSync = child.execSync('npm install --save ' + nodeRequire);
  //       console.log("Path to main .js file: " + require.resolve(nodeRequire)); // Temp just to see if this is what is failing.
  //       if (installPromptSync.stdout) { console.log(installPromptSync.stdout.toString()); }
  //       if (installPromptSync.stderr) { console.log(installPromptSync.stderr.toString()); }
  //       if (installPromptSync.message) { console.log(installPromptSync.message.toString()); }
  //       // var installDeps = child.execSync('npm install'); // This might be necessary if dependencies aren't auto-installed.
  //       console.log("'" + nodeRequire + "' module installed successfully!");
  //     } catch (error) {
  //       console.error("ERROR:  Could not install the dependency, '" + nodeRequire + "'!  Error code: " + error.status);
  //       if (error.message) { console.error("Infos: " + error.message); }
  //       process.exit(error.status);
  //     }
  //   }
  //   // Get the main js file from the package.js file.  This only works if the package uses it's own name as it's install folder.  For example, the "is-valid-path" package DOES NOT, so it fails for that.
  //   let thisModuleFolder=path.join(mainDirName, "node_modules", nodeRequire);
  //   let theMainJSFile=path.join(thisModuleFolder, require(thisModuleFolder + "package.json")["main"]);
  //   return require(theMainJSFile)(theSettings);
  // }



  // This is needed to check if a "require" module needs to be installed or not.  One cannot use a try/catch to test, because the response is cached.  Even after installing the module, if you try to require it, it will error out saying it cannot be found.  Using this method, it does not fail.
  // Note that this function will NOT work for modules that do not use the "module" name as it's install directory, so it MUST be tested to work with a required module FIRST.  If it does not work, then I'll need to code in exceptions for specific required modules.
  function isModuleAvailableSync(moduleName) { // Based on code from: https://stackoverflow.com/questions/15302618/node-js-check-if-module-is-installed-without-actually-requiring-it
    var ret = false; // return value, boolean
    var dirSeparator = require("path").sep
    // scan each module.paths. If there exists
    // node_modules/moduleName then
    // return true. Otherwise return false.
    module.paths.forEach(function(nodeModulesPath) {
      if(fs.existsSync(nodeModulesPath + dirSeparator + moduleName) === true) {
          ret = true;
          return false; // break forEach
      }
      return true; // Added to make ESLint happy.. not sure if it will break the code or what.
    });
    return ret;
  }
  function installAndRequire(theModule){  // This should only ever be ran on modules that are installable through NPM
    if (isModuleAvailableSync(theModule) == false){
      try {
        process.stdout.write("Installing required module: " + theModule);
        child.execSync('npm install --save ' + theModule,{"cwd": mainDirName});
        process.stdout.write(" ..Done!\n");
      } catch(error) {
        console.error("ERROR installing module, " + theModule + "! Exiting!");
        console.error("Error returned: " + error)
        process.exit(130);
      }
    }
    console.log("Loading module: " + theModule);
    return require(theModule);
  }

  console.log("Loading dependencies..");
  const prompt = installAndRequire("prompt-sync")({"sigint":true}); // https://www.npmjs.com/package/prompt-sync - This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
  // const decache = forceRequire("decache"); // https://www.npmjs.com/package/decache - This is used to reload requires, such as reloading a json file or mod without having to restart the scripting.
  const isInvalidPath = installAndRequire("is-invalid-path"); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
  const mkdirp = installAndRequire("mkdirp"); // https://www.npmjs.com/package/mkdirp - Great for sync or async folder creation, creating all folders necessary up to the end folder

  // These are just examples you can uncomment out for uses of "prompt"
  // var testPrompt;
  // testPrompt = prompt("What color is your hair? ") ; console.log("I LOOOVE " + testPrompt + " hair!");
  // testPrompt=prompt("What are you wearing? "); console.log("I wish I was wearing " + testPrompt + "..");

  // console.log("I love the number, " + prompt("What is your favorite number? ") + "!"); testPrompt=parseInt(prompt("Gimme a number! ")) + parseInt(prompt("And another number! "));
  // if (!isNaN(testPrompt)) console.log("Result: " + testPrompt); else console.error("One or both of those were not numbers you fuck!");

  // Using an empty while loop to keep prompting someone till they enter a number
  // while (isNaN(testPrompt=parseInt(prompt("ANOTHER NUMBER! ")))){ }
  // console.log("Final Number: " + testPrompt);

  // do testPrompt=parseInt(prompt("Gimme a number for the DO/WHILE Loop Please! "));
  // while (isNaN(testPrompt));
  // console.log("Do/While Loop Number: " + testPrompt);

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
    if (!installDir) { return path.join(mainDirName, "starmade"); }
    if (!isInvalidPath(installDir)) { // If the path provided was valid
      let resolvedInstallDir=path.resolve(mainDirName,installDir); // This will resolve from right to left, so if the install dir is a full path, it will not use the main starmade directory as the first part.  Otherwise, it will be relative to the folder starmade.js is in.
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
      console.log("Existing settings.json file loaded!")
    }
    // console.log("Settings: " + JSON.stringify(settings));
    return settings;
  }
  return loadSettings();

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
  //            settings["starMadeFolder"]=data.toString().trim();
  //          } else {
  //            settings["starMadeFolder"]='/starmade/'
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
