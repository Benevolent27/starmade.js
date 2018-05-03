const path=require('path');
const binFolder=path.resolve(__dirname,"../bin/");
var starNet=require(path.join(binFolder,"starNet.js"));
var starNetHelper=require(path.join(binFolder,"starNetHelper.js"));
var sqlQuery=require(path.join(binFolder,"./sqlQuery.js"));
var objHelper=require(path.join(binFolder,"objectHelper.js"));

// Set up variables
var uidPrefixes=["ENTITY_SHOP_","ENTITY_SPACESTATION_","ENTITY_FLOATINGROCK_","ENTITY_PLANET_","ENTITY_SHIP_","ENTITY_FLOATINGROCKMANAGED_","ENTITY_CREATURE_","ENTITY_PLANETCORE_","ENTITY_PLAYERCHARACTER_","ENTITY_PLAYERSTATE_"];
var uidPrefixesRegExp=createMultiRegExpFromArray(uidPrefixes,"^");

// Set up prototypes for constructors, such as replacing .toString() functionality with a default value.
SectorObj.prototype.toString=function(){ return this.coords.toString() };
CoordsObj.prototype.toString=function(){ return this.x.toString() + " " + this.y.toString() + " " + this.z.toString() };
EntityObj.prototype.toString=function(){ return this.fullUID.toString() };


// starNet("/load_sector_range 2 2 2 2 2 2");
// var testObj=new starNetHelp.ShipInfoUidObj("ENTITY_SHIP_Hello_There");
// console.log("\nDisplaying object (size: " + testObj.size + "):");
// console.dir(testObj);
//
//
// console.log("\nWhat is SqlQuery?");
// console.dir(sqlQuery);
//
// var sqlQueryObj=new sqlQuery.SqlQueryObj("SELECT * FROM PUBLIC.SECTORS WHERE X=2 AND Y=2 AND Z=2;");
// console.log("\nSql query: ");
// console.dir(sqlQueryObj);
//
// var shipBlocks=starNetHelp.getEntityValue("ENTITY_SHIP_Hello_There","Blocks");
// console.log("\nBlocks: " + shipBlocks);

// TESTING BEGIN
// EntityObj tests
var theShip=new EntityObj("ENTITY_SHIP_Hello_There");
console.log("My ship is named: " + theShip.name());
console.log("Is my ship loaded?: " + theShip.loaded());
console.log("It has a default value of: " + theShip.toString());
console.log("It has a total block count of: " + theShip.blocks());
console.log("It is currently in sector: " + theShip.sector().toString());
console.log("And it's very strange orientation coords are: " + theShip.orientation())
//
// console.log("And here's all the data, mapified:");
// console.dir(theShip.dataMap());

console.log("And here's all the data as an object:");
console.dir(theShip.dataObj());


// console.log("New entityObj: ");
// console.dir(theShip);
// console.log("\n");
// console.log("Ship faction number: " + theShip.faction().number);

// Object.keys(theShip).forEach(function(key){
//   if (theShip.hasOwnProperty(key)){ // This is to filter out prototype values
//     if (typeof theShip[key] == "object"){
//       process.stdout.write(key + ": (type: " + getObjType(theShip[key]) + ") ");
//       console.log(theShip[key]);
//     } else if (typeof theShip[key] == "function"){
//       let tempVal=theShip[key]();
//       if (typeof tempVal == "object"){
//         process.stdout.write(key + ": (type: " + getObjType(tempVal) + ") ");
//         console.log(tempVal);
//       } else if (typeof tempVal == "string"){
//         console.log(key + ": " + tempVal);
//       } else {
//         console.dir(tempVal);
//       }
//       // console.log(key + ": " + theShip[key]());
//     } else if (typeof theShip[key] == "string"){
//       console.log(key + ": " + theShip[key]);
//     }
//   }
// });

// console.log("UID: " + theShip.UID);
// console.log("fullUID: " + theShip.fullUID);


// SectorObj tests
// var theSector=new SectorObj(2,2,2);
// var chmodResults=theSector.setChmod("+ peace");
// console.log("Atttempt to set peace: " + chmodResults);
// chmodResults=theSector.setChmod("- peace");
// console.log("Attempt to remove peace: " + chmodResults);
// chmodResults=theSector.setChmod("- frakkin");
// console.log("Attempt at a bullshit change: " + chmodResults);
// chmodResults=theSector.setChmod("+ noindications");
// console.log("Attempt at + noindications: " + chmodResults);
// chmodResults=theSector.setChmod("- noindications");
// console.log("Attempt at - noindications: " + chmodResults);


// TESTING END



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

// function getObjType(theObj){ // This will return the name of the constructor function that created the object
//   if (typeof theObj == "object"){
//     return theObj.constructor.name; // This is apparently a deeply flawed method, but fuck it, it works for now.  Source:  https://stackoverflow.com/questions/332422/how-do-i-get-the-name-of-an-objects-type-in-javascript
//   } else { // If it is NOT an object, then we should just return whatever type it is.
//     return typeof theObj;
//   }
// }

function FactionObj(factionNumber){
  this.number=factionNumber;
  // TODO: Add Info methods:
  // name - Get the name of the faction, returned as string
  // description - Get the faction description.  This is harder than it sounds since the description gets all fubared in the return value since it can be multiple lines and it also might contain text that is a normal part of a response like { and } characters..  This is tricky.
  // members([Num,Num2]) - Get the members of the faction, returned as an array of playerObj's.  An array of num values in an array can be provided to return only members of specific ranks (1-5)
  // points - Get the faction points, returned as a number

  // Action methods:
  // setPoints - Set the faction points to a number and return the new points
  // addPoints - Add a value to the faction points and return the new total -  Can allow negative numbers to subtract - might have an option for "strict" not to allow negatives
  // subPoints - Remove a value of faction points and return the new total - Can allow negative numbers to add - might have an option for "strict" not to allow negatives

  // factionModRelation([FactionObj/FactionNum],"enemy/ally/neutral")
  // resetActivity - Resets activity flags for all members to inactive
  // addMember([playerObj/playerNameString],(RankNum)) - Adds a member to the faction.  Ranknum is optional, default is 1.
  // delMember([playerObj/playerNameString]) - Removes a player from the faction if they are in it.  Has to check the faction of the player.
  // delete - Deletes the faction entirely
  // edit([FactionName],[Description]) - Sets a new name and/or description for the faction.  If name or description are left blank, they are not changed.
  // setIDForMember([playerObj/playerNameString]) - Uses the debug function, "faction_set_id_member", to set a player to the faction - WARNING: CAN HAVE DISASTEROUS CONSEQUENCES BUT IT DOES MOVE THE PLAYER WITHOUT TERMINATING THEIR PREVIOUS FACTION IF LEFT EMPTY


  // For NPC factions ONLY:
  // removeNPCFaction - Removes a NPC faction IF it is a NPC faction.  Uses "/npc_remove_faction -98944984"

  //Optional:
  // duplicate(Num) - This will create duplicate new open factions with fake names as the leaders with the same name as this faction (uses /faction_create_amount [Name] [Number])
  // serverMessage(MessageString,info/warning/error) - Sends a message to all online players of this faction.  If no method is specified "plain" is used, which shows up on the player's main chat.
}

function detectSuccess(input){ // This will look for "RETURN: [SERVER, [ADMIN COMMAND] [SUCCESS]" and return true if found.
  var theReg=new RegExp("^RETURN: \\[SERVER, \\[ADMIN COMMAND\\] \\[SUCCESS\\]")
  var inputArray=input.split("\n");
  var returnVal=false;
  for (let i=0;i<inputArray.length && returnVal==false;i++){
    if (theReg.test(inputArray[i])){
      returnVal=true;
    }
  }
  if (returnVal == false){
    console.error("ERROR: " + input);
  }
  return returnVal;
}

function sectorSetChmod(coordsObj,val){
  let theType=objHelper.getObjType(val);
  console.log("sectorSetChmod running!");
  if (theType == "string"){
    console.log("Setting " + val + " for sector: " + coordsObj.toString());
    let theValLower=val.toLowerCase();
    let theCommand="/sector_chmod " + coordsObj.toString() + " " + theValLower;
    return detectSuccess(starNet(theCommand));
  } else if (theType == "array"){
    var resultsArray=[];
    for (let i=0;i<val.length;i++){
      let theSubType=objHelper.getObjType(val[i]);
      if (theSubType == "string"){
        let theValLower=val.toLowerCase();
        resultsArray.push(detectSuccess(starNet("/sector_chmod " + coordsObj.toString() + theValLower)));
      }
    }
    return resultsArray;
  } else {
    return new Error("Invalid sector chmod value given!");
  }
}

function SectorObj(x,y,z){
  // TODO: Add Info methods:
  // getChmod - to get the chmods of a sector returned as an array of +peace,+protected, etc.
  // getChmodNum - To perform a SQL query to look up the chmod number
  // getSystem - Returns a SystemObj

  // Add Action Methods:
  // setChmod - to set +peace, +noindications, etc.
  // setChmodNum - to set the chmod for a sector based on the relevant input number (based on the SQL number representation)
  // despawn(PartOfShipNameString) - Uses the /despawn_sector command to despawn ships that start with the string provided
  // export(nameOfExportFileString) - This will send a /force_save command and then a /export_sector command of this sector.
  // load(radiusNum/X,Y,Z/SectorObj/CoordsObj) - uses "/load_sector_range x y z x y z" to load the sector.  If a radius is given, then it loads that much of a radius around the sector.  If a second set of coordinates are given (or SectorObj/CoordsObj), then it loads a range between this sector and the one provided.
  // populate - This will run the /populate_sector command on this sector (replenishes asteroids or planets I think?  Not sure.)
  // repair - This will run a /repair_sector command on the sector.  NOTE:  This OFTEN has unintended consequences, including atually corrupting a sector or duplicating entities within the sector!

  // spawnEntity(BlueprintString,NewShipNameString,FactionNumber/FactionObj,AIActiveBoolean,[spacialX,SpacialY,SpacialZ]/CoordsObj)
  // - Spawns an entity somewhere within this sector.  Spacial coordinates are optional.  If no faction number is provided, 0 is used.  If AI active true/false value not given, true is used.
  // - Uses: "/spawn_entity [BluePrintName] [NewShipName] X Y Z [FactionNumber] [AIActiveBoolean true/false]" OR "/spawn_entity_pos [BluePrintName] [NewShipName] X Y Z SpacialX SpacialY SpacialZ [FactionNumber] [AIActiveBoolean true/false]"
  // - Returns an EntityObj of the newly spawned entity if successful, otherwise returns false.
  if (typeof x == "number" && typeof y == "number" && typeof z == "number"){
    this.coords=new CoordsObj(x,y,z);
    this.setChmod=function(val){ return sectorSetChmod(this.coords,val) };



    // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
    if (arguments.length > SectorObj.length){
      var extraInfoArray=[];
      for (let i=SectorObj.length-1;i<arguments.length;i++){
        extraInfoArray.push(arguments[i]);
      }
      this.extraInfo=extraInfoArray;
    }
    // this.toString=function(){ return this.coords.toString() }; // We don't want to set this here because then it shows up as a key.  Instead we set up the prototype at the top of the script.

  } else {
    throw new Error("ERROR: Invalid values given to SectorObj constructor!");
  }
}
function CoordsObj(x,y,z){
  this.x=x;
  this.y=y;
  this.z=z;
  // this.string=x.toString() + " " + y.toString() + " "+ z.toString();
  // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
  if (arguments.length > CoordsObj.length){
    var extraInfoArray=[];
    for (let i=CoordsObj.length-1;i<arguments.length;i++){
      extraInfoArray.push(arguments[i]);
    }
    this.extraInfo=extraInfoArray;
  }
  // this.toString=function(){ return this.string };
}

function stripFullUIDtoUID(input){
  return input.replace(uidPrefixesRegExp,"").toString();
}

function EntityObj(fullUID){
  // This should build the entity object based on the UID, adding the entity type if necessary to build the full UID
  if (fullUID){
    // this["UID"]=fullUID.replace(uidPrefixesRegExp,"").toString(); // Returns the UID as used with SQL queries, without the "ENTITY_SHIP_" whatever stuff.
    this["UID"]=stripFullUIDtoUID(fullUID); // Returns the UID as used with SQL queries, without the "ENTITY_SHIP_" whatever stuff.
    this["fullUID"]=fullUID;
    this["loaded"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"loaded") };
    // faction.number is WILDLY INACCURATE RIGHT NOW - WAITING ON FIX FROM SCHEMA - WILL NEED TO BE FIXED IN starNetHelper.js
    this["faction"]=function(){ return new FactionObj(starNetHelper.getEntityValue(this.fullUID,"faction")) };
    this["mass"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Mass") };
    // TODO: Change this to return an array of objects that are attached.  Players I think normally?  Are NPC's also possible though?
    this["attached"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Attached") };
    // TODO: Change this to "docked", which will return an array of EntityObjs
    this["dockedUIDs"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"DockedUIDs") };
    this["blocks"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Blocks") };
    // TODO: See what sorts of values might appear for lastModified and have it return the correct types of objects rather than a string value
    this["lastModified"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"LastModified") };
    // TODO: See what sorts of values might appear for creator and have it return the correct types of objects rather than a string value
    this["creator"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Creator") };
    this["sector"]=function(){ return new SectorObj(...starNetHelper.getEntityValue(this.fullUID,"Sector")) };
    this["name"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Name") };
    this["minBB"]=function(){ return new CoordsObj(...starNetHelper.getEntityValue(this.fullUID,"MinBB(chunks)")) };
    this["maxBB"]=function(){ return new CoordsObj(...starNetHelper.getEntityValue(this.fullUID,"MaxBB(chunks)")) };
    this["spacialCoords"]=function(){ return new CoordsObj(...starNetHelper.getEntityValue(this.fullUID,"Local-Pos")) };
    // TODO: Create an OrientationObj. Till then though, just return an array of values.
    this["orientation"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"Orientation") };
    this["type"]=function(){ return starNetHelper.getEntityValue(this.fullUID,"type") };
    // this["objType"]="EntityObj"; // Totally not necessary since we have objHelper.getObjType()

    this["dataMap"]=function(){ return new starNetHelper.ShipInfoUidObj(this.fullUID) };
    this["dataObj"]=function(){ return new starNetHelper.ShipInfoUidObj(this.fullUID,{"objType":"object"}) };

    // this.toString=function(){ return this.fullUID.toString() }; // This is visible as an element, so really we should set the prototype outside of the constructor.

    // TODO: Add Info methods:
    // system - returns a SystemObj of the current system the entity is within
    // isClaimPoint - returns boolean true/false value if the entity is the claim point for the system it is within
    // attached - returns an array of attached PlayerObj's
    // dockedUIDs - returns an array of docked EntityObj's

    // Optional:
    // chunks - returns an array of 2 arrays with minBB and maxBB chunks.  Example: [[-2,-2,-2],[2,2,2]]

    // Info methos using SQL queries:
    // typeNum - Returns the type number, as designated by SQL query
    // typeName - Returns the name for the type it is, such as "asteroid", "asteroidManaged", "planet", as per the SQL documentation project
    // dockedTo - Returns the EntityObj for the entity this entity is currently docked to
    // dockedToRoot - Returns the EntityObj for the root entity this entity is currently docked to

    // Action methods:
    // changeSector("[X],[Y],[Z]", SectorObj, or CoordsObj) - Teleports the entity (by UID) to a specific sector
    // destroy - Destroys the ship, leaving docked entities (using /destroy_uid)
    // destroyDocked - Destroys the ship and all docked entities (using /destroy_uid_docked)
    // saveBlueprint(BlueprintNameString) - Saves the current entity as a blueprint name, returning a BlueprintObj.  Note:  There is currently NO WAY to delete blueprints in-game!  Also the BlueprintObj will likely only be valid once the save actually completes.

    // shopRestock - Runs a /shop_restock_uid on the UID of the entity.  Only works if the entity IS a shop or has a shop module on it.  WARNING: It is recommended to ONLY use this on stick shops because base entities with shops on them get restocked with ALL items currently, including custom and depreciated blocks like gold bars and green dirt, etc.
    // shopRestockFull - Runs a /shop_restock_full_uid on the UID of the entity.  Only works if the entity IS a shop or has a shop module on it.  WARNING: It is recommended to ONLY use this on stick shops because base entities with shops on them get restocked with ALL items currently, including custom and depreciated blocks like gold bars and green dirt, etc.

    // Optional:
    // destroyOnlyDocked - Can use sql queries to individually destroy only entities that have this entity as the root docking point or down the chain from it - would take some work and might be unreliable since it requires using /sql_query which only updates on force-saves and auto-saves
    // serverMessage(MessageString,info/warning/error) - Sends a message to all online players that are currently attached to this entity.  If no method is specified "plain" is used, which shows up on the player's main chat.

  } else {
    throw new Error("ERROR: No UID provided to EntityObj constructor!");
  }
}
