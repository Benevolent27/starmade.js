module.exports={ // top exporting to allow circular dependencies to work.
  SqlQueryObj, // DO NOT USE THE OBJECT DIRECTLY FROM THIS FILE, USE THE objectCreator.js script for that to avoid unsupported circular dependencies, since that script uses export injection to provide this object.
  mapifyColumnsAndAllData // This takes an array with columns, and another array with all the data, spitting out an array of maps
};


const path=require('path');

const binFolder=path.resolve(__dirname);
const starNet=require(path.resolve(binFolder,"starNet.js"));
const objHelper=require(path.resolve(binFolder,"objectHelper.js"));
const starNetHelper=require(path.resolve(binFolder,"starNetHelper.js"));

// TODO: Set up the check where if there are no columns returned, the query must have been invalid
// Set up aliases
const verifyResponse=starNetHelper["verifyResponse"]; // This checks to make sure there was no error anywhere and that the command executed
const addNumToErrorObj=objHelper["addNumToErrorObj"];

// Set up prototype modifiers


// Command line arguments
// This can either return the full sqlQuery object OR an individual part of it.
// Note:  the ["whatever"] convention does not work here due to how arguments are processed.
// Example:  node sqlQuery.js "SELECT * FROM PUBLIC.ENTITIES WHERE X=2;" mapArray
// Example2:  node sqlQuery.js "SELECT * FROM PUBLIC.ENTITIES WHERE X=2;" columns
if (__filename == require.main.filename){ // Only run starnet with command line arguments if this script is running as itself
  var clArguments=process.argv.slice(2);
  if (clArguments){
    var theQuery=clArguments[0];
    console.log("Running with query: " + theQuery);
    var theResults=new SqlQueryObj(theQuery);
    if (clArguments[1]){
      console.log("Returning value of '" + clArguments[1] + "':");
      let tempStr="theResults." + clArguments[1];
      console.dir(eval(tempStr));
    } else {
      console.log("Results:");
      console.dir(theResults);
    }
  }
}

function getSQLquery(query){ // This will preprocess a query so that it should work with starNet.js to run correctly.
  // This should correct for improper quote types.
  // For example if someone tries to use a " character instead of a ' character when performing "like" operators
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
function SqlQueryObj(sqlQuery){
  this.query=sqlQuery;
  this.time=Date.now();
  // console.log("Running sql query: " + sqlQuery);
  this.mapArray=[]; // This is modified later in the script, but declared here in case there is an error.
  var resultsStr=starNet(getSQLquery(sqlQuery));
  if (verifyResponse(resultsStr) == false){
    // There was an error of some kind
    this.error=addNumToErrorObj(new Error("StarNet command failed!"),2);
  } else {
    var tempArray=[]; // Let's clean up the results so it only contains the relevant SQL lines
    tempArray=resultsStr.split("\n");
    // console.log("\nBefore Trimming: ");
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
              returnArray.push(objHelper.strMapToObj(this.mapArray[i]));
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
		returnArray.push(objHelper.strMapToObj(theMap[i]));
	}
return returnArray;
};
