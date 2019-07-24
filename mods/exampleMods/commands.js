module.exports={"init":init};
function init(event,global){
    global.regCommand({
        "name":"command",
        "category":"General"
    });
    event.on("command",function(player,command,args,messageObj) {
        if (command == "command"){
            console.log("!command found bitches!");
            player.msg("Melvin: What the fack do you want?");
        }
    });
}
