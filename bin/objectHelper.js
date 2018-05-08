// These are helper functions to assist with objects and values.  New objects are not created here.  See the "objectCreator.js" file for that.

module.exports={ // Always put module.exports at the top so circular dependencies work correctly.
  mapToJson, // this converts a map with all STRING properties to a Json output
  jsonToMap, // This converts a json input to object output
  strMapToObj, // This converts a map with ALL string properties to an object
  objToStrMap, // This converts an object to a map
  toBoolean, // This converts a value to Boolean, handling "false" string as false
  toNumIfPossible, // This converts a value to a number if possible, otherwise returns the value back.
  getObjType, // This checks the object.constructor.name value for any object.  All constructor names should be capitalized.  Otherwise returns the typeof value, which should be lowercase.
  "type":getObjType, // This is just an alias.. not sure why I did this..
  colorize, // This adds ANSI values to colorize text
  addNumToErrorObj, // This adds an errno element to an error object equal to the number specified.
  copyArray, // This copies an array rather than linking a value to the same array.
  copyObj,
  isArrayAllEqualTo, // Compares all values in an array to a single value.  This is used to process arrays of true/false values, where each value indicates a success or failure of an individual operation.
  subArrayFromAnother, // Subtracts any values that exist in one array from another.
  findSameFromTwoArrays, // Finds whatever values exist in both arrays
  isObjHasPropAndEquals, // Checks if input is an object, has a property, and that property strictly equals a value
  objHasPropAndEquals // For when you have many property checks and you've already ensured what is being fed is an object
};

const util=require('util');
const path=require('path');
const binFolder=path.resolve(__dirname,"../bin/");

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
    return input=="false" ? false : Boolean(input); // Interpret a "false" string as false, otherwise convert to Boolean
  } else {
    return false;
  }
}
function toNumIfPossible(input){
  var output=Number(input);
  if (isNaN(output)){
    return input;
  }
  return output;
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
      if (inputArray[0] !== valueToCompare){
        return false;
      }
    }
    return true;
  } else {
    throw new Error("Invalid input given to function, isArrayAll!  inputArray was not an array!");
  }
}
