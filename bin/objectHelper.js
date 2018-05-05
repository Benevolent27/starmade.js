
// These are helper functions to assist with objects and values.  New objects are not created here.  See the "objectCreator.js" file for that.
const util=require('util');

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
  return input=="false" ? false : Boolean(input);
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
    return theObj.constructor.name; // This is apparently a deeply flawed method, but fuck it, it works for now.  Source:  https://stackoverflow.com/questions/332422/how-do-i-get-the-name-of-an-objects-type-in-javascript
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

module.exports={
  mapToJson,
  jsonToMap,
  strMapToObj,
  objToStrMap,
  toBoolean,
  toNumIfPossible,
  getObjType,
  "type":getObjType,
  colorize,
  addNumToErrorObj,
  copyArray,
  isObjHasPropAndEquals, // Checks if input is an object, has a property, and that property strictly equals a value
  objHasPropAndEquals // For when you have many property checks and you've already ensured what is being fed is an object
};
