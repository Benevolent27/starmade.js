module.exports={"init":init};

function init(event){
  console.log("#!#!# test mod loaded!  #!#!#");
  var path=require("path");
  var binFolder=path.join("..","..","bin");
  var objectCreator=require(path.join(binFolder,"objectCreator.js"));
  var objectHelper=require(path.join(binFolder,"objectHelper.js"));

  event.on('message', function(msg) { // Handle messages sent from players

    let playerObj = new objectCreator.PlayerObj("Benevolent27"); // Just testing how requiring the objectCreator.js works
    playerObj.msg("The new object was created successfully!"); // Just testing how requiring the objectCreator.js works


    if (msg.text == "!test" ){
      msg.sender.msg("The test succeeded!");
    }

    if (msg.text == "!sql"){
      var theQuery=new objectCreator.SqlQueryObj("Select * from PUBLIC.PLAYERS where name='" + msg.sender.name.toLowerCase() + "';")
      console.dir(theQuery);
      playerObj.msg("Your faction number from MAP: " +  theQuery.mapArray[0].get("FACTION"));
      // var theQueryObjArray=theQuery.objArray();
      // var theQueryObj=theQueryObjArray[0];
      // playerObj.msg("Your faction number from OBJECT: " +  theQueryObj.FACTION);
      playerObj.msg("Your faction number from OBJECT: " +  theQuery.objArray[0].FACTION);

    }
  });
  event.on('playerSpawn', function(playerObj) {
    playerObj.msg("Melvin: Hello and welcome to the server!");
  });
}
