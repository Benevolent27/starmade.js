const fs = require('fs');
const child = require('child_process');
var path = require('path');
// https://www.npmjs.com/package/prompt-sync

// May be a quick way to uncache required files and then re-require them without need for the .
// function requireUncached(module){
//     delete require.cache[require.resolve(module)]
//     return require(module)();
// }

var settingsFile=path.join(__dirname, "/settings.json");

// NPM Reminders
// To uninstall from local dependencies:  npm uninstall -save [Package Name]
// To install to local folder: npm install -save [Package Name]
// To install to local folder and to only use for TESTING ONLY:  npm install -save-dev [Package Name]

function forceRequire(nodeRequire){
  // This is intended to replace require, where it will download remote packages needed if not already available
  // However there are bugs.  This will ONLY work with packages that install to the node_modules folder bearing the name of the package.
  try {
    return require(nodeRequire);
  } catch (err) {
    console.log("'" + nodeRequire + "' dependency not installed!  Installing to local folder..");
    try {
      var installPromptSync = child.execSync('npm install --save ' + nodeRequire);
      if (installPromptSync.stdout) { console.log(installPromptSync.stdout.toString()); }
      if (installPromptSync.stderr) { console.log(installPromptSync.stderr.toString()); }
      if (installPromptSync.message) { console.log(installPromptSync.message.toString()); }
      // var installDeps = child.execSync('npm install'); // This might be necessary if dependencies aren't auto-installed.
      console.log("'" + nodeRequire + "' module installed successfully!");
    } catch (error) {
      console.error("ERROR:  Could not install the dependency, '" + nodeRequire + "'!  Error code: " + error.status);
      if (error.message) { console.error("Infos: " + error.message); }
      process.exit(error.status);
    }
  }
  // Get the main js file from the package.js file.  This only works if the package uses it's own name as it's install folder.  For example, the "is-valid-path" package DOES NOT, so it fails for that.
  let thisModuleFolder=path.join(__dirname, "node_modules", nodeRequire);
  let theMainJSFile=path.join(thisModuleFolder, require(thisModuleFolder + "package.json")["main"]);
  return require(theMainJSFile);
}

function forceRequireWithSettings(nodeRequire,settings){
// I had to create this function variation because of the package "prompt-sync", which forces a require('prompt-sync')() <-- note the extra parenthesis
// Every other package that I've been looking at gets fucked up if you try to require it with the extra ()
let theSettings="";
if (settings) { theSettings=settings; }
  try {
    return require(nodeRequire)(theSettings);
  } catch (err) {
    console.log("'" + nodeRequire + "' dependency not installed!  Installing to local folder..");
    try {
      var installPromptSync = child.execSync('npm install --save ' + nodeRequire);
      if (installPromptSync.stdout) { console.log(installPromptSync.stdout.toString()); }
      if (installPromptSync.stderr) { console.log(installPromptSync.stderr.toString()); }
      if (installPromptSync.message) { console.log(installPromptSync.message.toString()); }
      // var installDeps = child.execSync('npm install'); // This might be necessary if dependencies aren't auto-installed.
      console.log("'" + nodeRequire + "' module installed successfully!");
    } catch (error) {
      console.error("ERROR:  Could not install the dependency, '" + nodeRequire + "'!  Error code: " + error.status);
      if (error.message) { console.error("Infos: " + error.message); }
      process.exit(error.status);
    }
  }
  // Get the main js file from the package.js file.  This only works if the package uses it's own name as it's install folder.  For example, the "is-valid-path" package DOES NOT, so it fails for that.
  let thisModuleFolder=path.join(__dirname, "node_modules", nodeRequire);
  let theMainJSFile=path.join(thisModuleFolder, require(thisModuleFolder + "package.json")["main"]);
  return require(theMainJSFile)(theSettings);
}
const prompt = forceRequireWithSettings("prompt-sync",{"sigint":true}); // https://www.npmjs.com/package/prompt-sync - This creates sync prompts and can have auto-complete capabilties.  The sigint true part makes it so pressing CTRL + C sends the normal SIGINT to the parent javascript process
// const decache = forceRequire("decache"); // https://www.npmjs.com/package/decache - This is used to reload requires, such as reloading a json file or mod without having to restart the scripting.
const isInvalidPath = forceRequire("is-invalid-path"); // https://www.npmjs.com/package/is-invalid-path -- Not using the "is-valid-path" because my force require scripting won't work with it since it uses a non-standard path to it's scripts
const mkdirp = forceRequire("mkdirp"); // https://www.npmjs.com/package/mkdirp - Great for sync or async folder creation, creating all folders necessary up to the end folder


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
  if (!installDir) { return path.join(__dirname, "starmade"); }
  if (!isInvalidPath(installDir)) { // If the path provided was valid
    if (fs.existsSync(installDir)){ // If the path exists, check to see if it is a file or named pipe.  IF so, we cannot use it.
      if (fs.statSync(installDir).isFile()) {
        console.log("ERROR: '" + installDir + "' already exists as a filename.  Please choose a different directory path!");
      } else if (fs.statSync(installDir).isFIFO()) {
        console.log("ERROR: '" + installDir + "' already exists as a named pipe.  Please choose a different directory path!");
      } else {
        return installDir // The path existed and it was not a file or named pipe so we should be able to use it.. unless it's a symlink to a file.. but I figure if someone is using symlinks to a file they should be smart enough to know not to try to use it as their starmade install folder..
      }
    }
    // The path specified was valid, but did not exist, so let's just return it.  The next part of the scripting will then create it if it does not exist, making SURE this is the path intended.
    return installDir;
  }
  // The path was invalid, so throw crap at the person.
  console.log("ERROR: The path you specified is not valid!");
  console.log("Please enter the full path to where you want your StarMade install to be.");
  console.log("Note:  If you simply press enter, we'll use the same folder that starmade.js is in. (Recommended!)");
  return false;
}

var settings={};
var settingSet=false;
try {
  settings = require(settingsFile);
  // console.log("Imported settings values from " + settingsFile);
} catch (ex) {
  console.log("'settings.json' did not exist.  Running setup..");
}

// IF there was a settings.json file imported, ensure that all values are set.
if (!settings.hasOwnProperty('javaMin')) {
  console.log("");
  while (!isRamValue(settings["javaMin"]=prompt("Java MIN RAM to use? (Recommended: 512m or higher): "))){ console.log("Please specify a number!  Note: It can end in k, m, or g."); }
  console.log("Min RAM usage set to: " + settings["javaMin"]);
  settingSet=true;
}
if (!settings.hasOwnProperty('javaMax')) {
  console.log("");
  while (!isRamValue(settings["javaMax"]=prompt("Java MAX RAM to use? (Recommended: 4096m or higher): "))){ console.log("Please specify a number!  Note: It can end in k, m, or g."); }
  console.log("Max RAM usage set to: " + settings["javaMax"]);
  settingSet=true;
}
if (!settings.hasOwnProperty('port')) {
  console.log("");
  while (isNaN(parseInt(settings["port"]=portValueTest(prompt("What port shall we use? (Default: 4242): "))))) {
    // console.log("Please specify a number to use as the port!");
  }
  console.log("Port set to: " + settings["port"]);
  settingSet=true;
}
if (!settings.hasOwnProperty('starMadeFolder')) {
  console.log("\nWhat StarMade folder should we install to?");
  console.log("If not specified, we'll use the same directory as starmade.js. (recommended)");
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
  settingSet=true;
}
// Only write to the file IF new settings were set, otherwise leave it alone.
if (settingSet==true) {
  console.log("");
  try {
    var settingsFileStream=fs.createWriteStream(settingsFile);
    settingsFileStream.write(JSON.stringify(settings));
    settingsFileStream.end();
    console.log("Successfully wrote new settings to settings.json file!")
  } catch (err) {
    console.error("ERROR: Could not write to settings.json file!");
    if (err) {
      console.error("Error message: " + err);
    }
    process.exit(32);
  }
} else {
  console.log("Existing settings.json file loaded!")
}






//  Below is an example of how to ask the questions in an asyncronous way, but we're going to use syncronous since we want to ensure all of these values are set before we do anything anyhow.

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
