// TODO:  Add support for prototypes of constructors.

const util=require('util');
var installObj=global.getInstallObj(__dirname);
var {settings,log,event,defaultGlobalEvent}=installObj;
var commandOperator = "!"; // Right now this is unchangeable, but that might change in the future.
const thisConsole=installObj.console;
var {toNumIfPossible,toStringIfPossible,getOption,getParamNames,simplePromisifyIt}=global.objectHelper;
var {i} = global.miscHelpers;
var thisServerObj={};
var enumeratedObj={}; // used to test object functions


event.on('start',function(theServerObj){
  thisServerObj=theServerObj;
  // #####  wrapper info  #####
  thisConsole.regCommand("ListGlobal","Wrapper Info",listGlobal);
  thisConsole.regCommand("ListObjects","Wrapper Info",listObjects);
  thisConsole.regCommand("SelectObject","Wrapper Info",selectObject);
  thisConsole.regCommand("TestObject","Wrapper Info",testObject);
  // TODO:  Make it so it remembers the inputs for future printouts
  thisConsole.regCommand("printObjects","Wrapper Info",printObjects); // Creates examples for every object type and prints out their functions to a file
  // thisConsole.regCommand("clearValues","Wrapper Info",printObjects); // Creates examples for every object type and prints out their functions to a file

});
var objectsInfoFileName="theMethods";
var writingObjectsInfoFile=installObj.getJSON(__dirname,objectsInfoFileName); 

function writeObjectsFile(){ // Used when deposits are made.
  thisConsole.log("Writing Objects Info file..");
  // Uses the installObj JSON writer to keep files organized separately from the mod files themselves.
  // This is important for editing or deleting the data files (such as when a server reset happens)
  installObj.writeJSON(__dirname,objectsInfoFileName); // We do not need to provide the object itself, because it writes from the cache.
}



function printObjects(theProperCommand,theArguments,options){
  // Clear the objects file 
  // writingObjectsInfoFile={};
  // clear the writingObjectsInfoFile object
  var writingObjectsInfoFileKeys=Object.keys(writingObjectsInfoFile);
  for (let i=0;i<writingObjectsInfoFileKeys.length;i++){
    delete writingObjectsInfoFile[writingObjectsInfoFileKeys[i]];
  }
  // Build the objects file
  thisConsole.log("Writing ServerObj..");
  writingObjectsInfoFile["ServerObj"]=enumerateAnObjectThenReturnObject(installObj.serverObj,"ServerObj");
  var theKeys=Object.keys(installObj.objects);
  theKeys=theKeys.sort();
  var yesNo="";
  for (let c=1,e=0;e<theKeys.length;e++,c++){
    yesNo=global["prompt"](`"Should we enumerate the '${theKeys[e]}' object? [Yes]`);
    if (i(yesNo,"n","no")){
      thisConsole.log("Skipping..");
    } else {
      selectObject("",[c]); // Places the example object into enumeratedObj;
      writingObjectsInfoFile[theKeys[e]]=enumerateAnObjectThenReturnObject(enumeratedObj,theKeys[e]);
    }

  }
  // Write the objects file
  thisConsole.log("Finished with all objects..");
  console.log(util.inspect(writingObjectsInfoFile,{colors:true, depth: Infinity,compact: true,maxArrayLength: null}));
  // console.log(util.inspect(writingObjectsInfoFile, false, null, true /* enable colors */))
  // console.dir(writingObjectsInfoFile);
  writeObjectsFile();
}


function testObjectCBHandler(err,theResult){  // for use by the testObject function only
  thisConsole.log("Here are the results!");
  if (err){
    thisConsole.log("Ran asynchronously, but an error occurred!  Error:");
    thisConsole.dir(err);
  }
  thisConsole.log(`Ran ascynchronously.  Typeof Result:'${typeof theResult}'  Result:`);
  thisConsole.dir(theResult);
};


async function testObject(theProperCommand,theArguments,options){
  // console.log("theArguments: " + theArguments); // temp
  let theKeys=Object.keys(enumeratedObj);
  // console.log("theKeys: " + theKeys); // temp
  if (theKeys.length > 0){
    if (theArguments.length > 0){
      var theElementName=String(theArguments[0]);
      theArguments.shift();
      // console.log("theElementName: " + theElementName); // temp
      // TODO: Add support for testing prototypes
      if (enumeratedObj.hasOwnProperty(theElementName)){
        if (typeof enumeratedObj[theElementName] == "function"){
          // Add routine for filling in the arguments
          let theElementArgumentsArray=getParamNames(enumeratedObj[theElementName]);
          var parametersToUseArray=[];
          var callbackPresent=false;
          var temp;
          for (let z=0;z<theElementArgumentsArray.length;z++){
            if (i(theElementArgumentsArray[z],"cb")){ // Don't set a value for the callback, which should always be at the end.
              callbackPresent=true; // We know to use a callback, otherwise we should assume it's synchronous
              parametersToUseArray.push(testObjectCBHandler); // Will simply display any error or result to the screen.
            } else {
              temp=global["prompt"](`What to use for '${theElementArgumentsArray[z]}'?:`);
              try {
                temp=JSON.parse(temp);
                thisConsole.log(`Parsed input to typeof: ${typeof temp}`);
              } catch (err){
                thisConsole.log(`Not JSON parsable, so using original string.  Err: ${err}`);
              }
              parametersToUseArray.push(temp);
              temp="";
            }
          }
          if (callbackPresent === true){ // Run asynchronously with callback
            thisConsole.log(`Running: enumeratedObj[${theElementName}](${parametersToUseArray})`);
            return enumeratedObj[theElementName](...parametersToUseArray);
          } else {
            try{
              // This is to handle methods that might return a promise or be synchronous
              let theResult=enumeratedObj[theElementName](...parametersToUseArray);
              // It could be a promise, so let's try to resolve it.
              let theFinishedResult=await Promise.resolve(theResult).catch(function(err){
                thisConsole.log(`Ran as a Promise but there was an error:`);
                thisConsole.dir(err);
              });
              thisConsole.log(`Ran Synchronously or as a Promise.  Typeof Result:'${typeof theFinishedResult}'  Result:`);
              thisConsole.dir(theFinishedResult);
            } catch (err){
              thisConsole.log("Ran Synchronously, but an error occurred!  Error:");
              thisConsole.dir(err);
            }
          }

          thisConsole.log(`Running object.${theElementName}(${theArguments})..`);
          // TODO:  Add smart processing to allow object/array inputs

          return enumeratedObj[theElementName](...theArguments);

          // TODO:  Add promise resolution and displaying of results

        } else { // for anything other than a function, just display it
          if (typeof enumeratedObj[theElementName] == "string"){ // put string results on one line
            thisConsole.log(`Result of testObj.${theElementName}: ${enumeratedObj[theElementName]}`);
          } else {
            thisConsole.log(`Result of testObj.${theElementName}:`);
            thisConsole.dir(enumeratedObj[theElementName]);
          }
          return true;
        }
      } else {
        thisConsole.log(`ERROR:  Object did not have a method called, '${theElementName}'!`);
        thisConsole.log(`To see a list of elements for this object, please use the '!testObject' command with no arguments provided!`);
      }
    } else {
      thisConsole.log(" This command requires the element to test.  Example: !testObject name");
      thisConsole.log(" The currently loaded test object has the following elements:");
      enumerateAnObject(enumeratedObj,"testObj");
      thisConsole.log(" ");
      thisConsole.log(" To run a test one one of the elements of this object, type !TestObject [elementName]");
      thisConsole.log(" Example: !TestObject msg");
    }

  } else {
    thisConsole.log("ERROR:  Test Object empty!  Nothing to test!");
  }
  return false;
}

function selectObject(theProperCommand,theArguments,options){
  if (theArguments.length >= 1){
    var theObjectNumber=toNumIfPossible(theArguments[0]);
    var theObjectTypeName;
    if (typeof theObjectNumber == "number"){
      if (theObjectNumber == 0){ // 0 is always the serverObj
        enumeratedObj=installObj.serverObj;
        theObjectTypeName="ServerObj";
      } else {
        theObjectNumber-=1;
        var theKeys=Object.keys(installObj.objects);
        theKeys=theKeys.sort();
        if (theKeys.length >= theObjectNumber){
          theObjectTypeName=theKeys[theObjectNumber];
          thisConsole.log(`Selected object type '${theObjectTypeName}'.`);
          let paramsArray = getParamNames(installObj.objects[theObjectTypeName]);
          var inputArray=[];
          for (let e=0;e<paramsArray.length;e++){
            // collect inputs to use to create the object
            inputArray.push(global["prompt"](`What to use for (${paramsArray[e]}):`)); // if no input given, will be undefined.
          }
          enumeratedObj=new installObj.objects[theObjectTypeName](...inputArray); // For use with !TestObject
        } else {
          return thisConsole.log("Invalid number selected!  To see a list of objects available, type !listObjects");
        }
      }
      thisConsole.log(`Enumerating elements for object (${theObjectTypeName}):`);
      enumerateAnObject(enumeratedObj,theObjectTypeName);
      thisConsole.log(" ");
      thisConsole.log(" To run a test one one of the elements of this object, type !testObject [elementName]");
      thisConsole.log(" Example: !TestObject msg");
    } else {
      thisConsole.log("ERROR: Please provide the NUMBER corresponding to the object you would like to select!");
      thisConsole.log(`To see a list of objects, type ${commandOperator}listObjects`);
      thisConsole.log(" ");
    }
  } else {
    thisConsole.log("Need to provide the number of the object you'd like to enumerate!");
    thisConsole.log(`To see a list of objects available, type ${commandOperator}listObjects`);
  }
  return true; // Just making ESLINT happy
}

function listObjects(){
  if (installObj.hasOwnProperty("objects")){
    thisConsole.log("Enumerating objects:")
    var theKeys=Object.keys(installObj.objects);
    theKeys=theKeys.sort();
    // first display the serverObj as the main object, which will always be 0
    thisConsole.log(` -[0]-  ServerObj()`);
    for (let counter=1,i=0;i<theKeys.length;counter++,i++){
      let params = getParamNames(installObj.objects[theKeys[i]]);
      thisConsole.log(` -[${counter}]-  ${theKeys[i]}(${params})`);
    }
    thisConsole.log(" ");
    thisConsole.log("To enumerate an object, type: !SelectObject #");
  }
}

function listGlobal(){
  // let params;
  thisConsole.log("Enumerating elements from the global object:");
  enumerateAnObject(global,"global"); 
}

function enumerateAnObject(theObject,objectName){
  // requires an Object.
  // used by more than 1 command to list the contents of an object in a uniform way.
  var keyArray=Object.keys(theObject);
  if (keyArray.length > 0){
    keyArray = keyArray.sort(); // Alphabetize the list
    thisConsole.log(" ");
    thisConsole.log(" Elements:")
    for (let i = 0;i < keyArray.length;i++) {
      typifyAndDisplay(theObject[keyArray[i]],objectName,keyArray[i])
    }
  }
  // Now let's do the prototypes
  var prototypeKeys=Object.keys(theObject.constructor.prototype);
  if (prototypeKeys.length > 0){
    prototypeKeys = prototypeKeys.sort(); // Alphabetize the list
    thisConsole.log(" ");
    thisConsole.log(" Prototypes:");
    for (let i = 0;i < prototypeKeys.length;i++) {
      typifyAndDisplay(theObject[prototypeKeys[i]],objectName,prototypeKeys[i])
    }
  }
  if (keyArray.length == 0 && prototypeKeys == 0){
    thisConsole.log("The object had no elements nor prototypes!  Nothing to display!");
  }
}

function typifyAndDisplay(input,objectName,keyName){
  if (typeof input == "function") {
    var params = getParamNames(input);
    if (params.length > 0) {
      thisConsole.log(` (${typeof input}) \t${objectName}.${keyName}(${params})`);
    } else {
      thisConsole.log(` (${typeof input}) \t${objectName}.${keyName}()`);
    }
  } else if (typeof input == "object") {
    if (input instanceof Array) {
      thisConsole.log(` (Array) \t${objectName}.${keyName}`);
    } else if (input instanceof Map) {
      thisConsole.log(` (Map ${typeof input}) \t${objectName}.${keyName}`);
    } else if (input instanceof Date) {
      thisConsole.log(` (Date ${typeof input}) \t${objectName}.${keyName}`);
    } else {
      thisConsole.log(` (${typeof input}) \t${objectName}.${keyName}`);
    }
  } else {
    thisConsole.log(` (${typeof input}) \t${objectName}.${keyName}`);
  }
}

function enumerateAnObjectThenReturnObject(theObject,objectName){
  // TODO:  Add support for prototypes
  // requires an Object.
  // used by more than 1 command to list the contents of an object in a uniform way.
  var keyArray=Object.keys(theObject);
  var theReturnObj={};
  keyArray = keyArray.sort(); // Alphabetize the list
  for (let i = 0,params=[];i < keyArray.length;i++) {
    if (typeof theObject[keyArray[i]] == "function") {
      params = getParamNames(theObject[keyArray[i]]);
      if (params.length > 0) {
        // theReturnObj[keyArray[i]]=`(${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}(${params})`;
        theReturnObj[keyArray[i]]={
          "type":typeof theObject[keyArray[i]],
          "parameters":params,
          "usage":`${objectName}.${keyArray[i]}(${params})`
        }
      } else {
        // theReturnObj[keyArray[i]]=`(${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}()`;
        theReturnObj[keyArray[i]]={
          "Type":typeof theObject[keyArray[i]],
          "parameters":[],
          "Usage":`${objectName}.${keyArray[i]}()`
        }
      }
    } else if (typeof theObject[keyArray[i]] == "object") {
      if (theObject[keyArray[i]] instanceof Array) {
        // theReturnObj[keyArray[i]]=`(Array) \t${objectName}.${keyArray[i]}`;
        theReturnObj[keyArray[i]]={
          "Type":"Array",
          "Usage":`${objectName}.${keyArray[i]}`
        }
      } else if (theObject[keyArray[i]] instanceof Map) {
        // theReturnObj[keyArray[i]]=`(Map ${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}`;
        theReturnObj[keyArray[i]]={
          "Type":`Map ${typeof theObject[keyArray[i]]}`,
          "Usage":`${objectName}.${keyArray[i]}`
        }
      } else if (theObject[keyArray[i]] instanceof Date) {
        // theReturnObj[keyArray[i]]=`(Date ${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}`;
        theReturnObj[keyArray[i]]={
          "Type":`Date ${typeof theObject[keyArray[i]]}`,
          "Usage":`${objectName}.${keyArray[i]}`
        }
      } else {
        // theReturnObj[keyArray[i]]=`(${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}`;
        theReturnObj[keyArray[i]]={
          "Type":`${typeof theObject[keyArray[i]]}`,
          "Usage":`${objectName}.${keyArray[i]}`
        }
      }
    } else {
      // theReturnObj[keyArray[i]]=`(${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}`;
      theReturnObj[keyArray[i]]={
        "Type":`${typeof theObject[keyArray[i]]}`,
        "Usage":`${objectName}.${keyArray[i]}`
      }
  }
  }
  return theReturnObj;
}
