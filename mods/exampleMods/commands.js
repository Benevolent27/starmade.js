
global.event.on("init", init);
function init (){
    global.regCommand({
        "name":"command",
        "category":"General"
    });
};
global.event.on("command",command);
function command (player,command,args,messageObj) {
    if (command == "command"){
        console.log("!command ran!");
        player.botMsg("Congratulations!  You just ran the \"command\" command!");
    }
};
