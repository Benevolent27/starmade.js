module.exports={"init":init};

function init(event,global){  // the event listener is always the first variable here, global is optional
  console.log("#!#!# test mod loaded!  #!#!#");
  var path=require("path");
  var {binFolder, objectCreator, objectHelper} = global; // Rather than having to manually load these values, they can be pulled from the globalObject passed to this mod
  // Set up custom Objects
  var {PlayerObj,SqlQueryObj}=objectCreator;
  event.on('message', function(msg) { // Handle messages sent from players
    let playerObj = new PlayerObj("Benevolent27"); // Just testing how requiring the objectCreator.js works
    playerObj.msg("The new object was created successfully!"); // Just testing how requiring the objectCreator.js works

    if (msg.text == "!test" ){
      msg.sender.msg("The test succeeded!");
    }

    if (msg.text == "!sql"){
      var theQuery=new SqlQueryObj("Select * from PUBLIC.PLAYERS where name='" + msg.sender.name.toLowerCase() + "';")
      console.dir(theQuery);
      playerObj.msg("Your faction number from MAP: " +  theQuery.mapArray[0].get("FACTION"));
      playerObj.msg("Your faction number from OBJECT: " +  theQuery.objArray[0].FACTION);

    }
  });

  event.on('playerSpawn', function(playerObj) {
    playerObj.msg("Melvin: Hello and welcome to the server!");
  });
}
