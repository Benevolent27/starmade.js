// The purpose of this default mod is to process commands and fire off the command event.

var {event,eventEmitter,commands,objectHelper,settings}=global;
var {isInArray}=objectHelper;






event.on('message', function(messageObj) { // Handle messages sent from players
    // Expects message to be a message type object
    console.log("Message (type: " + messageObj.type +") DETECTED from " + messageObj.sender.name + " to " + messageObj.receiver.name + ": " + messageObj.text);
    // Here we will need to see if the "commands" object has the command.
    if (messageObj.text[0] == settings["commandOperator"]){ // Process any commands, whether valid or not.
        // TODO:  Add admin only commands and commands that will only be given to specific players.
        var textArray=messageObj.text.split(" ");
        var theCommand=textArray.shift().replace(settings["commandOperator"],""); // This only replaces the first instance
        if (objectHelper.testIfInput(theCommand)){ // This will exclude any empty values.  For example, typing ! by itself.
        var lowerCaseCommand=theCommand.toLowerCase();
        if (commands.hasOwnProperty(lowerCaseCommand)){ // If it is a valid command, it will have been registered.
            // Note:  the default "help" command can be replaced by a mod if desired.
            eventEmitter.emit('command',messageObj.sender,lowerCaseCommand,textArray,messageObj);
            console.log("'command' event emitted!"); // temp
        } else if (lowerCaseCommand=="help"){ // This only fires if a mod hasn't replaced the default help.
            // If an argument is given, run the command with help, which is the same as "!command help"
            if (objectHelper.testIfInput(textArray[0])){
            var subCommand=textArray[0];
            var lowerCaseSubCommand=textArray[0].replace(settings["commandOperator"],"").toLowerCase();
            if (commands.hasOwnProperty(lowerCaseSubCommand)){
                textArray.unshift("help");
                eventEmitter.emit('command',messageObj.sender,lowerCaseSubCommand,textArray,messageObj); // The messageObj is unchanged, so a mod can detect if it was ran with the !help command or "!command help" if needed for some reason.
                // This expects the mod to handle any help request. If it doesn't process the help request, this is the mod creator's fault.  This cannot verify help exists for the command.
            } else {
                messageObj.sender.botMsg("ERROR:  \"" + subCommand + "\" is not a valid command, so there is no help for it!");
                messageObj.sender.botMsg("To view a list of wrapper commands, type: !help");
            }
            } else {
            // If no arguments are given, then display all the commands in an orderly way
            // First we need to build the values needed to display
            var commandCategories={};
            var theCategory="";
            for (var property in commands) {
                if (commands.hasOwnProperty(property)) {
                // This enumerates through all commands to get a list of unique categories

                if (commands[property].hasOwnProperty("category")){
                    if (objectHelper.testIfInput(commands[property].category)){
                    if (typeof commands[property].category == "string"){
                        theCategory=commands[property].category;
                    }
                    }
                }
                if (!objectHelper.testIfInput(theCategory)){ // If no category listed, give it the default
                    theCategory="General";
                }
                // isInArray, // Checks an array for a value.  Usage:  isInArray(inputArray,ValueToCompare)
                if (!commandCategories.hasOwnProperty(theCategory)){ // If the commandCategories doesn't have the array for the unique category yet, create it.
                    commandCategories[theCategory]=[];
                }
                commandCategories[theCategory].push(commands[property].name);
                theCategory=""; // Reset the category
                }
            }
            // commandCategories should now be an object that contains all the unique categories with arrays for each command in that category
            console.dir(commandCategories); // temp

            var maxLineCount=60; // This is the max size a line can be before command spill out to the next line.
            // var commandSpacerNum=2;
            // var commandSpacer=repeatString(" ",commandSpacerNum);
            var commandSpacer="  /  ";
            var commandSpacerNum=commandSpacer.length;
            var theArrayToWorkOn=[];
            var tempArrayOfStrings=[];
            var tempArrayOfStringsCounter=0;
            var theCommandTemp="";
            for (var theCategoryFromArray in commandCategories) { // This cycles through all the unique command categories
                if (commandCategories.hasOwnProperty(theCategoryFromArray)) {
                // We need to rebuild the arrays to a max length
                theArrayToWorkOn=commandCategories[theCategoryFromArray];
                for (let i=0;i<theArrayToWorkOn.length;i++){ // Cycle through the array of commands for the category
                    theCommandTemp=theArrayToWorkOn[i];
                    if (tempArrayOfStrings[tempArrayOfStringsCounter]){ 
                    // it has been created, so see if adding the command would put it over the top, and if so, add to the next array
                    if (tempArrayOfStrings[tempArrayOfStringsCounter].length + commandSpacerNum + theArrayToWorkOn[i].length <= maxLineCount){
                        tempArrayOfStrings[tempArrayOfStringsCounter]+=commandSpacer + theArrayToWorkOn[i]; // This adds to the array entry string
                    } else {
                        tempArrayOfStringsCounter++
                        tempArrayOfStrings.push(theCommandTemp); // This creates a new array entry
                    }
                    } else {
                    // The split array hasn't been created yet, so just add the command to it
                    tempArrayOfStrings.push(theCommandTemp);
                    }
                }
                // We should now have a new array of strings chopped to the desired length
                commandCategories[theCategoryFromArray]=tempArrayOfStrings;
                tempArrayOfStrings=[];
                tempArrayOfStringsCounter=0;
                }
            }
            // The commandCategories object should now be rebuilt so each category has arrays of strings that can be provided to the player
            console.dir(commandCategories); // temp
            // Assuming there are categories, we need to cycle through the categories again, only displaying them once per player and adding filler to lines that do not contain the category
            // If there are no categories, then the bot should just state there are no commands presently on the server.
            var theFinalArray=[];
            var categoriesListed=[];
            messageObj.sender.botMsg("I can perform the following commands:","",{"fast":true});
            for (var finalCategory in commandCategories) {
                if (commandCategories.hasOwnProperty(finalCategory)) {
                theFinalArray=commandCategories[finalCategory];
                for (let i=0;i<theFinalArray.length;i++){
                    if (!isInArray(categoriesListed,finalCategory)){
                    // messageObj.sender.msg("- " + repeatString(" ",finalCategory.length * 2) + spacerAfterCategory + theFinalArray[i],{"fast":true});
                    // } else {
                    // messageObj.sender.msg("- [ " + finalCategory + " ]:" + spacerAfterCategory + theFinalArray[i],{"fast":true});
                    messageObj.sender.msg(" ","",{"fast":true});
                    messageObj.sender.msg("-- " + finalCategory + " --","",{"fast":true});
                    categoriesListed.push(finalCategory);
                    }
                    messageObj.sender.msg("  " + theFinalArray[i],"",{"fast":true});
                }
                }
            }
            messageObj.sender.msg(" ","",{"fast":true});
            messageObj.sender.msg("To use a command, type " + settings["commandOperator"] + " + the command.","",{"fast":true});
            messageObj.sender.msg("For help on a command, type !help [command]","",{"fast":true});
            }
            console.log("Help command finished.");
        } else {
            messageObj.sender.msg("ERROR:  " + theCommand + " is not a valid command!","",{"fast":true});
            messageObj.sender.msg("To view a list of wrapper commands, type: !help","",{"fast":true});
        }
        }
    }
    });
