
console.log("Starting up..");
var debug=false;
var commandArguments=process.argv.slice(2);
console.log("commandArguments: " + commandArguments);
for (let i=0;i<commandArguments.length;i++){
  if (commandArguments[i] == "-debug"){
    console.log("Setting debug to true.");
    debug=true;
  }
}
console.debug=function(theMessage){
  if (debug == true){
    console.log(theMessage);
  }
}

var path=require('path');
var fs=require('fs');

var modFolder=path.resolve(__dirname,"../mods/");
var binFolder=path.resolve(__dirname,"../bin/");

var commandsMap=new Map([]);

var installAndRequire = require(path.join(binFolder, "installAndRequire.js"));
const makeDir=installAndRequire('make-dir');
const decache=installAndRequire('decache');

function folderExists(theFolder){
  // This checks to see if the path provided exists and is a directory.  Will return false if a file of the same name exists!
  if (theFolder){
    if (fs.existsSync(theFolder)){
      return fs.lstatSync(theFolder).isDirectory();
    }
    return false;
  }
  return null;
}
function fileExists(theFile){
  // This checks to see if the path provided exists and is a file.  Will return false if a folder of the same name exists!
  if (theFile){
    if (fs.existsSync(theFile)){
      return fs.lstatSync(theFile).isFile();
    }
    return false;
  }
  return null;
}

function createFolderIfNotExists(theFolder){
  console.debug("Checking if folder exists: " + theFolder);
  if (theFolder){
    if (fs.existsSync(theFolder)){
      var theFolderInfo=fs.lstatSync(theFolder);
      if (theFolderInfo.isDirectory()){
        return false; // If it exists and is a directory
      }
      // It already exists but is not a directory, therefore a directory could not be created!  This includes files, named pipes, symlinks, etc.
      console.error("ERROR: Could not create directory because file of same name exists: " + theFolder);
      return new Error("ERROR: Could not create directory because file of same name exists: " + theFolder);
    } else {
      makeDir.sync(theFolder); // This will create the folder tree up to it as needed.
      return true;
    }
  }
  // No input was given!
  console.error("ERROR:  createFolderIfNotExists function ran with no parameters!");
  return new Error("No value given to createFolderIfNotExists function!");
}

createFolderIfNotExists(modFolder);


function getFolders(basePath){
  console.debug("Grabbing folders from: " + basePath);
  var dirListing=fs.readdirSync(basePath);
  var theDirs=[];
  var tempStat;
  for (let i=0;i<dirListing.length;i++){
    tempStat=fs.lstatSync(path.resolve(basePath,dirListing[i]));
    if (tempStat.isDirectory()){
      console.debug("Dir Found: " + dirListing[i]);
      // theDirs.push(path.resolve(basePath,dirListing[i]));
      theDirs.push(dirListing[i]);
    }
  }
  console.debug("Returning directories: " + theDirs);
  return theDirs;
}
function getFiles(basePath){
  console.debug("Grabbing files from: " + basePath);
  var fileListing=fs.readdirSync(basePath);
  var theFiles=[];
  var tempStat;
  for (let i=0;i<fileListing.length;i++){
    tempStat=fs.lstatSync(path.resolve(basePath,fileListing[i]));
    if (tempStat.isFile()){
      // theFiles.push(path.resolve(basePath,fileListing[i]));
      theFiles.push(fileListing[i]);
    }
  }
  return theFiles;
}
function filterJsFiles(inputArray){
  console.debug("Filtering files..");
  var filteredResults=[];
  for (let i=0;i<inputArray.length;i++){
    if (inputArray[i].match(/\.js$/)){
      filteredResults.push(inputArray[i]);
    }
  }
  return filteredResults;
}

function mapRequire(basePath){
  // This function should return a map of filenames and their requires, excluding the basePath
  let theScripts=getScriptFiles(basePath);
  let returnMap=new Map();
  var requireTemp;
  var scriptPath;
  for (let i=0;i<theScripts.length;i++){
    scriptPath=path.join(basePath,theScripts[i]);
    requireTemp=require(scriptPath);
    // Test to ensure the script has the required exports of name and execute
    if (requireTemp.name && requireTemp.execute){
      returnMap.set(theScripts[i],requireTemp);
      if (requireTemp.hasOwnProperty("description")){

      }
    } else {
      console.error("ERROR: Skipping invalid script found at: " + scriptPath);
      // decache the failed script to clear up memory
      decache(scriptPath);
    }
  }
  return returnMap;
}
function getScriptFiles(basePath){
  return filterJsFiles(getFiles(basePath));
}
function getCommands(){
  let returnMap=new Map();
  let modFolders=getFolders(modFolder);
  var scriptRequires;
  var commandFolderToCheck;
  for (let i=0;i<modFolders.length;i++){
    commandFolderToCheck=path.join(modFolder,modFolders[i],"commands");
    // Check all the mod folders for a commands folder, and if it exists perform the map require.
    if (folderExists(commandFolderToCheck)){
      console.debug("Commands folder found at: " + commandFolderToCheck);
      scriptRequires=mapRequire(commandFolderToCheck);
      if (scriptRequires.size > 0){ // The map will only have entries if valid files were found and required.
        returnMap.set(modFolders[i],scriptRequires);
      }
    }
  }
  return returnMap;
}


function getCommandsOld(){
  console.debug("Looking up command folders..");
  var theModsFolders=getFolders(modFolder);
  console.debug("Got mod folders: " + theModsFolders);
  var modCommandsFolder;
  // var modCommandFolderStats;
  var commandFiles=[];
  var commandFileTemp=[];
  var commandFilesMap=new Map();
  for (let i=0;i<theModsFolders.length;i++){
    console.debug("Looping over folder: " + theModsFolders[i]);
    modCommandsFolder=path.join(modFolder,theModsFolders[i],"commands");
    console.debug("Checking if folder: " + modCommandsFolder);
    if (fs.existsSync(modCommandsFolder)){
      if (fs.lstatSync(modCommandsFolder).isDirectory()){
        commandFileTemp=filterJsFiles(getFiles(modCommandsFolder));
        console.debug("commandFileTemp: " + commandFileTemp);
        if (commandFileTemp == ""){
          console.debug("No javascript files found in folder, skipping! " + modCommandsFolder);
        } else {
          for (let i=0;i<commandFileTemp.length;i++){
            console.debug("Setting require for: " + commandFileTemp[i]);
            commandFilesMap.set(theModsFolders[i],require(path.join(modCommandsFolder,commandFileTemp[i])));
          }
          commandFiles.push([modCommandsFolder,commandFilesMap]);
        }
      } else {
        console.error("ERROR: Filename called 'commands' should be deleted since only a 'commands' folder should exist here!");
        console.error("Path: " + modCommandsFolder);
      }
    } else {
      console.debug("No such folder.  Skipping.");
    }
  }
  return commandFiles;
}

function convertArrayToMap(theArray){
  return new Map(theArray);
}

function getInit() {
  // commandsMap=convertArrayToMap(getCommands());
  commandsMap=getCommands();
  if (commandsMap.size > 0){
    console.log("Loaded command mods.");
    // commandsMap.forEach(function(value,key){
    //   console.log("\nKey: " + key);
    //   value.forEach(function (val2,key2){
    //     console.log("subKey: " + key2);
    //     console.dir("subVal: " + val2);
    //     if (val2.name){
    //       console.log("Name: " + val2.name);
    //     }
    //     if (val2.description){
    //       console.log("Description: " + val2.description);
    //     }
    //
    //   });
      // console.log("Value: " + value);
    // });
  } else {
    console.log("No Mod commands to load!");
  }
}

getInit();

function getCommandNameForModScript(mod,script){
  return commandsMap.get(mod).get(script).name;
}
function getCommandDescriptionForModScript(mod,script){
  return commandsMap.get(mod).get(script).description;
}

function getLoadedCommandMods(){
  // Returns an array of loaded mods
  var keyArray=[];
  for (const mod of commandsMap.keys()){
    keyArray.push(mod);
  }
  return keyArray;
}
function getCommandScriptsForMod(mod){
  // returns an array of commands loaded for a mod
  var keyArray=[];
  for (const key of commandsMap.get(mod).keys()){
    keyArray.push(key);
  }
  return keyArray;
}
function displayLoadedModsAndCommands(){
  var getLoadedMods=getLoadedCommandMods();
  var scripts;
  for (let i=0;i<getLoadedMods.length;i++){
    scripts=getCommandScriptsForMod(getLoadedMods[i]);
    console.log("\nMod: " + getLoadedMods[i]); //  + "\t Scripts: " + scripts);
    for (let e=0;e<scripts.length;e++){
      console.log("Script: " + scripts[e] + "\t Command: " + getCommandNameForModScript(getLoadedMods[i],scripts[e]) + "\t Description: " + getCommandDescriptionForModScript(getLoadedMods[i],scripts[e]));
    }

  }
}
function displayLoadedModCount(){
  console.log("Loaded Mods: " + commandsMap.size);
}
displayLoadedModCount();
displayLoadedModsAndCommands();

// getCommandsForMod("testMod");

function load(param){
  console.log("Loading: " + param);
}
function reload(theMod){
  console.log("Reloading: " + theMod);
}
function loadAll(){
  console.log("Loading all mods.");
}

module.exports = {
"load": load,
"reload": reload,
"loadAll": loadAll
};
