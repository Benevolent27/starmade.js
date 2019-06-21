// module.exports = init;

module.exports={ "init":init }

function init(eventEmitter,server){
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  console.log("#!#!# test mod loaded!  #!#!#");
  
  
    // #####  PLAYER MESSAGES  #####
  eventEmitter.on('message', function(messageObj) { // Handle messages sent from players
    // Expects message to be a message type object
    console.log("Message (type: " + messageObj.type +") DETECTED from " + messageObj.sender.name + " to " + messageObj.receiver.name + ": " + messageObj.text);
    if (messageObj.text == "!test" ){
      console.log("!test found bitches!");
      let mMessage="/server_message_to plain " + messageObj.sender.name + " 'Melvin: Test successful!'";
      server.stdin.write(mMessage.toString().trim() + "\n");
    }
  });
	return false;
  
}
