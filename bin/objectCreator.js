/* eslint-disable prefer-reflect */

// This script assists with creating all custom object types used by the wrapper.

// TODO: Look into how a mod might extend the object types here, for use with squish/unsquish
// TODO: Make "MineObj"
// TODO: Make "FleetObj"

// Some reading:
// Callback standard used:  http://fredkschott.com/post/2014/03/understanding-error-first-callbacks-in-node-js/

module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  // init, // This is needed so objects can send text directly to the server
  RemoteServerObj,
  CustomConsole,
  CustomLog,
  regConstructor, // Allows outside scripts to register new functions for use with squish/unsquish
  deregAllConstructors, // Deregisters constructors registered by mods
  deregConstructor, // Deregisters a specific constructor added by a mod
  squish,
  unSquish,
  isSquishable,
  CustomEvent
}

// Requires
const path                 = require('path');
const fs                   = require('fs');
const {PassThrough}      = require('stream'); // For custom console
const {Console}            =require('console'); // For custom console
const mainFolder           = path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself for testing purposes.
const binFolder            = path.resolve(__dirname,"../bin/");
const http                 = require('http');
const miscHelpers          = require(path.join(binFolder,"miscHelpers.js"));
const requireBin           = miscHelpers["requireBin"];
const objectHelper         = requireBin("objectHelper.js");
const installAndRequire    = requireBin("installAndRequire.js");
const EventEmitter         = require('events'); 
EventEmitter.prototype._maxListeners = 400; // Was getting errors when more than 10 events registered. Solution From here: https://stackoverflow.com/questions/8313628/node-js-request-how-to-emitter-setmaxlisteners require('events').EventEmitter.prototype._maxListeners = 100;
class Event extends EventEmitter {};

// NPM installable requires

// Aliases for requires - These are set up for readability
const {copyArray,toNumIfPossible,toStringIfPossible,subArrayFromAnother,findSameFromTwoArrays,isInArray} = objectHelper;
const {testIfInput,trueOrFalse,isTrueOrFalse,isNum,colorize,getObjType,returnLineMatch,applyFunctionToArray,simplePromisifyIt,toTrueOrFalseIfPossible} = objectHelper;
const {isTrue,isFalse,getOption,addOption,getParamNames,getRandomAlphaNumericString,arrayMinus,addUniqueToArray}=objectHelper;
const {
  ensureFolderExists,
  getSimpleDate,
  getSimpleTime,
  i
}=miscHelpers;
// Set up aliases from the global variable
if (global.hasOwnProperty("console")){ // allows the global.debug and other modifications to pass through here.
  var console=global.console;
}

var registeredConstructors={};
function regConstructor(theFunction){ // This is for the wrapper objects, NOT server objects!
  if (typeof theFunction == "function"){
    if (theFunction.hasOwnProperty("name")){
      var firstLetter=theFunction.name[0];
      var letterTest=firstLetter.toLowerCase();
      if (firstLetter === letterTest){
        throw new Error("Unable to register constructor! Constructor functions should have an uppercase first letter! '" + theFunction.name + "' does not have an uppercase first letter! -- Source: wrapper object creation");
      } else {
        registeredConstructors[theFunction.name]=theFunction;
        module.exports[theFunction.name]=theFunction;
        console.log("Registered new Constructor, '" + theFunction.name + "', for wrapper."); // This does not make it a constructor.
        return true;
      }
    }
    throw new Error("Unable to register unnamed constructor!  Please only attempt to register VALID constructors!");
  }
  return false;
}
// need a deRegConstructor(name) command and deRegAllConstructors.
function deregConstructor(theFunction){
  var theFunctionTypeName;
  if (typeof theFunction == "function"){
    if (theFunction.hasOwnProperty("name")){
      theFunctionTypeName=theFunction.name;
    } else {
      throw new Error("Invalid input given to deregConstructor!  Expects a named function or string!");
    }
  } else if (typeof theFunction == "string"){
    theFunctionTypeName=theFunction;
  } else {
    throw new Error("Invalid input given to deregConstructor!  Expects a named function or string!");
  }
  var deregged=false;
  if (registeredConstructors.hasOwnProperty(theFunctionTypeName)){
    deregged=true;
    Reflect.deleteProperty(module.exports, theFunctionTypeName);
    Reflect.deleteProperty(registeredConstructors, theFunctionTypeName);
  }
  return deregged; // Returns true if successful, false if not found.
}
function deregAllConstructors(){
  var deregged=false;
  const objectKeys=Object.keys(registeredConstructors);
  for (let i=0;i<objectKeys.length;i++){
    if (deregConstructor(objectKeys[i])){
      deregged=true;
    }
  }
  return deregged; // Returns true if something was removed, false if not.
}

if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.
  console.log("ERROR:  This script cannot be run by itself! Exiting!");
  process.exit();
}


//  #################
//  ###  SQUISH  ####
//  #################
//  This allows "squishing" an object into a smaller object, JSON.stringifying it, 
//  storing it to the hard drive, retrieving it, and then recreating the original object.
//  It will preserve any additional elements added.
//  It requires strict adherence to recreation of the object.  The parameters needed
//  should be stored into the object as they are given, or the values must be able to be converted
//  back to acceptable input by running a function on the value.  
//  TODO:  Convert objects to be compatible with squish


// Squishy code start
SquishedObj.prototype.unSquish=function(options){ // options are optional
  return unSquish(this,options);
}

function squishyElemIsAnythingBut(input){
  var objTypeName="squishedFromObjectType";
  var objCreationArrayName="theSquishObjCreationArray";
  if (input != objTypeName && input != objCreationArrayName){
      return true;
  }
  return false;
}
function isSquishable(inputObj){
  if (typeof inputObj=="object"){
    var inputObjName=inputObj.constructor.name;
    // console.log("inputObjName: " + inputObjName);
    // console.log("typeof inputObjName: " + typeof inputObjName);
    if (typeof inputObjName == "string" && inputObjName !== ""){
      // console.log("Seeing if module.exports.hasOwnProperty(" + inputObjName + ")");
      if (module.exports.hasOwnProperty(inputObjName)){
        if (inputObjName[0].match(/^[A-Z]+/)){ // Must have a capitalized letter as the first letter.
          // It is a registered object type, but can it be successfully squished and unsquished?
          try {
            var squishedObj=squish(inputObj);
          } catch (err){
            // console.log("Could not squish!",err);
            return false;
          }
          try {
            var unSquishedObj=unSquish(squishedObj);
          } catch (err){
            // console.log("Could not unsquish!",err);
            return false;
          }
          // console.log("Made it to checking of objects are equivalent..");
          return objectHelper.areObjsEquivalent(inputObj,unSquishedObj); // Does the squished/unsquished object equal the original?
        }
      }
    }
  }
  return false;
}

function squish(inputObj,options){ // The purpose of this is to minify an object to be recreated back later
    // TODO:  Make this recursive so it will support nested objects, such as with MessageObj nesting PlayerObj as sender, etc.
    console.log("Squishing object..");
    // Get the parameters needed to create the function:

    var objType=inputObj.constructor.name;
    // var objType=inputObj.name;

    // var objCreationString=inputObj.toString();
    console.log("Object type: " + objType);
    // var theConstructor=eval(inputObj.constructor.name); // temp.  Works fine with natively registered constructors from this script but not from registered.
    // Cannot use "new", must instead use the module.exports[objType]

    if (module.exports.hasOwnProperty(objType)){
      var theConstructor=module.exports[objType];
      var paramsNameArray=getParamNames(theConstructor);
      console.log("Parameters: " + paramsNameArray);
  
      // Instead of using the input parameters to look up values from the object,
      // we can specify which ones to use, but the results MUST be able to be used
      // as parameters to create the object.
      // For example:  MyObj(first,second,third,fourth);
      // If the object created by this Constructor has a "1st" value, we can provide
      // that as the map.
      // example:  squish(myObj,{"elements":["1st","2nd","3rd","4th"]})
      // This then looks up myObj["1st"] to use later as input to "first"
      // Even if a parameter will be empty, it must be provided.
      
      var iterableParams=getOption(options,"elements",paramsNameArray);
      var iterableFuncs=getOption(options,"preProcess",[]); // This is used to process any value retrieved to a value that can then be used to recreate the object
      console.log("Using iterable params: " + iterableParams);
      if (Array.isArray(iterableParams)){
          if (iterableParams.length == paramsNameArray.length){
              var theArgArray=[];
              var paramName;
              for (let i=0;i<paramsNameArray.length;i++){
                  paramName=iterableParams[i];
                  if (typeof iterableFuncs[i] == "function"){
                      theArgArray.push(iterableFuncs[i](inputObj[paramName]));
                  } else {
                      theArgArray.push(inputObj[paramName]);
                  }
                  
              }
              console.log("Returning squished object..");
              return new SquishedObj(inputObj,objType,theArgArray);
          } else {
              throw new Error("ERROR: elements array MUST be the same length as the input parameters required by the input Constructor!");
          }
      } else {
          throw new Error("Invalid input given as 'elements' option!  Expects an array!");
      }
    } else {
      throw new Error("Invalid object type given to squish!  Please register the constructor for that object type!");
    }

};

function unSquish(squishedObj,options){
    // console.log("Unsquishing object..");
    var squishedFromObjectType=squishedObj["squishedFromObjectType"];
    // console.log("squishedFromObjectType: " + squishedFromObjectType); // temp
    var theSquishObjCreationArray=squishedObj["theSquishObjCreationArray"];
    var iterableFuncs=getOption(options,"preProcess",[]); // This is used to process any value retrieved to a value that can then be used to recreate the object
    for (let i=0;i<iterableFuncs.length;i++){
        if (typeof iterableFuncs[i] == "function"){
            // if it's a function, run the function on the value from the array to transform it and replace it.
            theSquishObjCreationArray[i]=iterableFuncs[i](theSquishObjCreationArray[i]);
        }
    }
    // var outputObj=Reflect.construct(eval(squishedFromObjectType),theSquishObjCreationArray);
    var outputObj=new module.exports[squishedFromObjectType](...theSquishObjCreationArray);
    for (var property in squishedObj){ // recreate any non-prototypes
        if (squishedObj.hasOwnProperty(property)){
            if (squishyElemIsAnythingBut(property)){
                outputObj[property]=squishedObj[property];
            }
        }
    }
    return outputObj;
};

function SquishedObj(inputObj,objType,objCreationArray){ // Change this to take an array of strings
    var self=this;
    this["squishedFromObjectType"]=objType;
    self["theSquishObjCreationArray"]=objCreationArray;
    if (typeof inputObj == "object" && typeof objType == "string" && Array.isArray(objCreationArray)){
        // var compareToObj=Reflect.construct(eval(objType),objCreationArray);
        // Rather than constructing using reflect, we can simply call the function and look at the output
        // console.log("objType: " + objType);
        // console.log("objCreationArray:");
        // console.dir(objCreationArray);
        
        var compareToObj=new module.exports[objType](...objCreationArray);
        // console.log("compareToObj:"); // temp
        // console.dir(compareToObj); // temp
        
        for (var property in inputObj){
            if (inputObj.hasOwnProperty(property)){ // I don't want to save prototypes
                if (!compareToObj.hasOwnProperty(property)){
                // The element is something not present in the default object type, so let's store it
                self[property]=inputObj[property];
                }
            }
        }
        // Object should now be squished!
    } else {
        throw new Error("Invalid input given to SquishedObj!");
    }
}


function CustomEvent(options){
  // The purpose of this object is to allow reloading of scripts by deleting their require cache.  One important part of that is removing any event listners without removing listeners created by the wrapper or other scripts.
  // So, here we can create a "master custom event" and from that produce one or more "spawn" event emitter.
  // For each spawn event-emitter, when listeners are registered, a cache is built.  When listeners are removed it only removes one ones registered to that specific spawn event-emitter.
  //
  // If the main event emitter has all listeners cleared, it will also remove all listeners for all spawns.
  // Anything emitted to either the master event emitter or any spawn event emitter will trigger listeners on any of the emitters.
  //
  // Example usage: var myCustomEvent=new CustomEvent();
  // To create a spawn:  var myEventSpawn=myCustomEvent.spawn();
  // 
  // Spawns can create other spawns as well.
  // Example:  var anotherEventSpawn=myEventSpawn.spawn();
  var newEvent = new Event();
  var eventFunction={};
  var newEventCopy=objectHelper.copyObj(newEvent);
  newEventCopy["masterEvent"]=newEvent;
  newEventCopy["spawns"]=[]; // This will be an array of all spawns based on this customEvent
  newEventCopy.removeAllListeners=function(theEventName){ // This is necessary to clear all the listener arrays for all spawns
    for (let i=0;i<newEventCopy["spawns"].length;i++){
      console.log("Removing all listeners for spawn # " + i + " type given: " + theEventName);
      newEventCopy["spawns"][i].removeAllListeners(theEventName);
    }
    console.log("###########  Now running it on the actual newEvent!"); // temp
    return newEvent.removeAllListeners(theEventName);
  }
  var spawnID=0;
  newEventCopy.spawn=function(){
    var spawnCopyEvent=objectHelper.copyObj(newEventCopy);
    var eventListeners=[];
    spawnCopyEvent["on"] = function (eventName, theFunction) {
      var theObj = {};
      theObj[eventName] = theFunction;
      eventListeners.push(theObj);
      return newEvent.on(eventName, theFunction);
    }
    spawnCopyEvent["addListener"]=spawnCopyEvent["on"];
    spawnCopyEvent["once"] = function (eventName, theFunction) {
      var theObj = {};
      theObj[eventName] = theFunction;
      eventListeners.push(theObj);
      return newEvent.once(eventName, theFunction);
    }
    spawnCopyEvent["prependListener"] = function (eventName, theFunction) {
      var theObj = {};
      theObj[eventName] = theFunction;
      eventListeners.push(theObj);
      return newEvent.prependListener(eventName, theFunction);
    }
    spawnCopyEvent["prependOnceListener"] = function (eventName, theFunction) {
      var theObj = {};
      theObj[eventName] = theFunction;
      eventListeners.push(theObj);
      return newEvent.prependOnceListener(eventName, theFunction);
    }
    spawnCopyEvent["removeListener"] = function (theName,theFunction) {
      let tempObj={};
      tempObj[theName]=theFunction;
      // console.log("before:");
      // console.table(eventListeners); // temp
      eventListeners=eventListeners.filter(function(e){ // Remove this listener from the array
        for (let key in e){
          if (e.hasOwnProperty(key)){
            if (key == theName && e[key] == theFunction){
              return false;
            }
          }
        }
        return true;
      });
      // console.log("after:");
      // console.table(eventListeners); // temp
      return newEvent.removeListener(theName,theFunction);
    }
    spawnCopyEvent["off"]=spawnCopyEvent["removeListener"];
    
    spawnCopyEvent["removeAllListeners"] = function (theEventName) { // eventName is optional
      var remove=false;
      console.log("Before:");
      console.table(eventListeners);
    if (typeof theEventName == "string" || typeof theEventName == "undefined"){
        for (let i = eventListeners.length-1;i>=0;i--){ // We work through the array backwards since we are removing values and don't want to work with an array that is shrinking as we move upward through it linearly
          for (let eventName in eventListeners[i]){
            if (eventListeners[i].hasOwnProperty(eventName)){
              if (typeof theEventName == "undefined" || (typeof theEventName=="string" && theEventName === eventName)){
                eventFunction=eventListeners[i][eventName];
                newEvent.removeListener(eventName,eventFunction);
                remove=true; // We don't remove the listener from the array here, in the random event the object has more than one key somehow.  Paranoid? yes.
              }
            }
          }
          if (remove == true){
            eventListeners.splice(i,1); // Remove the value from the array
            remove = false;
          }
        }
        console.log("After:");
        console.table(eventListeners);
        return true;
      } else {
        throw new Error("Invalid input given to customEvent.removeAllListeners!  Expects a string or nothing!");
      }
    }
    spawnCopyEvent["masterEvent"]=newEventCopy; // this lets us get the master event.  The original untouched event is never given.
    
    newEventCopy["spawns"].push(spawnCopyEvent); // Add it to the master list of spawns

    spawnID++;
    spawnCopyEvent[spawnID]=Number(spawnID);
    spawnCopyEvent["unlink"]=function(){ // This unlinks this spawn as much as possible, but this does not delete it.  If any references exist still to this spawn, garbage collection will not eat it and clear the memory used.
      spawnCopyEvent["masterEvent"]=null;
      spawnCopyEvent["removeAllListeners"]();
      for (let i=newEventCopy["spawns"].length-1;i<=0;i--){
        if (newEventCopy["spawns"][i].spawnID == spawnCopyEvent[spawnID]){
          newEventCopy["spawns"][i]=null;
          newEventCopy["spawns"].splice(i,1);
        }
      }
    }
    return spawnCopyEvent;
  }
  return newEventCopy; // This is the master event, but we can get a spawn if we'd like.  Anything we do here will affect all spawns.
}

function CustomLog(inputPath,options){
  var logsFolder = path.join(inputPath, "logs");
  ensureFolderExists(logsFolder); // Creates the directory
  var logFileName = getSimpleDate() + ".log";
  var logFilePath = path.join(logsFolder, logFileName);
  var logStream = fs.createWriteStream(logFilePath, {flags: 'a'}); // We create a stream here so the handle will not be opened a million times.  This will automatically close when the program ends, and does not need to be ended.
  // process.on('exit', function () { // Should be unnecessary
  //   logStream.end();
  // });
  return function (logMsg) { // Writes to a log file with the current date into the /log subfolder
    if (typeof logMsg == "string") {
      let lineWrite = getSimpleTime() + " - " + logMsg;
      // First check to ensure the correct date will be used.
      let logFileNameTemp = getSimpleDate() + ".log";
      if (logFileNameTemp != logFileName) { // The date must have changed
        logFileName = logFileNameTemp; // Set up the filenames correctly, end the old log stream, and create a new one.
        logFilePath = path.join(logsFolder, logFileName);
        logStream.end();
        logStream = fs.createWriteStream(logFilePath, {"flags": 'a'});
      }
      // touch(logFilePath);
      logStream.write(lineWrite + "\n");
    } else {
      var errorMsg = "Invalid input given to log!  Expects a string!";
      throw new Error(errorMsg);
    }
  }
}

function CustomConsole(consoleName,options){
  
  if (typeof consoleName != "string" || consoleName == ""){
    throw new Error("Invalid input given to CustomConsole!  Requires a string!");
  }
  console.log(`Creating new custom console, '${consoleName}'.`);
  var invincible=Boolean(getOption(options,"invincible",false)); // converts a string to boolean
  if (!global.hasOwnProperty("consoles")){
    global["consoles"]={};
  }
  if (global["consoles"].hasOwnProperty(consoleName)){ // If a console with this name has already been created, don't recreate it, just return the existing console object for it.
    console.log("Console already existed!  Returning existing console..");
    return global["consoles"][consoleName].console;
  }
  if (!global.hasOwnProperty("consoleSelected")){
    global["consoleSelected"]=consoleName; // If no other console has been created, select this one by default.
  }
  const pass = new PassThrough();
  var lastLines=[];
  var maxLines=100;
  pass.on('data', (chunk) => {
    lastLines.unshift(chunk.toString()); // Add the line to the beginning of the array
    if (lastLines.length > maxLines){ // Trim off anything past the max lines.
      lastLines=lastLines.slice(0,maxLines); // This does not include the last value
    }
    if (global.consoleSelected == consoleName){
        process.stdout.write(chunk.toString());
    }
  });
  if (!invincible){ // Only listen for the unload if it is not invincible
    global.event.on("unloadMods",function(){ // This will require the customConsole obj be recreated to be usable.
      // This is done to clear memory for mods that utilize a CustomConsole
      if (global["consoles"].hasOwnProperty(consoleName)){
        delete global["consoles"][consoleName];
      }
      pass.destroy();
    });
  }
  var outputConsole=new Console(pass);
  outputConsole.switchTo=function(){
    process.stdout.write("\u001b[2J\u001b[0;0H"); // This clears the screen and puts the cursor at the top.  I'm not sure if it works in all the OS's.
    console.log(`Switched to console, '${consoleName}'.`);
    for (let i=0;i<lastLines.length;i++){ // Display each line from the cache
      process.stdout.write(lastLines[i]);      
    }
    global.consoleSelected = consoleName;
  }
  outputConsole.commands={};
  outputConsole.regCommand=function(commandName,category,theFunction){ // Category is optional, default is "General". This is for registering commands that an admin types into the wrapper console.  These will show up when the player types "!help"
    // category is used when the !help command is used, to separate out commands, such as "Server Commands" or "Settings Commands"
    var theCategory="General";
    if (typeof category == "string"){
      theCategory=category;
    }
    if (typeof commandName == "string" && typeof theFunction == "function"){
      // Check for an existing command, using a case insensitive search

      let outputConsoleCommandKeys=Object.keys(outputConsole.commands); // Let's make sure a command of this name wasn't already registered.  To avoid confusion, everything is case insensitive and only one command of a name can be used by the wrapper.
      for (let y=0;y<outputConsoleCommandKeys.length;y++){
        if (i(outputConsoleCommandKeys[y],commandName)){
          console.log("Existing wrapper command registered already!  Unregistering it and replacing it!");
          delete outputConsole.commands[outputConsoleCommandKeys[y]];
        }
      }
      console.log(`Registering wrapper command, ${commandName}, under category, ${theCategory}..`);
      outputConsole.commands[commandName]=[theCategory,theFunction];
    } else {
      let theMessage="ERROR:  Could not register wrapper command!  Invalid input given!  ConsoleName: " + consoleName;
      console.error(theMessage);
      throw new Error(theMessage);
    }
  }
  outputConsole.debug=function () { // Replaces console.debug because normally in node.js there is no reason to use console.debug; it is the same as console.log.  This comes from browsers, which shows debug messages in a different color, but node does not.
    if (global["debug"]==true){
      console.log(arguments);
    }
  }

  global["consoles"][consoleName]={
    "console":outputConsole,
    "passthrough":pass // This is needed in case we want to pipe a program's output to this console or to attach other readers, such as for logging.  We can pipe or use pass.write("whatever").  Normally this would not be used though.
  }
  return outputConsole;
}

function RemoteServerObj(ip,domain,port){ // TODO:  Is this really needed?
  this.ip=ip;
  this.domain=domain;
  this.port=port;
};

// Support Functions
function getServerListArray(options,cb){ // This must be provided with a callback function that has standard error first handling.  Example:  cb(err,response)
  // Does not have any options currently, but is here for consistency
  var fileURL="http://files-origin.star-made.org/serverlist"  // This is where the server list is currently.
  var rawData="";
  try {
    var request = http.get(fileURL, function(response) {
      // console.log("Status Code: " + response.statusCode);
      // When the file is downloaded with the "http.get" method, it returns an object from which you can get the HTTP status code.
      // 200 means it was successfully downloaded, anything else is a failure.  Such as 404.
      var error=null;
      var returnArray=[];
      if (response.statusCode != 200){
         error=new Error("Response from HTTP server: " + response.statusMessage);
      }
      response.on('data', function(chunk){ rawData+=chunk });
      response.on('end', function() {
        if (rawData){
          returnArray=rawData.trim().split("\n"); // Trim to remove any extra \n at the end so the last values won't be undefined.
          returnArray.forEach(function(val,index){
            returnArray[index]=returnArray[index].split(",");
          });
          returnArray.forEach(function(val,index){
            returnArray[index]=new RemoteServerObj(...returnArray[index]);
          });
        }
        cb(error,returnArray)
      });
    });
  } catch (err){ return cb(err,rawData) }
  return request;
};

