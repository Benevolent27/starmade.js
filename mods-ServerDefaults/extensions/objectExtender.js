// The purpose of this mod is to extend existing objects with more methods.
// The extensions are only available after the start event has finished. This includes when playerMessage, playerDeath, or other server events might start triggering.

// Pull the needed objects from the global variable.
var {objectHelper}=global;
var {testIfInput,getOption,addOption,toNumIfPossible,simplePromisifyIt}=objectHelper;

var SectorObj={};
var CoordsObj={};

var installObj=global.getInstallObj(__dirname); // Get the install object
var {event}=installObj;
event.on('start',function(serverObj){
  SectorObj=installObj.objects.SectorObj; // these objects should exist already since they are registered during the "init" phase, which occurred before the "start" phase
  CoordsObj=installObj.objects.CoordsObj
  SectorObj.prototype.distanceToSector=distanceToSector; // Add a new prototype to the SectorObj
  serverObj.distanceBetweenSectors=distanceBetweenSectors; // Add a helper to the serverObj
});
function distanceToSector(sector,options,cb){
    var objectThis=getOption(options,"this",this); // Contrary to ESLint, this does actually work.  This gets the object's root context or pulls it from the options.
    if (typeof cb=="function"){
        if (testIfInput(sector)){
            try{
                var coords=objectThis.coords;
                return cb(null,distanceBetweenSectors(coords,sector));
            } catch (err){
                return cb(err,null);
            }
        } else {
            return cb(new Error("Invalid input given to SectorObj.distanceToSector! (Expects coordinate input)"),null);
        }
    }
    return simplePromisifyIt(distanceToSector,addOption(options,"this",objectThis),sector); // It's necessary to pass the "this" context to the promise through the options, since there is no other way to do it.
}

function distanceBetweenSectors(sector1,sector2){
    var firstSector=(new CoordsObj(sector1)).toArray();
    var secondSector=(new CoordsObj(sector2)).toArray();

    var differencesArray=coordinateDifferences(firstSector,secondSector);
    var result1=simplePythagorean(differencesArray[0],differencesArray[1]); // look at the triangle from one side and solve for C
    return simplePythagorean(result1,differencesArray[2]); // Look at the triangle from another angle and solve for C, this is the distance between the two points on a 3d plane
}
function simplePythagorean(a,b){ // Returns c.  "Based on A squared + B squared = C Squared" forumla
    return Math.sqrt(Math.pow(a,2)+Math.pow(b,2));
}
function coordinateDifferences(array1,array2){ 
  // Expects arrays with 3 numbers each.  
  // This gets the distances on each axis from each point, essentially drawing a triangle and getting the lengths of each side.
  // For example, if given [2,3,4] and [10,10,10], this will return [8,7,6]
    var outputArray=[];
    for (let i=0;i<array1.length;i++){
        if (array1[i]>array2[i]){
            outputArray.push(array1[i]-array2[i])
        } else {
            outputArray.push(array2[i]-array1[i])
        }
    }
    return outputArray;
}

