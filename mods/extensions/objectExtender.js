// The purpose of this mod is to extend existing objects with more methods.
// The extensions are only available on init or later events, such as playerMessage, playerDeath, etc.

const path=require('path');
const fs=require('fs');
// Pull the needed objects from the global variable.
var {event,objectHelper,objectCreator,miscHelpers}=global;
var {isInArray,testIfInput,getOption,addOption,isArray,toNumIfPossible,simplePromisifyIt}=objectHelper;
var {isFile,isSeen,log}=miscHelpers;

var {SectorObj,CoordsObj}=objectCreator;

SectorObj.prototype.distanceToSector=distanceToSector;
function distanceToSector(sector,options,cb){
    var objectThis=getOption(options,"this",this); // Contrary to ESLint, this does actually work.  This gets the object's root context or pulls it from the options.
    if (typeof cb=="function"){
        if (testIfInput(sector)){
            try{
                var coords=objectThis.coords;
                console.log("coords2:",coords);
                console.log("sector: " + sector);
                return cb(null,distanceBetweenSectors(coords.toString(),sector));
            } catch (err){
                return cb(err,null);
            }
        } else {
            return cb(new Error("Invalid input given to SectorObj.distanceToSector! (Expects coordinate input)"),null);
        }
    }
    return simplePromisifyIt(distanceToSector,addOption(options,"this",objectThis),sector); // It's necessary to pass the "this" context to the promise through the options, since there is no other way to do it.
}
// CommandObj.prototype.toString = function(){ return this.name };

global.mathHelpers={};
global.mathHelpers["distanceBetweenSectors"]=distanceBetweenSectors;

function distanceBetweenSectors(sector1,sector2){
    var firstSector=(new CoordsObj(sector1)).toArray();
    var secondSector=(new CoordsObj(sector2)).toArray();

    var differencesArray=coordinateDifferences(firstSector,secondSector);
    var result1=simplePythagorean(differencesArray[0],differencesArray[1]);
    return simplePythagorean(result1,differencesArray[2]);
}
function simplePythagorean(a,b){ // Returns c
    return Math.sqrt(Math.pow(a,2)+Math.pow(b,2));
}
function coordinateDifferences(array1,array2){ // Expects arrays with 3 numbers.  This gets the distances on each axis
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

