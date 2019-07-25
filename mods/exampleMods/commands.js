global.event.on("init", function(){
    global.regCommand({
        "name":"command",
        "category":"General"
    });
});
global.event.on("command",function(player,command,args,messageObj) {
    if (command == "command"){
        console.log("!command ran!");
        player.botMsg("Congratulations!  You just ran the \"command\" command!");
    }
});
