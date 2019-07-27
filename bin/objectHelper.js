// These are helper functions to assist with objects and values.  New objects are not created here.  See the "objectCreator.js" file for that.

module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  mapToJson, // this converts a map with all STRING properties to a Json output
  jsonToMap, // This converts a json input to object output
  strMapToObj, // This converts a map with ALL string properties to an object
  objToStrMap, // This converts an object to a map
  toBoolean, // This converts a value to Boolean, handling "false" string as false
  toNumIfPossible, // This converts a value to a number if possible, otherwise returns the value back.
  toStringIfPossible, // This converts a value to a string if possible, otherwise returns the value back.
  getObjType, // This checks the object.constructor.name value for any object.  All constructor names should be capitalized.  Otherwise returns the typeof value, which should be lowercase.
  "type":getObjType, // This is just an alias.. not sure why I did this..
  colorize, // This adds ANSI values to colorize text
  addNumToErrorObj, // This adds an errno element to an error object equal to the number specified.
  copyArray, // This copies an array rather than linking a value to the same array.
  copyObj,
  isAlphaNumeric,
  isArrayAllEqualTo, // Compares all values in an array to a single value.  This is used to process arrays of true/false values, where each value indicates a success or failure of an individual operation.
  isInArray, // Checks an array for a value.  Usage:  isInArray(inputArray,ValueToCompare)
  subArrayFromAnother, // Subtracts any values that exist in one array from another.
  findSameFromTwoArrays,  // Finds whatever values exist in both arrays
  getOption, // Processes options given to objects {"whatever":true}.  getOption(input,elementToLookFor,whatToUseIfNotFound)
  isObjHasPropAndEquals, // Checks if input is an object, has a property, and that property strictly equals a value
  objHasPropAndEquals, // For when you have many property checks and you've already ensured what is being fed is an object
  isObjEmpty, // Checks for empty object
  testIfInput, // Checks if any valid, non-empty input is given.  Returns false for empty objects, true for any boolean value.
  isTrue, // Only string "true" or boolean true will return true
  isFalse, // Only string "false" or boolean false will return true
  trueOrFalse, // This allows string or boolean true or false values, returning boolean.  Returns undefined if neither true nor false.
  isTrueOrFalse, // This returns true if the input is either true or false as a string or boolean, false for anything else.
  isNum, // This returns true if the value is a number, even if it is a string.
  isArray, // This returns true if an array, even if it is empty.
  returnLineMatch,
  repeatString,
  getRandomAlphaNumericString,
  arrayMinus
};

const util=require('util');
const path=require('path');
const binFolder=path.resolve(__dirname,"../bin/");


function arrayMinus(theArray,val){ // Returns an array MINUS any values that match val
  if (val && theArray){
    return theArray.filter(function(e){
      return e !== val;
    });
  }
  throw new Error("Insufficient parameters given to arrayMinus function!");
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
  const copy = Object.create(Object.getPrototypeOf(obj)); // Ignore the ESLint warnings, it really doesn't know what it's talking about.  I looked into it, it's suggesting to use functions of Reflect that don't exist.
  const propNames = Object.getOwnPropertyNames(obj);
  propNames.forEach(function(name) {
    const desc = Object.getOwnPropertyDescriptor(obj, name);
    Object.defineProperty(copy, name, desc);
  });
  return copy;
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
    var output=Number(input);
    if (isNaN(output)){
      return input;
    } else {
      return output;
    }
  }
  return input;
}
function toStringIfPossible(input){ // This also converts numbers from scientific notation to floating point
  if (typeof input != "undefined" && input != ""){ // This check is necessary since Number will create a 0 number using them
    try {
      var output=input.toString();
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

function isInArray(inputArray,valueToCompare){ // Returns true if the value is found in any part of an array
  if (getObjType(inputArray) == "Array"){
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
    returnVal=true;
  } else if (isFalse(input)){
    returnVal=false;
  }
  return returnVal;
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
  // replaceRegExp is optional.  It will replace the value found with nothing.  If more arguments are specified, they are treated as additional replaceRegExp arguments and applied sequentially
  
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

