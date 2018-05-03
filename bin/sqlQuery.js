
const path=require('path');

var binFolder=path.resolve(__dirname);
var starNet=require(path.resolve(binFolder,"starNet.js"));

// This should be EQUALS not NOT EQUAL - this is just for testing
if (__filename == require.main.filename){ // Only run starnet with command line arguments if this script is running as itself
  var clArguments=process.argv.slice(2);
  if (clArguments){
    for (let i=0;i<clArguments.length;i++){
      // console.log("Running starnet on argument: " + clArguments[i]);
      var theQuery=clArguments[i];
      console.log("Running with query: " + theQuery);
      var theResults=new SqlQueryObj(theQuery);
      console.log("Results:");
      console.dir(theResults);
      // console.dir(arrayFromColumnsAndAllData(theResults["columns"],theResults["data"]));
    }
  }
}

function getSQLquery(query){ // This will preprocess a query so that it should work with starNet.js to run correctly.
  return "/sql_query \"" + query + "\"";
}
function SqlQueryObj(sqlQuery){
  var theQuery=getSQLquery(sqlQuery);
  // this.query="/sql_query \"" + sqlQuery + "\"";
  this.query=getSQLquery(sqlQuery);
  this.time=Date.now();

  // console.log("Running SQL query: " + theQuery);
  var resultsStr=starNet(theQuery);
  // console.log("Raw results: " + resultsStr);
  var tempArray=[];
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
  var theResults=new ReturnObj(tempArray);
  if (theResults){
    this.dataMap=mapifyColumnsAndAllData(theResults["columns"],theResults["data"]);
    this.columns=theResults["columns"];
    this.data=theResults["data"];
  }
}

function ReturnObj(theArray){
  var tempArray=theArray;
  this.columns=tempArray.shift();
  this.data=tempArray;
}

function mapifyColumnsAndAllData(columnArray,dataArray){ // this assists the SQL query constructor
  // dataArray should be an array of nested arrays, which each individual result
  var tempArray=[];
  for (let e=0;e<dataArray.length;e++){
    // Working through each set of values from data
    tempArray.push(mapFromColumnsAndDataSet(columnArray,dataArray[e]));
  }
  return tempArray;
}
function mapFromColumnsAndDataSet(columnData,data){ // this assists the SQL query constructor
  var tempMap=new Map();
  for (let i=0;i<columnData.length;i++){
    tempMap.set(columnData[i],data[i]);
  }
  return tempMap;
}

module.exports={ // I have no idea if this will work or not..
  SqlQueryObj,
  mapifyColumnsAndAllData:mapifyColumnsAndAllData
};


// Temporary just to show results
// process.on('exit', function(){
//   console.log("exiting!");
//   console.dir(new SqlQueryObj("whatever").data);
// });
