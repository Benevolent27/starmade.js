
// This script assists with creating all custom object types used by the wrapper.

// Requires
const path        = require('path');
const binFolder   = path.resolve(__dirname,"../bin/");
const spawn       = require('child_process').spawn;
var miscHelper    = require(path.join(binFolder,"miscHelpers.js"));
var requireBin    = miscHelper["requireBin"];
var starNet       = requireBin("starNet.js");
var starNetHelper = requireBin("starNetHelper.js");
var sqlQuery      = requireBin("sqlQuery.js");
var objHelper     = requireBin("objectHelper.js");
var regExpHelper  = requireBin("regExpHelper.js");
var ini           = requireBin("iniHelper.js");

// var starNet=require(path.join(binFolder,"starNet.js"));
// var starNetHelper=require(path.join(binFolder,"starNetHelper.js"));
// var sqlQuery=require(path.join(binFolder,"sqlQuery.js"));
// var objHelper=require(path.join(binFolder,"objectHelper.js"));
// var regExpHelper=require(path.join(binFolder,"regExpHelper.js"));

// Set up aliases
var colorize                = objHelper["colorize"];
var stripFullUIDtoUID      = regExpHelper["stripFullUIDtoUID"]; // Function that removes text like ENTITY_SHIP_ and ENTITY_PLANET_ from the beginning of a full UID so it can be used to perform SQL queries on UID
var typeOfObj              = objHelper.type; // Gets the prototype name of an object, so instead of using "typeof", which returns "object" for things like arrays and SectorObj's, etc, this will return their object name instead.
var SqlQueryObj            = sqlQuery.SqlQueryObj;
const toNum                = objHelper.toNumIfPossible;
var sectorProtectionsArray = regExpHelper.sectorProtections; // This should include all the possible protections a sector can have.
var verifyStarNetResponse  = starNetHelper.verifyResponse; // This can be used to perform a verification on a StarMade response without consuming the response
var starNetVerified        = starNetHelper.starNetVerified; // If the response does not verify, this consumes the response and throws an error instead
var copyArray              = objHelper.copyArray;

// Set up prototypes for constructors, such as replacing .toString() functionality with a default value.  Prototypes will not appear as a regular key.
SectorObj.prototype.toString = function(){ return this.coords.toString() };
CoordsObj.prototype.toString = function(){ return this.x.toString() + " " + this.y.toString() + " " + this.z.toString() };
EntityObj.prototype.toString = function(){ return this.fullUID.toString() };

//  #######################
//  ###     TESTING     ###
//  #######################
if (__filename == require.main.filename){ // Only run the arguments IF this script is being run by itself and NOT as a require.

  var clArgs=process.argv.slice(2);
  var testSuit={
    sectorTests1:sectorTests,
    sectorTests2:sectorTests2,
    sectorTests3:sectorTests3,
    entityObjTests:entityObjTests,
    starNetHelperTests:starNetHelperTests
  }
  if (testSuit.hasOwnProperty(clArgs[0])){
    console.log("Running test suit: " + clArgs[0]);
    testSuit[clArgs[0]](clArgs[1]);
  } else {
    console.log("Test suit does not exist: " + clArgs[0]);
    console.log("Available tests:");
    for (let key in testSuit){
      if (testSuit.hasOwnProperty(key)){
        console.log("- " + key);
      }
    }
    console.log("\nTo run an individual test, include it as the first argument.");
    console.log("Example:  node objectCreator.js sectorTests1");
  }
}
function entityObjTests(){
  var theShip=new EntityObj("ENTITY_SHIP_Hello_There");
  console.log("My ship is named: " + colorize(theShip.name()));
  console.log("Is my ship loaded?: " + colorize(theShip.loaded()));
  console.log("It has a default value of: " + colorize(theShip.toString()));
  console.log("It has a total block count of: " + colorize(theShip.blocks()));
  console.log("It is currently in sector: " + colorize(theShip.sector().toString()));
  console.log("And its very strange orientation coords are: " + colorize(theShip.orientation()));
  console.log("And here's all the data, mapified:");
  console.dir(theShip.dataMap());
  console.log("And here's all the data as an object:");
  console.log(colorize(theShip.dataObj()));


  console.log("New entityObj: ");
  console.dir(theShip);
  console.log("\n");
  console.log("Ship faction number: " + theShip.faction().number);

  Object.keys(theShip).forEach(function(key){
    if (theShip.hasOwnProperty(key)){ // This is to filter out prototype values
      if (typeof theShip[key] == "object"){
        process.stdout.write(key + ": (type: " + typeOfObj(theShip[key]) + ") ");
        console.log(theShip[key]);
      } else if (typeof theShip[key] == "function"){
        let tempVal=theShip[key]();
        if (typeof tempVal == "object"){
          process.stdout.write(key + ": (type: " + typeOfObj(tempVal) + ") ");
          console.log(tempVal);
        } else if (typeof tempVal == "string"){
          console.log(key + ": " + tempVal);
        } else {
          console.dir(tempVal);
        }
        // console.log(key + ": " + theShip[key]());
      } else if (typeof theShip[key] == "string"){
        console.log(key + ": " + theShip[key]);
      }
    }
  });

  console.log("UID: " + theShip.UID);
  console.log("fullUID: " + theShip.fullUID);
}
function sectorTests(){
  var theSector=new SectorObj(2,2,2);
  var chmodResults;
  console.log("Start:");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- peace");
  console.log("-Peace Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- protected");
  console.log("-Protected Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ peace");
  console.log("Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ protected");
  console.log("Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ nofploss");
  console.log("+ nofploss Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noindications");
  console.log("+ noindications Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noexit");
  console.log("+ noexit Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("+ noenter");
  console.log("+ noenter Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noexit");
  console.log("- noexit Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noindications");
  console.log("- noindications Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- noenter");
  console.log("- noenter Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- nofploss");
  console.log("- nofploss Result: " + chmodResults);
  starNet("/force_save");
  console.log("Protection Num: " + theSector.getChmodNum() + " Protections: " + theSector.getChmodArray());

  chmodResults=theSector.setChmod("- frakkin");
  console.log("Attempt at a bullshit change: " + chmodResults);
  // chmodResults=theSector.setChmod("+ noindications");
  // console.log("Attempt at + noindications: " + chmodResults);
  // chmodResults=theSector.setChmod("- noindications");
  // console.log("Attempt at - noindications: " + chmodResults);
  return true;
}
function sectorTests2(){
  var theSector=new SectorObj(2,2,2);
  console.log("Resetting for start:");
  theSector.setChmodNum(0);
  console.log("Performing test 1");
  var test1time=sectorTestHelper2(theSector);
  console.log("Resetting..");
  theSector.setChmodNum(0);
  console.log("Performing test 2");
  var test2time=sectorTestHelper2(theSector,{forcesave:true});
  console.log("Test 1 time: " + test1time + " test 2 time: " + test2time);
}
function sectorTests3(){
  var theSector=new SectorObj(2,2,2);
  console.log("Resetting for start:");
  theSector.setChmodNum(0);
  console.log("Performing test 1");
  var test1time=sectorTestHelper3(theSector);
  console.log("Resetting..");
  theSector.setChmodNum(0);
  console.log("Performing test 2");
  var test2time=sectorTestHelper3(theSector,{forcesave:true});
  console.log("Test 1 time: " + test1time + " test 2 time: " + test2time);
}
function starNetHelperTests(){
  starNet("/load_sector_range 2 2 2 2 2 2");
  var testObj=new starNetHelper.ShipInfoUidObj("ENTITY_SHIP_Hello_There");
  console.log("\nDisplaying object (size: " + testObj.size + "):");
  console.dir(testObj);
  console.log("\nWhat is SqlQuery?");
  console.dir(sqlQuery);

  var sqlQueryObj=new sqlQuery.SqlQueryObj("SELECT * FROM PUBLIC.SECTORS WHERE X=2 AND Y=2 AND Z=2;");
  console.log("\nSql query: ");
  console.dir(sqlQueryObj);

  var shipBlocks=starNetHelper.getEntityValue("ENTITY_SHIP_Hello_There","Blocks");
  console.log("\nBlocks: " + shipBlocks);
}
function sectorTestHelper3(theSector,options){
    var startTime=Date.now();
    var randomNum=0;
    for (let i=1;i<=50;i++){
      randomNum=Math.floor(Math.random()*64);
      sectorTestHelper(theSector,randomNum,options);
    }
    sectorTestHelper(theSector,50,options); // These should be super fast since no changes are needed.
    sectorTestHelper(theSector,50,options);
    var timeDifference=colorize(Math.round((Date.now() - startTime) / 1000));
    console.log("Total time: " + timeDifference + " seconds.");
    return timeDifference;
}
function sectorTestHelper2(theSector,options){
    var startTime=Date.now();
    for (let i=1;i<=50;i++){
      sectorTestHelper(theSector,i,options);
    }
    sectorTestHelper(theSector,50,options); // These should be super fast since no changes are needed.
    sectorTestHelper(theSector,50,options);
    var timeDifference=colorize(Math.round((Date.now() - startTime) / 1000));
    console.log("Total time: " + timeDifference + " seconds.");
    return timeDifference;
}
function sectorTestHelper(sectorObj,inputNum,options){
  // console.log("\nSetting sector, '" + sectorObj.toString() + "', to chmod number: " + inputNum + " Values need to be: " + decodeChmodNum(inputNum));
  sectorObj.setChmodNum(inputNum,options);
  // starNet("/force_save");
  // console.log("New Chmod Num: " + sectorObj.getChmodNum() + " Chmods: " + sectorObj.getChmodArray());
}
// TESTING END

function ServerObj(starMadeInstallFolder,javaArgs){
  // The goal here is to have this object be the root of running server based commands, such as force_save, shutdown, etc.
  // Information like the port, path to starmade, etc, should appear in here.

  // TODO:  This should do all the installation, verification, spawning, etc, necessary to get this spawn up and running and then add it's PID to the lock file.
  this.spawn=spawn("java",javaArgs,{"cwd": starMadeInstallFolder});
  this.cfgFile=path.join(starMadeInstallFolder,"server.cfg");
  this.cfg=ini.getFileAsObj(this.cfgFile);
}

function MessageObj(sender,receiver,receiverType,message){
  // Takes string values and converts to strings or objects of the correct types
  this.sender=new PlayerObj(sender); // This should ALWAYS be a player sending a message
  if (receiverType=="DIRECT"){ // This is a private message sent from one player to another
    this.type="private";
    this.receiver=new PlayerObj(receiver);
  } else if (receiverType=="CHANNEL"){
    this.type="channel";
    this.receiver=new ChannelObj(receiver);
  } else { // This should never happen, but hey maybe in the future they'll expand on the receiverTypes
    this.receiver=receiver;
    this.type=receiverType;
    console.error("ERROR: Unknown Receiever type for message! Set receiver and type as string! " + receiverType);
  }
  this.text=message;
}
function ChannelObj(channelName){
  var factionTest=new RegExp("^Faction-{0,1}[0-9]+");
  if (channelName == "all"){
    this.type="global";
  } else if (factionTest.test(channelName)){
    var getFactionNumber=new RegExp("-{0,1}[0-9]+$");
    this.type="faction";
    this.factionNumber=channelName.match(getFactionNumber);
  } else {
    this.type="named";
  }
  this.name=channelName;
}
function IPObj(ipAddressString,date){
  this.address=ipAddressString;
  if (date){
    this.date=date;
  }
  // TODO: Add Info Methods:
  // date - This will only be set if the IP is attached to a date somehow, such as when listing all the IP's for a player

  // Action Methods:
  // ban(time) - PERM BAN if no time given, otherwise a temp ban

  // Optional:
  // crawl(Num) - reveals all players who share the same IP.  If a Num is provided, then will crawl that level deep, gathering more IP's and ipcrawling those.
}
function SMName(smName){
  this.name=smName;
  // TODO: Add Info methods:

  // Action methods:
  // ban
  // banTemp(Minutes)

  // Using SQL queries:
  // getNames - Returns an array of PlayerObj's for all the usernames associated with this registry account name
}
function PlayerObj(playerName){
  if (playerName){
    this.name=playerName;
    // TODO: Add Info methods:
    // smName - returns a SmNameObj
    // ip - returns an IPObj with the player's last IP in it
    // ips - returns an array of IPObj's with all unique IP's.  Also sets the "date" function for each one.
    // faction - Returns the FactionObj of their faction
    // currentEntity - Returns the EntityObj of the entity they are currently in
    // battleModeSector - Returns the player's designated battlemode sector, which is unique to every player

    // Action methods:
    // kill - kills the player using "/kill_character [Name]"
    // kick(reasonString) - kicks the player from the server.  ReasonString is optional.
    // addToFaction([FactionObj/FactionNum]) -- Switches the player to a specific faction
    // setFactionRank - Sets the player's rank within their current faction if they are in one.
    // addAdmin - Adds this player as an admin to the server
    // removeAdmin - Removes this player as an admin to the server
    // addAdminDeniedCommand([One,or,more,commands]) - This can be an array or string.  If an array, it will cycle through the array, adding each denied command for the specific admin
    // removeAdminDeniedCommand([One,or,more,commands]) - This can be an array or string.  If an array, it will cycle through the array, removing each denied command for the specific admin.  Uses: /remove_admin_denied_comand [PlayerName] [CommandToRemove]
    // ban(true/false,ReasonString,Time) - true/false is whether to kick.  Time is in minutes.
    // banAccount - Bans the player by their registry account - this is a PERM ban
    // banAccountTemp(NumberInMinutes) - Bans the player by their registry account temporarily
    // banPlayerName - Bans the player by their playername - this is a PERM ban
    // banPlayerNameTemp(NumberInMinutes) - Bans the player by their playername temorarily
    // banIP - Bans the player by IP - PERM BAN - My Notes: Might use "/ban_ip_by_playername [PlayerName]" or "/ban_ip 1.1.1.1" if that is unreliable
    // banIPTemp(NumberInMinutes) - Bans player by IP - Temp - My Notes: Can use "/ban_ip_by_playername_temp [PlayerName] 1" or "/ban_ip_temp 1.1.1.1 1" if that is unreliable

    // changeSector("[X],[Y],[Z]", SectorObj, or CoordsObj) - teleports the player to a specific sector
    // changeSectorCopy("[X],[Y],[Z]", SectorObj, or CoordsObj) - teleports the player to a specific sector, leaving behind a copy of whatever entity they were in, duplicating it

    // creativeMode(true/false) - Turns creative mode on or off for the player "/creative_mode player true/false"
    // godMode(true/false) - Sets godmode to true or false for the player using /god_mode
    // invisibilityMode(true/false) - Sets invisibility to true or false for the player using /invisibility_mode

    // factionCreate(NewFactionNameString) - This creates a new faction and sets the player as the leader - I am unsure what the /faction_create command will do if a faction of the same name already exists, but I'm guessing it will just duplicate it.
    // factionCreateAs(NewFactionNameString,FactionNum) - This creates a new faction with a specific faction number and sets the player as the leader - I am unsure what the /faction_create_as command will do if the faction number already exists..

    // give(ElementNameString,Count) - Gives the player the number of blocks by element name - ONLY WORKS IF THE PLAYER IS ONLINE - Example: player.give("Power",10)
    // giveID(ElementIDNum,Count) - Gives the player the number of blocks by element ID number - ONLY WORKS IF THE PLAYER IS ONLINE- Example: player.giveID(2,10)
    // giveAllItems(Count) - Gives the player all blocks of a certain number
    // giveCategoryItems(Count,categoryNameString) - Gives the player all blocks of a certain number by category
    // giveCredits(Num) - Gives a certain number of credits to the player.  Will subtract if a negative number used.  Returns the new total credits the player has.

    // giveGrapple - Gives the player a grapple gun
    // giveGrappleOP - Gives the player an OP grapple gun
    // giveHealWeapon
    // giveLaserWeapon
    // giveLaserWeaponOP
    // giveMarkerWeapon
    // giveTransporterMarkerWeapon
    // givePowerSupplyWeapon
    // giveRocketLauncher
    // giveRocketLauncherOP
    // giveSniperWeapon
    // giveSniperWeaponOP
    // giveTorchWeapon
    // giveTorchWeaponOP

    // giveLook(Count) - Gives the player a number of whatever block they are currently looking at
    // giveSlot(Count) - Gives the player a number of whatever block they have selected on their hotbar
    // giveMetaItem(String) - Gives the player a meta item based on it's name, such as recipe, log_book, helmet, build_prohibiter, etc.

    // protect(smNameString/SMNameObj) - Sets this current player name to be protected under a specific registry account
    // unprotect - This unsets registry protection for this player name - WARNING:  This will allow anyone to log in under this name in the future!

    // serverMessage(MessageString,info/warning/error) - Sends a private message to this specific player.  If no method is specified "plain" is used, which shows up on the player's main chat.

  } else {
    throw new Error("ERROR: No playername provided to playerObj constructor!");
  }
}
function SystemObj(x,y,z){
  this.coords=new CoordsObj(x,y,z);
  // TODO: Add Info methods:
  // center - returns the center set of coordinates as a SectorObj
  // type - returns the system type, so black hole, star, giant, double star, void

  // Action Methods:
  // load - Uses "/load_system x y z" to load the whole system.

  // This can be expanded to allow storing information, such as a description, if more than values than expected are given to the constructor
  if (arguments.length > SystemObj.length){
    var extraInfoArray=[];
    for (let i=SystemObj.length-1;i<arguments.length;i++){
      extraInfoArray.push(arguments[i]);
    }
    this.extraInfo=extraInfoArray;
  }
}
function SpawnObj(playerName,time){ // time is optional.  Current time is used if not provided.
  if (!time){
    this.time=Date.now();
  } else if (isNaN(parseInt(time))){
    console.error("ERROR: Invalid time given to SpawnObj constructor.  Expected epoch time!  Using current time instead!");
    this.time=Date.now();
  }
  this.player=new PlayerObj(playerName);
  // Right now there really are no console commands for spawn mechanics, but a separate object is used here in case there are in the future.
}
function BluePrintObj(bluePrintName){
  this.name=bluePrintName;
  // Info Methods to add:
  // folder - Gets the path to the folder the blueprint is in

  // Action Methods:
  //
}
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

function SectorObj(x,y,z){
  // TODO: Add Info methods:
  // getSystem - Returns a SystemObj

  // Add Action Methods:
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

  // TODO: add alternative inputs, such as "x y z" or "[x,y,z]" or a coordinates object

  if (typeof x == "number" && typeof y == "number" && typeof z == "number"){
    this.coords=new CoordsObj(x,y,z);
    this.toArray=function(){ this.coords.toArray() };
    this.load=function(){
      // This returns "true" if the command ran, false for anything else, such as if the server was down.
      let theResponse=starNet("/load_sector_range " + this.coords.toString() + " " + this.coords.toString());
      return starNetHelper.detectRan(theResponse);
    };
    this.setChmod=function(val){ // val should be a string
      // This will return true if it was a success, false otherwise.
      // Example vals:  "+ peace" or "- protected"
      return sectorSetChmod(this.coords,val)
    };
    this.getChmodArray=function(){
      return decodeChmodNum(getChmodNum(this.coords))
    };
    this.getChmodNum=function(){
      return getChmodNum(this.coords);
    };
    this.setChmodNum=function(newNum,options){ // Only has 1 option, which is to do a forcesave and then intelligently add/remove chmod values rather than the default of bruteforcing adding all needed and removing all unneeded.
      return sectorSetChmodNum(this.coords,newNum,options);
    }


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
  this.coords=function(){ return new CoordsObj(x,y,z) }; // This is to allow a sectorObj to gracefully morph into a CoordsObj and for a CoordsObj to be duplicated and then possibly modified.
  this.toArray=function(){ return [this.x, this.y, this.z]; }
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
function EntityObj(fullUID){
  // This builds an entity object based on the full UID
  // This can be used for ships and stations.  Please use PlanetObj for planets and AsteroidObj for asteroids.
  if (fullUID){
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


    this.load=function(){
      // This returns "true" if the command ran, false for anything else, such as if the server was down.
      return this.sector().load();
    };
    // this.toString=function(){ return this.fullUID.toString() }; // This is visible as an element, so really we should set the prototype outside of the constructor.

    // TODO: Add Info methods:
    // system - returns a SystemObj of the current system the entity is within
    // isClaimPoint - returns boolean true/false value if the entity is the claim point for the system it is within
    // attached - returns an array of attached PlayerObj's
    // dockedUIDs - returns an array of docked EntityObj's

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

// Regular Functions
function getChmodNum(sectorObjArrayOrString){
  // This performs a sql query and returns the protections number for a sector as a number
  // Input can be a SectorObj,CoordsObj, Array of 3 numbers, or a string with a space or comma separating each value.  The preferred type is a SectorObj
  // Example inputs:
  // mySectorObj
  // 2,2,2
  // 2 2 2
  // [2,2,2]
  var returnNum=0;
  var coordsToUse=[];
  // Preprocess the input since it can be 3 different types of values
  const trueType=typeOfObj(sectorObjArrayOrString);
  if (trueType=="SectorObj"){
    coordsToUse=sectorObjArrayOrString.coords.toArray();
  } else if (trueType=="CoordsObj"){
    coordsToUse=sectorObjArrayOrString.toArray();
  } else if (typeof sectorObjArrayOrString == "string") {
    if (sectorObjArrayOrString.indexOf(" ")){
      coordsToUse=sectorObjArrayOrString.trim().split(" ");
    } else if (sectorObjArrayOrString.indexOf(",")){
      coordsToUse=sectorObjArrayOrString.trim().split(",");
    } else {
      throw new Error("ERROR: Invalid string given to function, getChmodNum!");
    }
  } else if (trueType=="Array"){ // TODO: Test to ensure "Array" is returned and not "array"
    if (sectorObjArrayOrString.length == 3){
      coordsToUse=sectorObjArrayOrString;
      // I could keep checking each value in the array to ensure they are numbers and throw an error if not.. but meh.
    } else {
      throw new Error("ERROR: Invalid array given to getChmodNum function!  Expected an array of 3 numbers!");
    }
  } else {
    throw new Error("ERROR: Invalid input given to getChmodNum function!  Expected a SectorObj, coordinates string, or array of 3 numbers!");
  }
  // console.log("Using coords: " + coordsToUse);
  if (coordsToUse.length == 3){
    var theQuery="SELECT PROTECTION FROM PUBLIC.SECTORS WHERE X=" + coordsToUse[0] + " AND Y=" + coordsToUse[1] + " AND Z=" + coordsToUse[2] + ";";
    var theQueryResult=new SqlQueryObj(theQuery);
    // console.log("sqlquery result:");
    // console.dir(theQueryResult);
    if (theQueryResult["error"] == false){ // If there were no results, it means the sector is not in the HSQL database and should have a default protection value of 0
      if (theQueryResult["mapArray"][0].has("PROTECTION")){ // if there was an entry, there SHOULD be a PROTECTION value, but just in case, let's check for it.
        returnNum=theQueryResult["mapArray"][0].get("PROTECTION");
        // console.log("Number found: " + returnNum);
      }
    }
  } else {
    throw new Error("ERROR: Invalid number of coordinates given to function, getChmodNum! Coordinates given: " + coordsToUse.length);
  }
  return toNum(returnNum);
}
function decodeChmodNum(num){ // A number should be provided, but a number as a string should be coerced into a number.
  // This converts a chmod number value from a sql query to an array of strings, such as ["peace","protected","noindications"].  Values are always returned in an array, even if only a single protection is in the number.  A 0 number will return an empty array.
  var theNum=toNum(num);
  if (typeof theNum == "number"){
    var returnArray=[];
    var numberOfProtections=sectorProtectionsArray.length;
    var exponentValue=numberOfProtections - 1;
    var highestValue=Math.pow(2,exponentValue);  // The "highestValue" is what each potential value in the array represents, starting with the first value in the array
    var highestTotal=Math.pow(2,numberOfProtections);
    if (num <= highestTotal && num > 0){ // Valid numbers can only be lower/equal to the highest total or larger than 0
      for (let i=0;i<sectorProtectionsArray.length && theNum > 0;i++){
        if (theNum >= highestValue){
          returnArray.push(sectorProtectionsArray[i]);
          theNum -= highestValue
        }
        highestValue /= 2; // Halve it!
      }
    } else if (theNum > highestTotal){
      console.error("ERROR: Number given to decodeChmodNum function was too large!  It should be no more than " + highestTotal + "!")
    } else if (theNum < 0){
      console.error("ERROR: Number given to decodeChmodNum function was too small!  It should always be an integer larger than 0!");
    }
    return returnArray;
  } else {
    throw new Error("ERROR: Invalid input given to function, decodeChmodNum!  Expected a number!");
  }
}
function sectorSetChmod(coordsObj,stringOrArray){ // val can be a string or an array of strings
  // This can be used to set multiple chmod values at the same time
  // Simple example:  sectorSetChmod(mySectorObj,"+ protected"); // This sets the sector number from mySectorObj to add protected, returning true or false depending on the success.
  // Using Array: sectorSetChmod(mySectorObj,["+ protected","- peace","- noindications"]); // This will cycle through the array and set each chmod, and then will return an array of true/false values corresponding to each string given.
  // Note that when false values are given, it simply means the chmod failed, but does not give a reason why.  For example, if "+ nonsense" is given, it will return false.  If the server is down and StarNet.jar couldn't connect, it will also return false.
  // Handling false values is up to the script invoking this function.
  let theType=objHelper.getObjType(stringOrArray);
  console.log("Setting chmod values for: " + stringOrArray);
  // console.log("sectorSetChmod running!");
  if (theType == "string"){
    // console.log("Setting " + val + " for sector: " + coordsObj.toString());
    let theValLower=stringOrArray.toLowerCase();
    let theCommand="/sector_chmod " + coordsObj.toString() + " " + theValLower;
    return starNetHelper.detectSuccess(starNet(theCommand));
  } else if (theType == "Array"){
    var resultsArray=[];
    for (let i=0;i<stringOrArray.length;i++){
      let theSubType=objHelper.getObjType(stringOrArray[i]);
      if (theSubType == "string"){
        let theValLower=stringOrArray[i].toLowerCase();
        resultsArray.push(starNetHelper.detectSuccess(starNet("/sector_chmod " + coordsObj.toString() + " " + theValLower)));
      } else {
        resultsArray.push(false);
      }
    }
    return resultsArray;
  } else {
    return new Error("Invalid sector chmod value given!");
  }
}


function sectorSetChmodNum(coordsOrSectorObj,newChmodNum,options){ // Options are optional.
  // There are two strategies we can use here:
  // 1. We can do a force save, then pull the existing values and only add or remove the ones needed.  This way will display an annoying auto-save popup for everyone everytime it runs, but will be faster.
  // 2. We can brute force things and always perform the positive of what is being added and remove any other values not desired.  This way is slow, but no annoying popup for everyone.  This is the default.
  // Example to use force safe:  sectorSetChmodNum(coordsObj,25,{forcesave:true})
  var forceSave=false;
  if (typeof options == "object"){ // Parse the options
    if (options.hasOwnProperty("forcesave")){
      if (options["forcesave"] === true){ // We only want to enable it if it is exactly set to true, not a truthy value
        forceSave=true;
      }
    }
  }
  var theCoords=coordsOrSectorObj.toString();
  var arrayToUse=[];

  if (forceSave == true){
    // try {
      starNetVerified("/force_save");
      var currentChmodNum=getChmodNum(coordsOrSectorObj);
      arrayToUse=getProtectionsDifferentialString(currentChmodNum,newChmodNum);
    // } catch (error) {
    //   console.error("Unable to set chmod for sector, " + theCoords + ", to protection number, " + newChmodNum + "!");
    //   console.error("Error message: " + error.message);
    // }
  } else {
    // brute force it.  It's the only option that won't have globally annoying consequences, even if it is a bit slow.
    arrayToUse=buildChmodStringFromNum(newChmodNum);
  }
  if (arrayToUse.length > 0){ // If the array is empty, it means no changes were needed
    return sectorSetChmod(theCoords,arrayToUse);
  } else {
    return [true]; // Since no changes were needed, we can just return an array with a single true value to indicate success
  }
}
function buildChmodStringFromNum(newChmodNum){
  var outputArray=[];
  var chmodValuesToGive=decodeChmodNum(newChmodNum);
  var chmodValuesToRemove=getInverseProtectionsArrayFromNum(newChmodNum);
  for (let i=0;i<chmodValuesToGive.length;i++){
    outputArray.push("+ " + chmodValuesToGive[i]);
  }
  for (let e=0;e<chmodValuesToRemove.length;e++){
    outputArray.push("- " + chmodValuesToRemove[e]);
  }
  return outputArray;
}


function getProtectionsDifferentialString(currentProtectNum,newProtectNum){ // The current sector protection number and what the new number should be
  var currentProtection=decodeChmodNum(currentProtectNum);

  var whatItNeeds=decodeChmodNum(newProtectNum);
  var whatItDoesntNeed=getInverseProtectionsArrayFromArray(whatItNeeds); // These are all the values it should not have

  var whatItNeedsAdded=subArrayFromAnother(currentProtection,whatItNeeds); // This ensures we're only adding what it needs
  var whatItNeedsRemoved=findSameFromTwoArrays(currentProtection,whatItDoesntNeed); // This ensures we're only removing a chmod it already has

  // TODO: Finish this.
  var outputArray=[];
  for (let i=0;i<whatItNeedsAdded.length;i++){
    outputArray.push("+ " + whatItNeedsAdded[i]);
  }
  for (let i=0;i<whatItNeedsRemoved.length;i++){
    outputArray.push("- " + whatItNeedsRemoved[i]);
  }
  return outputArray; // An array of strings, ready for chmodding
}

function findSameFromTwoArrays(arrayOne,arrayTwo){ // This compares two arrays, outputting a new array of shared values
  var outputArray=[];
  for (let i=0;i<arrayOne.length;i++){
    if (arrayTwo.indexOf(arrayOne[i]) !== -1){
      outputArray.push(arrayOne[i]);
    }
  }
  return outputArray;
}

function getInverseProtectionsArrayFromNum(num){
    var array=decodeChmodNum(num);
    return getInverseProtectionsArrayFromArray(array);
}
function getInverseProtectionsArrayFromArray(arrayToInvert,baseProtectionsArray){ // baseProtectionsArray is optional.  This is used to whittle down based on pre-existing protections, scheduling for removal.
  var arrayToUse=[];
  if (baseProtectionsArray){
    arrayToUse=copyArray(baseProtectionsArray);
  } else {
    arrayToUse=copyArray(regExpHelper.sectorProtections);
  }
  return subArrayFromAnother(arrayToInvert,arrayToUse);
}

function subArrayFromAnother(arrayToSubtract,arrayToSubtractFrom){
  var outputArray=copyArray(arrayToSubtractFrom);
  var indexNum;
  for (let i=0;i<arrayToSubtract.length;i++){
    indexNum=outputArray.indexOf(arrayToSubtract[i]);
    if (indexNum !== -1){
      outputArray.splice(indexNum,1);
    }
  }
  return outputArray;
}
// TODO: Create a function that gives a specific protection a value based on the sectorProtections array.
// TODO: Create a function that converts an array of protection names to a total number

module.exports={
  ServerObj,
  SqlQueryObj,
  EntityObj,
  SectorObj,
  CoordsObj,
  FactionObj,
  MessageObj,
  ChannelObj,
  IPObj,
  SMName,
  SystemObj,
  SpawnObj,
  BluePrintObj
}
