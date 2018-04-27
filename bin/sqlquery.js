
const path=require('path');
const child=require('child_process');

var binFolder=path.resolve(__dirname);
var starNet=require(path.resolve(binFolder,"starNet.js"));

// This should be EQUALS not NOT EQUAL - this is just for testing
if (__filename == require.main.filename){ // Only run starnet with command line arguments if this script is running as itself
  var clArguments=process.argv.slice(2);
  if (clArguments){
    for (let i=0;i<clArguments.length;i++){
      // console.log("Running starnet on argument: " + clArguments[i]);
      var theQuery=getSQLquery(clArguments[i]);
      console.log("Running with query: " + theQuery);
      var theResults=starNet(theQuery);
      console.log("Results:");
      // console.dir(theResults);
      console.dir(arrayFromColumnsAndAllData(theResults["columns"],theResults["data"]));
    }
  }
}
var lineCount=0;

function getSQLquery(query){
  return "/sql_query \"" + query + "\"";
}
function SqlQueryObj(sqlQuery){
  var theQuery=getSQLquery(sqlQuery);
  // this.query="/sql_query \"" + sqlQuery + "\"";
  this.query=getSQLquery(sqlQuery);
  this.time=Date.now();
  // This will be a rather complicated constructor, returning an array of objects or maps each with individual values
  // This should return an error object if the query is invalid.
  // This may need to run an outside script to function properly.

  // TODO: Info
  // columns - Returns an array of the columns returned
  // data - returns an array of maps or objects containing the results.  Size will be 0 if no results were returned.

  // Here is some pseudo code as I think outloud
  // var getColumns=["one","Two","three"];
  // var getData=[["blah","bleh","Blargh"],["blah","bleh","Blargh"],["blah","bleh","Blargh"]];

  var theResults=starNet(theQuery);
  if (theResults){
    this.data=arrayFromColumnsAndAllData(theResults["columns"],theResults["data"]);
  }
}
function arrayFromColumnsAndAllData(columnArray,dataArray){ // this assists the SQL query constructor
  // dataArray should be an array of nested arrays
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

// Temporary just to show results
// process.on('exit', function(){
//   console.log("exiting!");
//   console.dir(new SqlQueryObj("whatever").data);
// });
