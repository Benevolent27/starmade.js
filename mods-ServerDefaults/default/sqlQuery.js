// Updated to use installObj

module.exports={ // top exporting to allow circular dependencies to work.
  SqlQueryObj, // DO NOT USE THE OBJECT DIRECTLY FROM THIS FILE, USE THE objectCreator.js script for that to avoid unsupported circular dependencies, since that script uses export injection to provide this object.
  mapifyColumnsAndAllData, // This takes an array with columns, and another array with all the data, spitting out an array of maps
  sqlQuery,
  simpleSqlQuery
};

// TODO: Discontinue the SqlQuery object in favor of the sqlQuery function and merge this into the starNet.js file.

// TODO:  Add callback forms for all StarNet.jar queries
const path=require('path');
const starNet=require(path.join(__dirname,"starNet.js"));
const {starNetSync,starNetCb,starNetVerified,verifyResponse}=starNet;

const mainFolder=path.dirname(require.main.filename); // This should be where the starmade.js is, unless this script is ran by itself.
const mainBinFolder=path.join(mainFolder,"bin");
const objectHelper=require(path.join(mainBinFolder,"objectHelper.js"));

// TODO: Set up the check where if there are no columns returned, the query must have been invalid
// Set up aliases
const {addNumToErrorObj,simplePromisifyIt,toStringIfPossible}=objectHelper;
// var {getOption,testIfInput,}=objectHelper;


if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.
  // This script must be provided with the ip, port, and superadmin password.
  // TODO: Make it so this script can look up the super admin password for the current server.
  try {
    var theArgsArray=process.argv;
    if (theArgsArray[0]=='node'){
      theArgsArray.shift();
    }
    theArgsArray.shift();
    var theIP=toStringIfPossible(theArgsArray[0].match(/^[^:]*/));
    var thePort=toStringIfPossible(theArgsArray[0].match(/[^:]*$/));
    var superAdminPassword=theArgsArray[1];
    theArgsArray.shift();
    theArgsArray.shift();
    var theCommand=theArgsArray.join(" ");
    simpleSqlQuery(theCommand,{"ip":theIP,"port":thePort,"superAdminPassword":superAdminPassword},function(err,result){
      if (err){
        throw err;
      }
      console.log(result); // Consider using console.table instead of console.log
    });
  } catch (err){
    console.log("ERROR:  Invalid input given!");
    console.log(`Usage: ${__filename} ip:port "sqlquery goes here"`);
  }
}
var installObj = global.getInstallObj(__dirname);
var thisConsole=installObj.console;

function getSQLquery(query){ // This will preprocess a query so that it should work with starNet.js to run correctly.
  // This should correct for improper quote types.
  // For example if someone tries to use a ' character instead of a " character when performing "like" operators
  // e.g. SELECT * FROM PUBLIC.SECTORS WHERE UID LIKE "myShip%"
  // This should convert to: SELECT * FROM PUBLIC.SECTORS WHERE UID LIKE 'myShip%'
  var queryToUse;
  if (typeof query == "string"){
    queryToUse=query.replace(/"/g,"'").toString();
    return "/sql_query \"" + queryToUse + "\"";
  } else {
    throw new Error("Invalid parameter given as query to getSQLquery function!");
  }
}


function simpleSqlQuery(sqlQuery,options,cb){ // Needs testing // Also the code here can be cleaned up since it's a bit wonky
  if (typeof cb=="function"){
    if (typeof sqlQuery == "string" && sqlQuery != ""){
      var queryToUse=getSQLquery(sqlQuery);
      return starNetVerified(queryToUse,options,function(err,results){
        if (err){
          return cb(err,results);
        }
        var tempArray=[]; // Let's clean up the results so it only contains the relevant SQL lines
        tempArray=results.split("\n");
        while (tempArray.length > 0 && !(/^RETURN: \[SERVER, SQL#/).test(tempArray[0])){
          tempArray.shift();
        }
        // Trim the bottom
        while (tempArray.length > 0 && !(/^RETURN: \[SERVER, SQL#/).test(tempArray[tempArray.length-1])){
          tempArray.pop();
        }
        for (let i=0;i<tempArray.length;i++){
          tempArray[i]=tempArray[i].replace(/(^RETURN: \[SERVER, SQL#[0-9]+: ")|(", 0\]$)/g,"").split('";"');
        }
        var theResults=new ReturnObj(tempArray); // Splits the 2 part array into an object
        if (theResults["columns"]){ // columns should ALWAYS return, even as an empty array
          if (theResults["columns"].length > 0){
            return cb(null,objectifyColumnsAndAllData(theResults["columns"],theResults["data"]));
          } else {
            return cb(new Error("Invalid SQL query!"),null);
          }
        } else { // If the columns field is undefined then, then it means the sql query was invalid.
          return cb(addNumToErrorObj(new Error("Invalid SQL query!"),1),null);
        }
      });
    } else {
      return cb(new Error("Invalid input given to sqlQuery as 'sqlQuery'!"),null);
    }
  }
  return simplePromisifyIt(simpleSqlQuery,options,sqlQuery);
}


function sqlQuery(sqlQuery,options,cb){ // Needs testing // Also the code here can be cleaned up since it's a bit wonky
  if (typeof sqlQuery == "string" && sqlQuery != ""){
    var queryToUse=getSQLquery(sqlQuery);
    return starNetCb(queryToUse,options,function(err,resultsStr){
      var returnObj={};
      if (err){
        console.error("StarNet ERROR when performing sqlQuery on query: " + queryToUse);
        return cb(err,resultsStr);
      }
      if (!verifyResponse(resultsStr)){
        var theError="StarNet failed when performing sqlQuery, '" + sqlQuery + "'!";
        console.error(theError);
        return cb(new Error(theError),resultsStr);
      }
      var tempArray=[]; // Let's clean up the results so it only contains the relevant SQL lines
      tempArray=resultsStr.split("\n");
      while (tempArray.length > 0 && !(/^RETURN: \[SERVER, SQL#/).test(tempArray[0])){
        tempArray.shift();
      }
      // Trim the bottom
      while (tempArray.length > 0 && !(/^RETURN: \[SERVER, SQL#/).test(tempArray[tempArray.length-1])){
        tempArray.pop();
      }
      for (let i=0;i<tempArray.length;i++){
        tempArray[i]=tempArray[i].replace(/(^RETURN: \[SERVER, SQL#[0-9]+: ")|(", 0\]$)/g,"").split('";"');
      }
      var theResults=new ReturnObj(tempArray); // Splits the 2 part array into an object
      if (theResults){ // There should always be a result array, unless some unspeakably horribly thing happens
        if (theResults["columns"]){ // columns should ALWAYS return, even as an empty array, unless some unspeakably horrible thing happens
          if (theResults["columns"].length > 0){
            // Even if there are no results found, a valid SQL query ALWAYS returns the columns
            returnObj["error"]=false;
            // returnObj["mapArray"]=mapifyColumnsAndAllData(theResults["columns"],theResults["data"]);
            // returnObj["objArray"]=convertMapArrayToObjectArray(returnObj.mapArray);

            returnObj["objArray"]=objectifyColumnsAndAllData(theResults["columns"],theResults["data"]);
            
            returnObj["columns"]=theResults["columns"];
            // I'm changing this to be a value rather than function, because it occured to me that if there are 0 results, the map should be empty
            // returnObj.columns=function(){
            //   var returnArray=[];
            //   if (returnObj.mapArray.length > 0){
            //     returnArray=[...returnObj.mapArray[0].keys()];
            //   }
            //   return returnArray;
            // }
          } else {
            // If there were 0 columns, then it means the sql query was invalid.
            returnObj["error"]=addNumToErrorObj(new Error("Invalid SQL query!"),1);
          }
        } else {
          // If the columns field is undefined then, then it means the sql query was invalid.
          returnObj["error"]=addNumToErrorObj(new Error("Invalid SQL query!"),1);
        }
      }
      return cb(null,returnObj); // Should never be empty.  It should at least list the columns.
    });
  } else {
    return cb(new Error("Invalid input given to sqlQuery as 'sqlQuery'!"),null);
  }
}

function SqlQueryObj(sqlQuery){ // TODO:  Discontinue this object since it relies on Sync methods in preference to the sqlQuery function.
  this.query=sqlQuery;
  this.time=Date.now();
  // thisConsole.log("Running sql query: " + sqlQuery);
  this.mapArray=[]; // This is modified later in the script, but declared here in case there is an error.
  var resultsStr=starNetSync(getSQLquery(sqlQuery));
  if (verifyResponse(resultsStr) == false){
    // There was an error of some kind
    this.error=addNumToErrorObj(new Error("StarNet command failed!"),2);
  } else {
    var tempArray=[]; // Let's clean up the results so it only contains the relevant SQL lines
    tempArray=resultsStr.split("\n");
    // thisConsole.log("\nBefore Trimming: ");
    // console.dir(tempArray);
    // Trim the top
    while (tempArray.length > 0 && !(/^RETURN: \[SERVER, SQL#/).test(tempArray[0])){
      tempArray.shift();
    }
    // Trim the bottom
    while (tempArray.length > 0 && !(/^RETURN: \[SERVER, SQL#/).test(tempArray[tempArray.length-1])){
      tempArray.pop();
    }
    for (let i=0;i<tempArray.length;i++){
      tempArray[i]=tempArray[i].replace(/(^RETURN: \[SERVER, SQL#[0-9]+: ")|(", 0\]$)/g,"").split('";"');
    }
    var theResults=new ReturnObj(tempArray); // Splits the 2 part array into an object
    if (theResults){ // There should always be a result array, unless some unspeakably horribly thing happens
      if (theResults["columns"]){ // columns should ALWAYS return, even as an empty array, unless some unspeakably horrible thing happens
        if (theResults["columns"].length > 0){
          // Even if there are no results found, a valid SQL query ALWAYS returns the columns
          this.error=false;
          this.mapArray=mapifyColumnsAndAllData(theResults["columns"],theResults["data"]);
          this.objArray2=function(){
            var returnArray=[];
            for (let i=0;i<this.mapArray.length;i++){
              returnArray.push(objectHelper.strMapToObj(this.mapArray[i]));
            }
            return returnArray;
          };
          this.objArray=convertMapArrayToObjectArray(this.mapArray);
          this.columns=theResults["columns"];
          // I'm changing this to be a value rather than function, because it occured to me that if there are 0 results, the map should be empty
          // this.columns=function(){
          //   var returnArray=[];
          //   if (this.mapArray.length > 0){
          //     returnArray=[...this.mapArray[0].keys()];
          //   }
          //   return returnArray;
          // }
        } else {
          // If there were 0 columns, then it means the sql query was invalid.
          this.error=addNumToErrorObj(new Error("Invalid SQL query!"),1);
        }
      } else {
        // If the columns field is undefined then, then it means the sql query was invalid.
        this.error=addNumToErrorObj(new Error("Invalid SQL query!"),1);
      }
      // this.columns=theResults["columns"];
      // this.data=theResults["data"];
    }
  }
}
function ReturnObj(theArray){ // This simply shifts a 2 part array into an object.  This can probably be obsoleted, but meh.
  var tempArray=theArray;
  var tempColumns=tempArray.shift(); // This will return undefined if there was no value
  if (tempColumns){
    this.columns=tempColumns;
  } else {
    this.columns=[]; // Since there were no values, there were no columns
  }
  this.data=tempArray;
};
function mapifyColumnsAndAllData(columnArray,dataArray){ // this assists the SQL query constructor
  // dataArray should be an array of nested arrays, which each contain one individual result
  // If the dataArray is empty, then an empty array is returned.
  var tempArray=[];
  for (let e=0;e<dataArray.length;e++){
    // Working through each set of values from data
    tempArray.push(mapFromColumnsAndDataSet(columnArray,dataArray[e]));
  }
  return tempArray;
};
function mapFromColumnsAndDataSet(columnArray,dataArray){ // this assists the SQL query constructor, creating each a new map for each individual result.
  var tempMap=new Map();
  for (let i=0;i<columnArray.length;i++){
    tempMap.set(columnArray[i],dataArray[i]);
  }
  return tempMap;
};
function convertMapArrayToObjectArray(theMap){
  var returnArray=[];
  for (let i=0;i<theMap.length;i++){
    returnArray.push(objectHelper.strMapToObj(theMap[i]));
  }
return returnArray;
};


function objectifyColumnsAndAllData(columnArray,dataArray){ // this assists the SQL query constructor
  // dataArray should be an array of nested arrays, which each contain one individual result
  // If the dataArray is empty, then an empty array is returned.
  var tempArray=[];
  for (let e=0;e<dataArray.length;e++){
    // Working through each set of values from data
    tempArray.push(objectFromColumnsAndDataSet(columnArray,dataArray[e]));
  }
  return tempArray;
};
function objectFromColumnsAndDataSet(columnArray,dataArray){ // this assists the SQL query constructor, creating each a new map for each individual result.
  var tempObject={};
  for (let i=0;i<columnArray.length;i++){
    tempObject[columnArray[i]]=dataArray[i];
  }
  return tempObject;
};

