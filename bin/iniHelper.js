module.exports={
  "getFileAsObj":getIniFileAsObj,
  "writeObjToFile":writeIniObjToIni,
  "getVal":getIniValue,
  "getValFromStr":removeIniCommentsFromString,
  "setVal":changeIniValue,
  "renVar":renameIniVariable,
  "getComment":getIniComment,
  "getCommentFromStr":getIniCommentFromString,
  "remCommentFromStr":removeIniCommentsFromString,
  "changeValFromStr":changeIniValueFromString,
  "varExists":iniVariableExists,
  "getVarsWhereVal":getVariablesWhereValueEqualsString
}

// TODO: Make cb/promise versions instead of relying on sync only

const fs=require('fs');
const path=require('path');
const binFolder=path.resolve(__dirname,"../bin/");
var installAndRequire = require(path.join(binFolder, "installAndRequire.js"));
const objectHelper=require(path.join(binFolder, "objectHelper.js"));
const {toStringIfPossible,testIfInput}=objectHelper;
const ini = installAndRequire('ini',"^1.3.5"); // https://www.npmjs.com/package/ini Imports ini files as objects.
// Notes: The ini npm package is mishandles # style comments, removing them, but leaves // type comments as part of the value.
// The goals of this helper script are:
// 1. To modify how the ini package loads ini files and saves them, to correctly preserve # style comments
// 2. Helper functions assist with managing comments of both varieties correctly.
//
// TODO:
// Handle /* and */ sort of comments if necessary (or whatever format is used by the StarMade devs).
// Test the getVariablesWhereValueEqualsString function and expand it so that it can use regex objects.
// Create a iniVariableExists function.

function iniVariableExists(iniObj,variableToTest){
  var variableToTestToUse=toStringIfPossible(variableToTest);
  if (typeof iniObj == "object" && typeof variableToTestToUse == "string"){
    return iniObj.hasOwnProperty(variableToTestToUse);
  } else {
    throw new Error("ERROR: Invalid parameters given to iniVariableExists function!");
  }
}

function getVariablesWhereValueEqualsString(iniObj,stringToMatch){
  // Code originally based on top answer here: https://stackoverflow.com/questions/921789/how-to-loop-through-a-plain-javascript-object-with-the-objects-as-members
  // Currently this only supports string matching, but I'd like to add regex pattern matching or feeding of a function as the match string
  var stringToMatchToUse=toStringIfPossible(stringToMatch);
  if (typeof iniObj == "object" && typeof stringToMatchToUse == "string"){
    var outputArray=[];
    var valToCheck="";
    for (var key in iniObj) {
      if (iniObj.hasOwnProperty(key)) { // This is to exclude prototype properties
        valToCheck = removeIniCommentsFromString(iniObj[key]);
        if (valToCheck == stringToMatchToUse){
          outputArray.push(key)
        }
      }
    }
    return outputArray;
  } else {
    return new Error("ERROR: Invalid parameters given to function, getVariablesWhereValueEqualsString!");
  }
}

function getIniFileAsObj(iniFile){ // This loads an ini file as an object
  return ini.parse(fs.readFileSync(iniFile, 'utf-8' ).replace(/[#]/g,"\\#")); // We need to escape the # characters because otherwise the ini.parse removes them and all text that happens after them.. Annoying if we are preserving the comments!
}
function writeIniObjToIni(theObj,iniFileToWrite){ // This sync writes an ini object to an ini file
  return fs.writeFileSync(iniFileToWrite, ini.stringify(theObj));
}
function removeIniCommentsFromString(text){ // This removes comments from a string
  var textToUse=toStringIfPossible(text);
  // Next line is depreciated as it would see / as a comment, but it should only see double // as comments.
  // return text.match(/^[^/#]*/).toString().trim();
  return textToUse.replace(/(#.*$)|([/]{2}.*$)/g,"").toString().trim(); // Does not preserve spaces in front or behind string.

}
function getIniValue(iniObj,variable){ // Rather than using removeIniComments on a specific value, this can be used to pull the value.  This is mostly for readability but also to handle errors.
  var varToUse=toStringIfPossible(variable);
  if (typeof iniObj == "object" && typeof varToUse == "string"){
    // TODO This needs to use typeof to determine that iniObj is, in fact, an object rather than undefined or something else.
    if (iniObj.hasOwnProperty(varToUse)){
      return removeIniCommentsFromString(iniObj[varToUse]);
    } else {
      console.error("ERROR: Invalid variable in Ini object - does not exist!");
      // return new Error("ERROR: Invalid variable in Ini object (" + iniObj.constructor.name + ") - does not exist!");
      var undef;
      return undef;
    }
  } else {
    throw new Error("ERROR:  Insufficient parameters given to getIniValue!")
  }
}
function changeIniValue(iniObj,iniVariable,newIniValue){
  // This function will change an ini object's variable to have a new value, preserving comments
  // Example of usage:  changeIniObjValue(iniObject,"theVariable","New Words and such")
  var iniVariableToUse=toStringIfPossible(iniVariable);
  var newIniValueToUse=toStringIfPossible(newIniValue);
  if (typeof iniObj == 'object' && typeof iniVariableToUse == 'string' && typeof newIniValueToUse == 'string'){
    try {
      iniObj[iniVariableToUse]=changeIniValueFromString(iniObj[iniVariableToUse],newIniValueToUse);
      return true;
    } catch (err) {
      console.error("ERROR:  Problem while changing variable of Ini object!");
      return false;
    }
  } else {
    console.error("ERROR: Not enough arguments given to changeIniObjValue!");
    return false
  }
}
function renameIniVariable(iniObj,oldVar,newVar){
  var oldVarToUse=toStringIfPossible(oldVar);
  var newVarToUse=toStringIfPossible(newVar);
  if (typeof iniObj == "object" && typeof oldVarToUse == "string" && typeof newVarToUse == "string"){
    if (oldVarToUse == newVarToUse){
      return false; // Cannot rename because the oldVar is the same as the new!  Not technically an error, but a sloppy call.
    } else if (iniObj.hasOwnProperty(oldVarToUse)){
        // This is flawed and needs to be changed.
        // iniObj[newVarToUse]=iniObj[oldVarToUse]; // Assign the old variable to the new
        const desc = Reflect.getOwnPropertyDescriptor(iniObj, oldVarToUse); // This should be tested
        Reflect.defineProperty(iniObj,newVarToUse,desc);
        Reflect.deleteProperty(iniObj,oldVarToUse); // Delete the old variable in an ESLinter friendly way
        return true; // Indicate we did something, yay!
    } else {
      return new Error("ERROR: Object did not have property, '" + oldVarToUse + "'!")
    }
  } else {
    return new Error("ERROR: Invalid parameters given to function renameIniVariable!");
  }
}

function getIniComment(iniObj,iniVariable){
  var iniVariableToUse=toStringIfPossible(iniVariable);
  if (typeof iniObj == 'object' && typeof iniVariableToUse == 'string'){
    if (iniObj.hasOwnProperty(iniVariableToUse)){
      return getIniCommentFromString(iniObj[iniVariableToUse]);
    } else {
      return new Error("ERROR: Object, '" + iniObj.constructor.name + "' did not have property, '" + iniVariableToUse + "'!")
    }
  } else {
    return new Error("ERROR: Insufficient parameters given to getIniComment!");
  }
}
function getIniCommentFromString(text,commentSymbols){ // Gets just the comment from a string excerpt from an Ini obj.  Comment symbols are optional.
    var textToUse=toStringIfPossible(text);
    var commentSymbolsToUse;
    if (testIfInput(commentSymbols)){
      commentSymbolsToUse=commentSymbols;
    } else {
      commentSymbolsToUse=["//","#"]; // By default we are going to be reading from ini files that use // or # as their comments.
    }
    var regexArray=[];
    for (let i=0;i<commentSymbolsToUse.length;i++){
      regexArray.push(new RegExp(" *" + commentSymbolsToUse[i] + "+(.+)")); // Preserves spaces in front of the comment
    }
    var valToBeat="";
    for (let e=0;e<regexArray.length;e++){
      // console.log("Working with regex pattern: " + regexArray[e]);
      if (regexArray[e].exec(textToUse)){
        if (!valToBeat){
          valToBeat=regexArray[e].exec(textToUse)[0];
        } else if (valToBeat.length < regexArray[e].exec(textToUse)[0].length){
          valToBeat=regexArray[e].exec(textToUse)[0];
        }
      }
    }
    return valToBeat;
}
function changeIniValueFromString(stringWComments,newVal){
    // This function takes the existing value + comment, changing the value and returns it with the comment
    var stringWCommentsToUse=toStringIfPossible(stringWComments);
    var newValToUse=toStringIfPossible(newVal);
    if (typeof stringWCommentsToUse == "string" && typeof newValToUse == "string"){
      return newValToUse + getIniCommentFromString(stringWCommentsToUse);
    }
    throw new Error("ERROR: Please specify a string from an ini object and a new value to replace the old one with!");
}


