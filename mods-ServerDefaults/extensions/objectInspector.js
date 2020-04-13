// Updated to use installObj
var installObj=global.getInstallObj(__dirname);
var {settings,log,event,defaultGlobalEvent}=installObj;

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
  thisConsole.regCommand("EnumerateObject","Wrapper Info",enumerateObject);
  thisConsole.regCommand("TestObject","Wrapper Info",testObject);
});

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
        thisConsole.log(`ERROR:  Object did not have a method called, '${theArguments[0]}'!`);
        thisConsole.log(`To see a list of elements for this object, please use the '!testObject' command with no arguments provided!`);
      }
    } else {
      thisConsole.log(" This command requires the element to test.  Example: !testObject name");
      thisConsole.log(" The currently loaded test object has the following elements:");
      enumerateAnObject(enumeratedObj,"testObj");
    }

  } else {
    thisConsole.log("ERROR:  Test Object empty!  Nothing to test!");
  }
  return false;
}

function enumerateObject(theProperCommand,theArguments,options){
  if (theArguments.length >= 1){
    var theObjectNumber=toNumIfPossible(theArguments[0]);
    var theObjectTypeName;
    if (typeof theObjectNumber == "number"){
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
        var testObj=new installObj.objects[theObjectTypeName](...inputArray);
        enumeratedObj=testObj; // For use with !testObject
        thisConsole.log(`Enumerating elements for object (${theObjectTypeName}):`);
        enumerateAnObject(testObj,theObjectTypeName);
        
      } else {
        thisConsole.log("Invalid number selected!  To see a list of objects available, type !listObjects");
      }
    }
  } else {
    thisConsole.log("Need to provide the number of the object you'd like to enumerate!");
    thisConsole.log("To see a list of objects available, type !listObjects");

  }
}

function listObjects(){
  if (installObj.hasOwnProperty("objects")){
    thisConsole.log("Enumerating objects:")
    var theKeys=Object.keys(installObj.objects);
    theKeys=theKeys.sort();
    for (let counter=1,i=0;i<theKeys.length;counter++,i++){
      let params = getParamNames(installObj.objects[theKeys[i]]);
      thisConsole.log(` -[${counter}]-  ${theKeys[i]}(${params})`);
    }
    thisConsole.log(" ");
    thisConsole.log("To enumerate an object, type: !enumerateObject #");
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
  keyArray = keyArray.sort(); // Alphabetize the list
  for (let i = 0,params=[];i < keyArray.length;i++) {
    if (typeof theObject[keyArray[i]] == "function") {
      params = getParamNames(theObject[keyArray[i]]);
      if (params.length > 0) {
        thisConsole.log(` (${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}(${params})`);
      } else {
        thisConsole.log(` (${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}()`);
      }
    } else if (typeof theObject[keyArray[i]] == "object") {
      if (theObject[keyArray[i]] instanceof Array) {
        thisConsole.log(` (Array) \t${objectName}.${keyArray[i]}`);
      } else if (theObject[keyArray[i]] instanceof Map) {
        thisConsole.log(` (Map ${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}`);
      } else if (theObject[keyArray[i]] instanceof Date) {
        thisConsole.log(` (Date ${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}`);
      } else {
        thisConsole.log(` (${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}`);
      }
    } else {
      thisConsole.log(` (${typeof theObject[keyArray[i]]}) \t${objectName}.${keyArray[i]}`);
    }
  }
}
