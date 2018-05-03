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

module.exports={
  mapToJson,
  jsonToMap,
  strMapToObj,
  objToStrMap,
  toBoolean,
  toNumIfPossible,
  getObjType
};
