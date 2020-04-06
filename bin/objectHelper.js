// These are helper functions to assist with objects and values.  New objects are not created here.  See the "objectCreator.js" file for that.

module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  mapToJson, // this converts a map with all STRING properties to a Json output
  jsonToMap, // This converts a json input to object output
  strMapToObj, // This converts a map with ALL string properties to an object
  objToStrMap, // This converts an object to a map
  toBoolean, // This converts a value to Boolean, handling "false" string as false
  toNumIfPossible, // This converts a value to a number if possible, otherwise returns the value back.
  toStringIfPossible, // This converts a value to a string if possible, otherwise returns the value back.
  toArrayIfPossible, // Only works on objects that have a .toArray() prototype, such as SectorObj, CoordsObj, and LocationObj
  getObjType, // This checks the object.constructor.name value for any object.  All constructor names should be capitalized.  Otherwise returns the typeof value, which should be lowercase.
  "type":getObjType, // This is just an alias.. not sure why I did this..
  colorize, // This adds ANSI values to colorize text
  addNumToErrorObj, // This adds an errno element to an error object equal to the number specified.
  copyArray, // This copies an array rather than linking a value to the same array.
  copyObj,
  mergeObjs, // Usage: mergeObjs(obj1,obj2)  Obj1 is the object used as the basis, with any existing elements overwritten by elements from obj2.  A new object is returned.
  isAlphaNumeric,
  isArrayAllEqualTo, // Compares all values in an array to a single value.  This is used to process arrays of true/false values, where each value indicates a success or failure of an individual operation.
  isInArray, // Checks an array for a value.  Usage:  isInArray(inputArray,ValueToCompare)
  addUniqueToArray, // Only adds to an array if the value isn't already in it.
  subArrayFromAnother, // Subtracts any values that exist in one array from another.
  findSameFromTwoArrays,  // Finds whatever values exist in both arrays
  getOption, // Processes options given to objects {"whatever":true}.  getOption(input,elementToLookFor,whatToUseIfNotFound)
  addOption, // Adds an option to an existing options object and returns the result
  isObjHasPropAndEquals, // Checks if input is an object, has a property, and that property strictly equals a value
  objHasPropAndEquals, // For when you have many property checks and you've already ensured what is being fed is an object
  areObjsEquivalent, // Tests to see if two objects have the same elements and values for those elements (supports values as Map Objects, Date Objects, Objects, Arrays, Strings, and Numbers)
  areMapsEqual, // (supports values as Map Objects, Date Objects, Objects, Arrays, Strings, and Numbers)
  areArraysEqual, // (supports values as Map Objects, Date Objects, Objects, Arrays, Strings, and Numbers)
  areDatesEqual, // Checks the time of date objects.  If non-date objects given, will always return false.
  isEquivalent, // Handles Map Objects, Date Objects, Arrays, Objects, strings, numbers, NaN, undefined, and "".  Will get caught in an infinite loop if given handle recursive objects/maps!
  isObjEmpty, // Checks for empty object
  testIfInput, // Checks if any valid, non-empty input is given.  Returns false for empty objects, true for any boolean value.
  isTrue, // Only string "true" or boolean true will return true
  isFalse, // Only string "false" or boolean false will return true
  trueOrFalse, // This allows string or boolean true or false values, returning boolean.  Returns undefined if neither true nor false.  Does NOT convert 0 to false.
  isTrueOrFalse, // This returns true if the input is either true or false as a string or boolean, false for anything else.  Does NOT convert 0 to false.
  toTrueOrFalseIfPossible, // same as trueOrFalse, except returns the input if it cannot be converted to Boolean rather than undefined.
  isNum, // This returns true if the value is a number, even if it is a string.
  isArray, // This returns true if an array, even if it is empty.
  returnLineMatch,
  repeatString,
  capitalizeFirstLetter, // Capitalizes the first letter and sets rest to lowercase
  getRandomAlphaNumericString,
  arrayMinus, // Usage: arrayMinus(inputArray,valToRemove) -- Returns a new array of all values except the valToRemove
  removeOneFromArray, // Usage: removeOneFromArray(inputArray,valToRemove) -- Returns a new array of all values, minus the first instance of valToRemove
  applyFunctionToArray,
  simplePromisifyIt,
  getParamNames,
  listObjectMethods,
  createDateObjIfPossible,
  compareToObjectArrayToString
};

const util=require('util');
const path=require('path');
const binFolder=path.resolve(__dirname,"../bin/");

function toArrayIfPossible(input){ // Only works on objects that have a .toArray() prototype, such as SectorObj, CoordsObj, and LocationObj
  var output=[];
  if (Array.isArray(input)){
    return input;
  } else if (typeof input == "object"){
    try{
      output=input.toArray();
    } catch (err){
      output=input;
    }
  }
  return output;
}

function compareToObjectArrayToString(inputArray,whatToLookFor,options){ // InputArray should contain objects that have a .toString() prototype so the string value can be compared.
  // Used when checking if a player or entity is in a list, such as for bans/whitelists.  Can be used to check an array of entities returned from a sector to see if a certain entity is there.
  // Accepts input of an array, running .toString() on each result. // Sets both sides to lowercase, unless option is set to false
  var doLowerCase=getOption(options,"toLowerCase",true);
  var theCheck;
  if (doLowerCase){
    theCheck=whatToLookFor.toString().toLowerCase(); // Allows objects that can be turned into strings to be used as input
    for (let i=0;i<inputArray.length;i++){ if (inputArray[i].toString().toLowerCase() == theCheck){ return true } };
  } else {
    theCheck=whatToLookFor.toString(); // Allows objects that can be turned into strings to be used as input
    for (let i=0;i<inputArray.length;i++){ if (inputArray[i].toString() == theCheck){ return true } };
  }
  return false;
}

function createDateObjIfPossible(input){ // Takes either a date string that "new Date" can turn into an object, passes along a Date object fed to it, or returns false if no new Date could be created.
  // This can be used to return a date object from some dates provided by StarMade directly, such as the ip dates returned by the /player_info command.
  if (typeof input != "undefined" && input != "" && getObjType(input) != "Null"){ // if an input is nulled out using null, it actually appears as an "object" to typeof
    if (getObjType(input) == "Date"){
      return input; // If the input was already a Date object, just return it
    } else {
      try{
        var dateTest=new Date(input);
        if (dateTest.toString() == "Invalid Date"){ // If invalid input is given, return false
          return false;
        }
        return dateTest;

      } catch(err) {
        return false;  // Returns false if creating the data object threw an error.
      }
    }
  }
  return false; // Returns false if no input given
};

function listObjectMethods(obj) { // This lists the methods/data available on an object.
  // console.log("Type of input: " + typeof obj);
  if (typeof obj=="object" || typeof obj=="function"){
    const propNames = Object.getOwnPropertyNames(obj);
    const objName=obj.constructor.name;
    // console.log("Here are the elements for the object (type: " + objName + "):");
    var params;
    var outputArray=[];
    propNames.forEach(function(name) {
      try {
        if (typeof obj[name] == "function"){
          params=getParamNames(obj[name]);
          params=params.join(",");
          params="(" + params + ")";
        } else {
          params="";
        }
      } catch (err){
        params="()";
      }
      outputArray.push(name + params);
    });
    return outputArray;
  } else {
    throw new Error("Invalid input given to listObjectMethods! (Requires object input)");
  }
}

// start of getParamNames
var STRIP_COMMENTS = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\s*=[^,)]*(('(?:\\'|[^'\r\n])*')|("(?:\\"|[^"\r\n])*"))|(\s*=[^,)]*))/mg;
var ARGUMENT_NAMES = /([^\s,]+)/g;
function getParamNames(func) {
    var fnStr = func.toString().replace(STRIP_COMMENTS, '');
    var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
    var returnArray=[];
    if(result !== null){
      result=result.toString();
      returnArray=result.split(",");
    }
    return returnArray;
    // Source: https://stackoverflow.com/questions/1007981/how-to-get-function-parameter-names-values-dynamically
}


function simplePromisifyIt(cbFunctionToCall,options){
  // This is used to turn callback functions into promises, provided that they follow the convention used by objectCreator.js
  // The callback function provided should be structured as follows: functionName(arguments1,arguments2,arguments3,options,cb);
  // The cb function does not need to require any arguments:  functionName(options,cb); is fine.
  // However, simplePromisifyIt MUST always be given an 'options' and a 'cb' parameter.
  // Example of usage: simplePromisifyIt(myCBFunction,options,firstArgument,secondArgument,thirdArgument)

  // The function given should run the CB function in node.js style:  cb(err,result);
  // err should be null or an error object, the result can be anything.
  // Example:
  // function myCB(myInput,options,cb){
  //   if (myInput==1){
  //     return cb(null,"The input was 1! Yay!");
  //   } else {
  //     var myError=new Error("The input was not 1!  D:");
  //     return cb(myError,null);
  //   }
  // }
  //  This is the standard for callbacks I adhere to:  http://fredkschott.com/post/2014/03/understanding-error-first-callbacks-in-node-js/


  // Takes a callback function with options and arguments specified.
  // Can take additional parameters as extra arguments after the "options" argument.  Example: simplePromisifyIt(self.whatever,options,someVal,anotherVal,AnotherVal)

  // As an example, if no extra parameters are needed, such as for the PlayerObj, self.isBanned(options,cb)
  // ie: simplePromisifyIt(self.isBanned,options)

  // If 1 additional parameter is given, this can be used for the PlayerObj method, this.msg(message,options,cb)
  // ie: simplePromisifyIt(self.msg,options,message)

  // Any additional parameters given are added to the BEGINNING of the this.whatever method, since the callback should always be at the end, and options should always be second from last.

  if (typeof cbFunctionToCall == "function"){
    // console.log("Running with arguments: ");
    // console.dir(arguments);
    var args=Array.from(arguments);
    // console.log("arguments as an array: " + args);
    var theFunctionToCall=cbFunctionToCall;
    args.splice(0,2); // Splicing while making the array doesn't seem to work properly
    // console.log("args spliced: ");
    // console.dir(args);
    if (args.length<0){ // arguments were used
      return new Promise(function(resolve,reject){
        // console.log("promise created WITHOUT parameter");
        theFunctionToCall(options,function(err,result){
          if (err){
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    } else { // No arguments were used, so we should not expand them
      return new Promise(function(resolve,reject){
        // console.log("promise created WITH parameter(s)");
        theFunctionToCall(...args,options,function(err,result){
          // console.log("This is the err: " + err); //temp
          // console.log("This is the result: " + result); //temp
          if (err){
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    }
  }
  throw new Error("Invalid input given to simplePromisifyIt as functionToCall!");
}

function applyFunctionToArray(arrayInput,functionToRun){
  // cycles through an array, running a function on each value, replacing the original value.
  var theFunction=functionToRun;
  var outputArray=[];
  for (let i=0;i<arrayInput.length;i++){
    outputArray.push(theFunction(arrayInput[i]));
  }
  return outputArray;
}

function arrayMinus(theArray,val){ // Returns an array MINUS any values that match val.  Does not handle complicated comparisons.
  if (Array.isArray(theArray)){
    return theArray.filter(function(e){
      return e !== val;
    });
  }
  throw new Error("Please provide an array to the arrayMinus function!");
}

function getRandomAlphaNumericString(charLength){ // If no charlength given or it is invalid, it will output 10 and throw an error message. // Original code from: https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var outputLength=10;
  if (charLength){
    if (isNaN(parseInt(charLength))){
      console.error("ERROR: Invalid length given to getRandomAlphaNumeric function!  Set to default length of 10.  Here is what as given as input: " + charLength);
    } else {
      outputLength=parseInt(charLength);
    }
  } else {
    console.error("ERROR:  No charLength specified, using default of 10!");
  }
  for (var i = 0;i < outputLength;i++){
    text += possible.charAt(Math.floor(Math.random() * possible.length)).toString();
  }
  return text;
}

function isAlphaNumeric(testString){ // Only accepts string inputs
  if (typeof testString == "string"){
    return (/^[A-Za-z0-9]+$/).test(testString);
  }
  return false;
}

function capitalizeFirstLetter(inputStr){
  // returns the string back with the first letter capitalized and the rest lowercase.
  if (typeof inputStr == "string"){
    var returnVal=inputStr;
    var tempArray=[];
    if (inputStr.length > 0){
      returnVal=returnVal.toLowerCase();
      tempArray=returnVal.split("");
      tempArray[0]=tempArray[0].toUpperCase();
      returnVal=tempArray.join("");
    }
    return returnVal;
  }
  throw new Error("Invalid input given to function, capitalizeFirstLetter, as 'inputStr'!  Please provide a string!");
}
function repeatString(inputStr,repeatCount){ // This repeats a string a number of times
  if (typeof inputStr == "string" && typeof repeatCount=="number"){
    var outputString="";
    for (var i=0;i<repeatCount;i++){
      outputString+=inputStr;
    }
    return outputString;
  }
  return false; // input was invalid
}

function copyObj(obj) { // This will create a new object from an existing one, rather than linking to the original.  From:  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
  const copy = Object.create(Reflect.getPrototypeOf(obj)); // Ignore the ESLint warnings, it really doesn't know what it's talking about.  I looked into it, it's suggesting to use functions of Reflect that don't exist.
  const propNames = Object.getOwnPropertyNames(obj);
  propNames.forEach(function(name) {
    const desc = Reflect.getOwnPropertyDescriptor(obj, name);
    Reflect.defineProperty(copy, name, desc);
  });
  return copy;
}

function mergeObjs(obj1,obj2) { // This will create a new object by merging 2 objects
  return Object.assign({},obj1,obj2); // This should work fine, provided this never runs in IE for some reason.
  
  // Below is unnecessary, unless for some reason the code needs to run in IE..
  // the base object used is obj1.  Any values in obj2 will overwrite existing ones in obj1.
  // var outputObj=copyObj(obj1);
  // const propNames = Object.getOwnPropertyNames(obj2);
  // propNames.forEach(function(name) {
  //   const desc = Reflect.getOwnPropertyDescriptor(obj2, name);
  //   Reflect.defineProperty(outputObj, name, desc);
  // });
  // return outputObj;
}

function mapToJson(map) {
    return JSON.stringify([...map]);
}
function jsonToMap(jsonStr) {
    return new Map(JSON.parse(jsonStr));
}
function strMapToObj(strMap) {
    let obj = Object.create(null);
    for (let [k,v] of strMap) {
        // We don’t escape the key '__proto__'
        // which can cause problems on older engines
        obj[k] = v;
    }
    return obj;
}
function objToStrMap(obj) {
    let strMap = new Map();
    for (let k of Object.keys(obj)) {
        strMap.set(k, obj[k]);
    }
    return strMap;
}
function toBoolean(input){ // The main purpose of this function is to convert strings of "false" to literal false, rather than them being returned as truthy.
  if (input){ // First try a truthy
    return input=="false" ? false : Boolean(input); // Interpret a "false" string as false, otherwise convert to Boolean.  This will convert ANY input to true.
  } else { // any falsey gets turned to false
    return false;
  }
}
function toNumIfPossible(input){ // This also converts numbers from scientific notation to floating point
  if (typeof input != "undefined" && input != ""){ // This check is necessary since Number will create a 0 number using them
    var output=input;
    if (typeof input == "string"){
      output=input.replace(",","");
    }
    output=Number(output);
    if (isNaN(output)){
      return input;
    } else {
      return output;
    }
  }
  return input;
}
function toStringIfPossible(input,options){ // This also converts numbers from scientific notation to floating point
  if (typeof input !== "undefined" && input !== ""){ // This check is necessary since Number will create a 0 number using them
    try {
      var output=input.toString(options); // Sometimes the .toString() prototype will take options, such as for LocationObj
    } catch (err){
      return input;
    }
    if (typeof output == "string"){
      return output;
    }
    return input;
  }
  return input;
}


function isNum(input){ // This checks if the input is a number, either as a string or as a number.
  if (typeof toNumIfPossible(input) == "number"){
    return true;
  } else {
    return false;
  }
}

function getObjType(theObj){ // This will return the name of the constructor function that created the object
  if (typeof theObj == "object"){
    return theObj.constructor.name; // This is apparently a flawed method, but fuck it, it works for now.  Source:  https://stackoverflow.com/questions/332422/how-do-i-get-the-name-of-an-objects-type-in-javascript
  } else { // If it is NOT an object, then we should just return whatever type it is.
    return typeof theObj;
  }
}

function colorize(input){ // This uses inspect from util to add ANSI color codes to objects, strings, etc.  It should only be used for output to a user, not when storing values anywhere.
  return util.inspect(input,{colors:true});
}

function addNumToErrorObj(errorObj,number){
  // This adds an errno value to an existing error object
  // Example: addNumToErrorObj(new Error("This would normally have 0 as errno"),2)
  var returnObj=errorObj;
  returnObj["errno"]=number;
  return returnObj;
}

function copyArray(inputArray){ // This outputs a copy of an array rather than linking one array to another, which is what "var whatever = oldArray" seems to do in Javascript
  var outputArray=[];
  for (let i=0;i<inputArray.length;i++){
    outputArray.push(inputArray[i]);
  }
  return outputArray;
}

function isObjHasPropAndEquals(obj,property,valueCheck){
  if (typeof obj == "object"){
    return objHasPropAndEquals(obj,property,valueCheck);
  }
  return false;
}

function objHasPropAndEquals(obj,property,valueCheck){
  if (obj.hasOwnProperty(property)){
    if (obj[property] === valueCheck){
      return true;
    }
  }
  return false;
}
function removeOneFromArray(theArray,valToRemove){ // Only removes the first found instance of a value from an array
  if (Array.isArray(theArray)){
    var outputArray=copyArray(theArray);
    var indexNum=outputArray.indexOf(valToRemove);
    if (indexNum >= 0){
      outputArray.splice(indexNum,1);
    }
    return outputArray;
  }
  throw new Error("Invalid input given! Please provide an array!");
}


function subArrayFromAnother(arrayToSubtract,arrayToSubtractFrom){
  var outputArray=copyArray(arrayToSubtractFrom);
  var indexNum;
  for (let i=0;i<arrayToSubtract.length;i++){
    indexNum=outputArray.indexOf(arrayToSubtract[i]);
    if (indexNum !== -1){
      outputArray.splice(indexNum,1);
    }
  }
  return outputArray;
}
function findSameFromTwoArrays(arrayOne,arrayTwo){ // This compares two arrays, outputting a new array of shared values
  var outputArray=[];
  for (let i=0;i<arrayOne.length;i++){
    if (arrayTwo.indexOf(arrayOne[i]) !== -1){
      outputArray.push(arrayOne[i]);
    }
  }
  return outputArray;
}

function addUniqueToArray(theArray,val){ // Adds a value to an array only if it isn't already in it
  if (Array.isArray(theArray)){
    if (!isInArray(theArray,val)){
      theArray.push(val);
    }
    return theArray;
  }
  throw new Error("Input given was not an array!  Please provide an array!");
}

function isInArray(inputArray,valueToCompare){ // Returns true if the value is found in any part of an array
  if (Array.isArray(inputArray)){
    for (let i=0;i<inputArray.length;i++){
      if (inputArray[i] == valueToCompare){
        return true;
      }
    }
    return false;
  } else {
    throw new Error("Invalid input given to function, isInArray!  inputArray was not an array!");
  }
}

function isArrayAllEqualTo(inputArray,valueToCompare){
  // This is useful for when multiple operations are performed by a function and an array of results is returned.
  // Example of use:
  // if (isArrayAllEqualTo(resultsArray,true)){
  //     console.log("Looks like everything worked!")
  // } else {
  //     console.log("Oh no, something failed!");
  // }

  if (getObjType(inputArray) == "Array"){
    for (let i=0;i<inputArray.length;i++){
      if (inputArray[i] !== valueToCompare){
        return false;
      }
    }
    return true;
  } else {
    throw new Error("Invalid input given to function, isArrayAll!  inputArray was not an array!");
  }
}

function isObjEmpty(obj) {
    for(var key in obj) {
        if (obj.hasOwnProperty(key)){
          return false;
        }
    }
    return true;
}

function isArray(input){
  if (typeof input == "object"){ // objects, arrays, and maps are more complicated.  False will be returned if the object is empty.
    if (input instanceof Array){
      return true;
    }
  }
  return false;
}

function testIfInput(input){
  // This is to test if an input is given.  A "false" boolean value will cause true to be returned, because it was an input.  Empty objects will return false.
  if (typeof input === 'undefined' || input===null || input==="" || (typeof input=="number" && isNaN(input)) ) { // "" needs to be === otherwise it will trigger under a boolean false
    return false;
  } else if (typeof input == "boolean" || input == "0" || input === 0){ // boolean cannot be empty and numbers are input
    return true;
  } else if (typeof input == "object"){ // objects, arrays, and maps are more complicated.  False will be returned if the object is empty.
    if (input instanceof Array){
      if (input.length){
        return true;
      }
      return false;
    } else if (input instanceof Map){ // This check must be done before checking for an instanceof Object, since maps seem to hold true for that too.
      if (input.size){
        return true;
      }
      return false;
    } else if (input instanceof RegExp){ // This will handle RegExp objects.
      var inputToString=input.toString();
      if (inputToString == "/(?:)/" || inputToString == "" || typeof inputToString == 'undefined'){
        return false;
      }
      return true;
    } else if (input instanceof Object){ // This will handle custom objects the same.
      for(var key in input) {
        if (input.hasOwnProperty(key)){ // If there are any properties, then it is not empty.
          return true;
        }
      }
      return false;
    }
  }
  // This covers strings and other numbers with a general truthy check.  It's also a catchall for any other circumstance I might not have thought of to check above.
  if (input){ // This check is just a catch-all, it should always be true.
    return true;
  }
  return false; // This is to cover any other non-true value that I somehow didn't catch.
};

function isTrue(input){
  if (input == "true" || input === true){
    return true;
  }
  return false;
}

function isFalse(input){
  if (input == "false" || input === false){
    return true;
  }
  return false;
}

function trueOrFalse(input){ // This allows string or boolean true or false values.  Returns undefined if neither true nor false.
  var returnVal;
  if (isTrue(input)){
    returnVal=Boolean(true);
  } else if (isFalse(input)){
    returnVal=Boolean(false);
  }
  return returnVal;
}
function toTrueOrFalseIfPossible(input){ // This allows string or boolean true or false values.  Returns undefined if neither true nor false.
  var returnVal=trueOrFalse(input);
  if (typeof returnVal != "undefined"){
    return returnVal;
  }
  return input;
}

function isTrueOrFalse(input){ // Returns true if the input value is either true or false, either string or boolean.
  if (isTrue(input) || isFalse(input)){
    return true;
  }
  return false;
}

function returnLineMatch(input,matchRegExp,replaceRegExp){ // This will parse through multiple lines and only return the first line that matches a regex pattern
  // input can be an Array OR a blob of text that needs to be separated by new lines
  // matchRegExp is mandatory.  This is the matching line that will be returned.
  // replaceRegExp is optional.  It will replace the matching value found with nothing (subtracting from the found line).  If more arguments are specified, they are treated as additional replaceRegExp arguments and applied sequentially

  var matchRegExpToUse=new RegExp(matchRegExp); // if matchRegExp is not a regExp, then create a new one.
  var replaceRegExpToUse;
  var resultArray=[];
  if (isArray(input)){
    resultArray=input;
  } else {
    resultArray=input.trim().split("\n");
  }
  var theTest;
  for (let i = 0;i < resultArray.length;i++) {
    theTest=resultArray[i].match(matchRegExpToUse);
    if (theTest !== null){ // A result was found
      theTest=theTest.toString();
      for (let c=2;c < arguments.length;c++){ // Cycles through any 3rd or greater arguments
        if (testIfInput(arguments[c])){
          replaceRegExpToUse=new RegExp(arguments[c]);
          theTest=theTest.replace(replaceRegExpToUse,"");
        }
      }
      if (typeof theTest == "string"){
        return theTest; // This breaks out of the loop
      }
    }
  }
  return theTest; // Returns undefined if no match was found.
}
function getOption(options,optionToLookFor,whatToUseIfNoOption){ // This is used to parse options given to a command.
  if (typeof options == "object"){
    if (options.hasOwnProperty(optionToLookFor)){ // This is redundant
      if (testIfInput(options[optionToLookFor])){ // This ensures the value is not empty
        return options[optionToLookFor]; // Perhaps this should validate that the entry can be converted to a string and is not an object or array, but meh.
      }
    }
  }
  return whatToUseIfNoOption;
}
function addOption(options,parameter,value){
  var optionsToReturn;
  if (typeof options=="object"){
    optionsToReturn=options;
  } else {
    optionsToReturn={};
  }
  optionsToReturn[parameter]=value;
  return optionsToReturn;
}

function isEquivalent(input,input2){
  // areObjsEquivalent,,,areFunctionsEqual

  if (Array.isArray(input)){
    console.log("Testing arrays..");
    return areArraysEqual(input,input2);
  } else if (input instanceof Map){
    console.log("Testing maps..");
    return areMapsEqual(input,input2);
  } else if (input instanceof Date){
    console.log("Testing dates..");
    return areDatesEqual(input,input2);
  } else if (typeof input == "function"){
    console.log("Testing functions..");
    return areFunctionsEqual(input,input2);
  } else if (typeof input == "object"){
    console.log("Testing objects..");
    return areObjsEquivalent(input,input2);
  } else if (input !== input2) {
    console.log("Testing everything else..");
    if (!(isNaN(input) && isNaN(input2))){
      return false;
    }
  }
  return true; // They were both NaN, null, or strictly equal to each other
}

function areObjsEquivalent(a, b) { // This should NOT be used on objects that have infinite recursion, otherwise it will cause an infinite loop!
  // Create arrays of property names
  var aProps = Object.getOwnPropertyNames(a);
  var bProps = Object.getOwnPropertyNames(b);
  // If number of properties is different,
  // objects are not equivalent
  if (aProps.length != bProps.length) {
      return false;
  }
  for (var i=0;i<aProps.length;i++){
    var propName = aProps[i];
    // If values of same property are not equal,
    // objects are not equivalent
    if (!b.hasOwnProperty(propName)){
      return false;
    }
    // We need to test things differently depending on what the value for the elemnt is.
    if (Array.isArray(a[propName])){ // The value is an array
      if (!areArraysEqual(a[propName],b[propName])){
        return false;
      }
    } else if (typeof a[propName] == "function"){
      if (!areFunctionsEqual(a[propName],b[propName])){
        return false;
      }
    } else if (a[propName] instanceof Map){ // The value is a Map object
      if (!areMapsEqual(a[propName],b[propName])){
        return false;
      }
    } else if (a[propName] instanceof Date){ // It's a Date object
      if (!areDatesEqual(a[propName],b[propName])){
        return false;
      }
    } else if (typeof a[propName] == "object"){ // For objects, we can use a recusion check.  Warning:  This can cause an infinite loop if the object has infinite recursion
      if (!areObjsEquivalent(a[propName],b[propName])){
        return false;
      }
    } else if (a[propName] !== b[propName]){ // Must be a string or number
      if (!(typeof a[propName] == "number" && isNaN(a[propName]) && typeof b[propName] == "number" && isNaN(b[propName]))){
        return false;
      }
    }
  }
  // If we made it this far, objects
  // are considered equivalent
  return true;
  // Source: http://adripofjavascript.com/blog/drips/object-equality-in-javascript.html
}

function areArraysEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)){
    return false;
  }
  if (arr1.length !== arr2.length){ // Check if the arrays are the same length
    return false;
  }
  for (let i=0;i<arr1.length;i++) { // Check if all items exist and are in the same order
    // The array may contain other arrays, Map objects, or objects, so we need to differentiate
    if (Array.isArray(arr1[i])){ // The value is an array
      if (!areArraysEqual(arr1[i],arr2[i])){
        return false;
      }
    } else if (typeof arr1[i] == "function"){
      if (!areFunctionsEqual(arr1[i],arr2[i])){
        return false;
      }
    } else if (arr1[i] instanceof Map){ // It's a map object
      if (!areMapsEqual(arr1[i],arr2[i])){
        return false;
      }
    } else if (arr1[i] instanceof Date){ // It's a Date object
      if (!areDatesEqual(arr1[i],arr2[i])){
        return false;
      }
    } else if (typeof arr1[i]=="object"){ // It's an object
      if (!areObjsEquivalent(arr1[i],arr2[i])){
        return false;
      }
    } else if (arr1[i] !== arr2[i]){ // It must be a string or number
      if (!(typeof arr1[i] == "number" && isNaN(arr1[i]) && typeof arr2[i] == "number" && isNaN(arr2[i]))){
        return false;
      }
    }
  }
  return true;
};

function areMapsEqual(map1, map2) {
  if (!(map1 instanceof Map) || !(map2 instanceof Map)){
    return false;
  }
  var testVal;
  if (map1.size !== map2.size) {
      return false;
  }
  for (var [key, val] of map1) {
    // in cases of an undefined value, make sure the key
    // actually exists on the object so there are no false positives

    if (!map2.has(key)){
      return false;
    }
    testVal = map2.get(key);
    // We need to test values based on what type they represent
    if (Array.isArray(val)){ // It's an array
      if (!Array.isArray(testVal)){
        return false
      } else if (!areArraysEqual(val,testVal)){
        return false;
      }
    } else if (typeof val == "function"){
      if (!areFunctionsEqual(val,testVal)){
        return false;
      }
    } else if (val instanceof Map){ // It's a map object
      if (!(testVal instanceof Map)){
        return false;
      } else if (!areMapsEqual(val,testVal)){
        return false;
      }
    } else if (val instanceof Date){ // It's a Date object
      if (!areDatesEqual(val,testVal)){
        return false;
      }
    } else if (typeof val=="object"){ // It's an object
      if (typeof testVal != "object"){
        return false;
      } else if (!areObjsEquivalent(val,testVal)){
        return false;
      }
    } else if (testVal !== val) { // It must be a string or number
      if (!(typeof testVal == "number" && isNaN(testVal) && typeof val == "number" && isNaN(val))){
        return false;
      }
    }
  }
  return true;
}

function areFunctionsEqual(func1,func2){
  if (typeof func1 == "function" && typeof func2 == "function"){
    var func1String=func1.toString();
    var func2String=func2.toString();
    var func1Cut=func1String.substring(func1String.indexOf("("));
    var func2Cut=func2String.substring(func2String.indexOf("("));
    return func1Cut === func2Cut;
  }
  return false;
}

function areDatesEqual(date1,date2){
  if (!(date1 instanceof Date) || !(date2 instanceof Date)){
    return false;
  }
  if (date1.getTime() != date2.getTime()){
    return false;
  }
  return true;
}
