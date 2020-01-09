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
  regConstructor, // Allows outside scripts to register new functions for use with squish/unsquish
  deregAllConstructors, // Deregisters constructors registered by mods
  deregConstructor, // Deregisters a specific constructor added by a mod
  squish,
  unSquish,
  isSquishable
}

// Requires
const path                 = require('path');
const {PassThrough}      = require('stream'); // For custom console
const {Console}            =require('console'); // For custom console
const mainFolder           = path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself for testing purposes.
const binFolder            = path.resolve(__dirname,"../bin/");
const http                 = require('http');
const miscHelpers          = require(path.join(binFolder,"miscHelpers.js"));
const requireBin           = miscHelpers["requireBin"];
const objectHelper         = requireBin("objectHelper.js");
const installAndRequire    = requireBin("installAndRequire.js");

// NPM installable requires

// Aliases for requires - These are set up for readability
const {copyArray,toNumIfPossible,toStringIfPossible,subArrayFromAnother,findSameFromTwoArrays,isInArray} = objectHelper;
const {testIfInput,trueOrFalse,isTrueOrFalse,isNum,colorize,getObjType,returnLineMatch,applyFunctionToArray,simplePromisifyIt,toTrueOrFalseIfPossible} = objectHelper;
const {isTrue,isFalse,getOption,addOption,getParamNames,getRandomAlphaNumericString,arrayMinus,addUniqueToArray}=objectHelper;

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

function CustomConsole(consoleName,options){
  if (typeof consoleName != "string" || consoleName == ""){
    throw new Error("Invalid input given to CustomConsole!  Requires a string!");
  }
  var invincible=false;
  if (typeof options == "object"){
    if (options.hasOwnProperty("invincible")){
      if (options.invincible == true){
        invincible=true;
      }
    }
  }

  if (!global.hasOwnProperty("consoles")){
    global["consoles"]={};
  }
  if (global["consoles"].hasOwnProperty(consoleName)){ // If a console with this name has already been created, don't recreate it, just return the existing console object for it.
    return global["consoles"][consoleName];
  }
  const pass = new PassThrough();
  pass.on('data', (chunk) => {
      if (global.consoleSelected == consoleName){
          process.stdout.write(chunk.toString());
      }
  });
  global.event.on("unloadListeners",function(){ // This will require the customConsole obj be recreated to be usable.
    if (!invincible){
      if (global["consoles"].hasOwnProperty(consoleName)){
        delete global["consoles"][consoleName];
      }
      pass.destroy();
    }
  });
  var outputConsole=new Console(pass);
  global["consoles"][consoleName]=outputConsole;
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

