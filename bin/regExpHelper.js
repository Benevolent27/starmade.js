
// This script should be where all common regExp patterns are stored.
// TODO: Add verifiers functions and patterns for:
// verifying entity names (no disallowed symbols or spaces at beginning/end)
// full uid checker
// convert to full UID, using a SQL query on a UID to add it if needed.

var playerPrefixes=["ENTITY_PLAYERCHARACTER_","ENTITY_PLAYERSTATE_"];
var uidPrefixes=["ENTITY_SHOP_","ENTITY_SPACESTATION_","ENTITY_FLOATINGROCK_","ENTITY_PLANET_","ENTITY_SHIP_","ENTITY_FLOATINGROCKMANAGED_","ENTITY_CREATURE_","ENTITY_PLANETCORE_","ENTITY_PLAYERCHARACTER_","ENTITY_PLAYERSTATE_"];
var sectorProtections=["nofploss","noindications","noexit","noenter","protected","peace"]; // If a new sector chmod value comes out, it can be added to the end of the beginning of this array.

var uidPrefixesRegExp=createMultiRegExpFromArray(uidPrefixes,"^");
function createMultiRegExpFromArray(inputArray,prefix,suffix){
  // This will cycle through an array of values and create regex patterns that searches for each value.  Adding a prefix or suffix is optional.
  var returnVal;
  var prefixToUse=prefix ? prefix : ""; // We are setting it to "" because we don't want the word "undefined" to appear in the regex patterns and we would want to avoid having to create a complicated if/then/else tree if we can help it.
  var suffixToUse=suffix ? suffix : "";
  for (let i=0;i<inputArray.length;i++){
    if (returnVal){
      returnVal+="|" + prefixToUse + inputArray[i] + suffixToUse;
    } else {
      returnVal=prefixToUse + inputArray[i] + suffixToUse;
    }
  }
  return new RegExp(returnVal);
}

function stripFullUIDtoUID(input){
  return input.replace(uidPrefixesRegExp,"").toString();
}

function isPlayerUID(inputStr){ // This checks a full UID to see if it follows the pattern of a player's UID
  // Note this will return false if given a player name.
  const playerPrefixesRegExp=createMultiRegExpFromArray(playerPrefixes,"^");
  return playerPrefixesRegExp.test(inputStr);
}

if (require.main.filename == __filename){ // This is so it only runs based on arguments IF being ran by itself and not being required into another script.  This is for testing purposes.
  var theArguments=process.argv.slice(2);
  if (theArguments[0]){
    console.log(theArguments[0] + " result: " + uidPrefixesRegExp.test(theArguments[0]));
  } else {
    console.log("No test value given!");
  }
}

function isAlphaNumeric(testString){
  return "/^[A-Za-z0-9]+$/".test(testString);
}

module.exports={
  uidPrefixes,
  stripFullUIDtoUID,
  isPlayerUID,
  sectorProtections, // Array of protections possible.  Will affect other scripts that utilize this list.
  "uidPrefixesReg":uidPrefixesRegExp,
  "createMultiRegFromArray": createMultiRegExpFromArray,
  isAlphaNumeric
}
