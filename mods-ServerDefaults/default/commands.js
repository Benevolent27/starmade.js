// The purpose of this default mod is to process commands and fire off the command event.
// It also provides the !help command.

// TODO:  Once promise methods are all done, switch this over to using them.

const path = require('path');
const fs = require('fs');



// Variables used by functions, which are not dependent on the server object:
const settingsFile = path.join(__dirname, "commandSettings.json");
var defaultSettings = {};

var {
  objectHelper,
  miscHelpers
} = global;
var {
  isInArray,
  testIfInput,
  getOption,
  isArray,
  toNumIfPossible
} = objectHelper;
var {
  isFile,
  isSeen,
  log
} = miscHelpers;
var commands = {};
var commandOperator;

var installObj = global.getInstallObj(__dirname);
var {settings,event} = installObj;
var serverObj = {}; // This will be set after the "start" is given.

CommandObj.prototype.toString = function () {
  return this.name
};
event.on('start', function (theServerObj) { // The serverObj has been created.
    serverObj=theServerObj;
    if (!serverObj.hasOwnProperty("commands")) { // Set up the global commands variable if it does not exist.
      serverObj.commands = {};
    }
    commands = serverObj.commands;
    commandOperator = settings["commandOperator"];
    importSettingsFile();
    verifySettings();
    // console.dir(defaultSettings);

    // Extenders - These will only be guaranteed available after the "init" event is triggered.
    // objectCreator["CommandObj"]=CommandObj;
    serverObj.regConstructor(CommandObj);
    serverObj["regCommand"] = regCommand; // Extend the serverObj
    serverObj["commandSettings"] = defaultSettings;
    event.on("reloadMods", removeCommands);
    // event.on("init", init);
    event.on('command', command);
    event.on('playerMessage', message);
    event.emit('commandStart', regCommand); // This signals that other mods can register their commands since the serverObj should have the needed methods.

    // Register the commands associated with this object
    serverObj.regCommand("changeHelpWidth", "HiddenHelpers", true, false);
    serverObj.regCommand("togglehide", "HiddenHelpers", true, false);
    serverObj.regCommand("helpCommandPrefix", "HiddenHelpers", true, false);
    serverObj.regCommand("helpCommandSpacer", "HiddenHelpers", true, false);
    serverObj.regCommand("helpCommandSuffix", "HiddenHelpers", true, false);
    serverObj.regCommand("helpCategoryPrefix", "HiddenHelpers", true, false);
    serverObj.regCommand("helpCategorySuffix", "HiddenHelpers", true, false);
    serverObj.regCommand("reloadHelpSettings", "HiddenHelpers", true, false);
    serverObj.regCommand("saveHelpSettings", "HiddenHelpers", true, false);
});

function removeCommands() {
  console.log("Removing any commands registered by mods..");
  serverObj["commands"] = {};
};
async function message(messageObj) { // Handle messages sent from players
  // Expects message to be a message type object

  // console.log("Message (type: " + messageObj.type +") DETECTED from " + messageObj.sender.name + " to " + messageObj.receiver.name + ": " + messageObj.text);

  // Here we will need to see if the "commands" object has the command.
  if (messageObj.text[0] == settings["commandOperator"]) { // Process any commands, whether valid or not.
    // TODO:  Add admin only commands and commands that will only be given to specific players.
    if (serverObj.hasOwnProperty("commands")){
      commands=serverObj.commands;
    }
    var textArray = messageObj.text.split(" ");
    var theCommand = textArray.shift().replace(settings["commandOperator"], ""); // This only replaces the first instance
    if (objectHelper.testIfInput(theCommand)) { // This will exclude any empty values.  For example, typing ! by itself.
      var lowerCaseCommand = theCommand.toLowerCase();
      if (commands.hasOwnProperty(lowerCaseCommand)) { // If it is a valid command, it will have been registered.
        // Note:  the default "help" command can be replaced by a mod if desired.
        let playerAdminCheck = true;
        if (commands[lowerCaseCommand].adminOnly) {
          playerAdminCheck = await messageObj.sender.isAdmin({"fast": true}).catch((err) => console.error(err)); // Fast makes it read from the file rather than perform a StarNet command.
        }
        if (playerAdminCheck) {
          event.emit('command', messageObj.sender, lowerCaseCommand, textArray, messageObj);
        } else {
          messageObj.sender.botMsg("Sorry, but this is an admin only command, and you are not an admin!", {"fast": true}).catch((err) => console.error(err));
        }

        console.log("'command' event emitted!"); // temp
      } else if (lowerCaseCommand == "help") { // This only fires if a mod hasn't replaced the default help.
        // If an argument is given, run the command with help, which is the same as "!command help"
        var showAll = false;
        if (typeof textArray[0] == "string") {
          if (textArray[0].toLowerCase() == "-showall") {
            console.log("Showing all help commands, even hidden ones, if the player is an admin.");
            showAll = true;
            textArray.shift();
          }
        }
        if (objectHelper.testIfInput(textArray[0])) {
          var subCommand = textArray[0];
          var lowerCaseSubCommand = textArray[0].replace(settings["commandOperator"], "").toLowerCase();
          if (commands.hasOwnProperty(lowerCaseSubCommand)) {
            textArray.unshift("help");

            let playerAdminCheck = true;
            if (commands[lowerCaseSubCommand].adminOnly) {
              playerAdminCheck = await messageObj.sender.isAdmin({"fast": true}).catch((err) => console.error(err)); // Fast makes it read from the file rather than perform a StarNet command, which is much faster.
            }
            if (playerAdminCheck) {
              event.emit('command', messageObj.sender, lowerCaseSubCommand, textArray, messageObj); // The messageObj is unchanged, so a mod can detect if it was ran with the !help command or "!command help" if needed for some reason.
            } else {
              messageObj.sender.botMsg("Sorry, you cannot receive help on this command because it is admin-only, and you are not an admin!", {"fast": true}).catch((err) => console.error(err));
            }

            // This expects the mod to handle any help request. If it doesn't process the help request, this is the mod creator's fault.  This cannot verify help exists for the command.
          } else {
            messageObj.sender.botMsg("ERROR:  \"" + subCommand + "\" is not a valid command, so there is no help for it!").catch((err) => console.error(err));
            messageObj.sender.botMsg("To view a list of wrapper commands, type: !help").catch((err) => console.error(err));
          }
        } else {
          // If no arguments are given, then display all the commands in an orderly way
          let playerAdminCheck = await messageObj.sender.isAdmin({"fast": true}).catch((err) => console.error(err));

          // First we need to build the values needed to display
          var commandCategories = {};
          var theCategory = "";
          var commandsAddedNum = 0;
          for (var property in commands) {
            if (commands.hasOwnProperty(property)) {
              // This enumerates through all commands to get a list of unique categories

              if (commands[property].hasOwnProperty("category")) {
                if (objectHelper.testIfInput(commands[property].category)) {
                  if (typeof commands[property].category == "string") {
                    theCategory = commands[property].category;
                  }
                }
              }
              if (!objectHelper.testIfInput(theCategory)) { // If no category listed, give it the default
                theCategory = "General";
              }
              // isInArray, // Checks an array for a value.  Usage:  isInArray(inputArray,ValueToCompare)
              if (!commandCategories.hasOwnProperty(theCategory)) { // If the commandCategories doesn't have the array for the unique category yet, create it.
                commandCategories[theCategory] = [];
              }

              // Before adding the command name to the category, check to ensure the command is hidden or an admin only command.
              // console.log("Checking command, " + property + ", to see if should be added to help.  commands[property].displayInHelp: " + commands[property].displayInHelp);
              // if ((!commands[property].adminOnly || playerAdminCheck) && (commands[property].displayInHelp || (playerAdminCheck && showAll))){ // If the command is NOT adminonly OR the player is an admin, let it show up.  If the command is not set to displayInHelp, then do not show it.
              if ((!commands[property].adminOnly || playerAdminCheck) && (commands[property].displayInHelp || (!commands[property].adminOnly && showAll))) { // If the command is NOT adminonly OR the player is an admin, let it show up.  If the command is not set to displayInHelp, then do not show it.
                commandCategories[theCategory].push(commands[property].name);
                commandsAddedNum++;
              }
              theCategory = ""; // Reset the category
            }
          }

          // TODO:  Remove any empty categories. This can happen if a command is categorized but is hidden or unavailable to the player due to it being an admin only command.

          // commandCategories should now be an object that contains all the unique categories with arrays for each command in that category
          // console.dir(commandCategories); // temp

          var commandSpacerNum = defaultSettings["commandSpacer"].length + defaultSettings["commandPrefix"].length + defaultSettings["commandSuffix"].length;
          var theArrayToWorkOn = [];
          var tempArrayOfStrings = [];
          var tempArrayOfStringsCounter = 0;
          var theCommandTemp = "";
          for (var theCategoryFromArray in commandCategories) { // This cycles through all the unique command categories
            if (commandCategories.hasOwnProperty(theCategoryFromArray)) {
              // We need to rebuild the arrays to a max length
              theArrayToWorkOn = commandCategories[theCategoryFromArray];
              for (let i = 0;i < theArrayToWorkOn.length;i++) { // Cycle through the array of commands for the category
                theCommandTemp = theArrayToWorkOn[i];
                if (tempArrayOfStrings[tempArrayOfStringsCounter]) {
                  // it has been created, so see if adding the command would put it over the top, and if so, add to the next array
                  if (tempArrayOfStrings[tempArrayOfStringsCounter].length + commandSpacerNum + theArrayToWorkOn[i].length <= defaultSettings["defaultHelpWidth"]) {
                    tempArrayOfStrings[tempArrayOfStringsCounter] += defaultSettings["commandSpacer"] + defaultSettings["commandPrefix"] + theArrayToWorkOn[i] + defaultSettings["commandSuffix"]; // This adds to the array entry string
                  } else {
                    tempArrayOfStringsCounter++
                    tempArrayOfStrings.push(defaultSettings["commandPrefix"] + theCommandTemp + defaultSettings["commandSuffix"]); // This creates a new array entry
                  }
                } else {
                  // The split array hasn't been created yet, so just add the command to it
                  tempArrayOfStrings.push(defaultSettings["commandPrefix"] + theCommandTemp + defaultSettings["commandSuffix"]);
                }
              }
              // We should now have a new array of strings chopped to the desired length
              commandCategories[theCategoryFromArray] = tempArrayOfStrings;
              tempArrayOfStrings = [];
              tempArrayOfStringsCounter = 0;
            }
          }
          // The commandCategories object should now be rebuilt so each category has arrays of strings that can be provided to the player
          // console.dir(commandCategories); // temp

          // Assuming there are categories, we need to cycle through the categories again, only displaying them once per player and adding filler to lines that do not contain the category
          // If there are no categories, then the bot should just state there are no commands presently on the server.

          // defaultSettings["categoryPrefix"]
          // defaultSettings["categorySuffix"]


          if (commandsAddedNum > 0) {
            var theFinalArray = [];
            var categoriesListed = [];
            messageObj.sender.botMsg("I can perform the following commands:", {"fast": true}).catch((err) => console.error(err));
            for (var finalCategory in commandCategories) {
              if (commandCategories.hasOwnProperty(finalCategory)) {
                theFinalArray = commandCategories[finalCategory];
                for (let i = 0;i < theFinalArray.length;i++) {
                  if (!isInArray(categoriesListed, finalCategory)) {
                    messageObj.sender.msg(" ", {"fast": true});
                    messageObj.sender.msg(defaultSettings["categoryPrefix"] + finalCategory + defaultSettings["categorySuffix"], {"fast": true});
                    categoriesListed.push(finalCategory);
                  }
                  messageObj.sender.msg("  " + theFinalArray[i], {"fast": true});
                }
              }
            }
            messageObj.sender.msg(" ", {"fast": true});
            messageObj.sender.msg("To use a command, type: \"" + settings["commandOperator"] + "[command]\" (without the brackets)", {"fast": true});
            messageObj.sender.msg("For help on a command, type !help [command]", {"fast": true});
          } else {
            // No commands are set up or visible.
            messageObj.sender.botMsg("There do not appear to be any commands visible!", {"fast": true}).catch((err) => console.error(err));
          }
        }
        console.log("Help command finished.");
      } else {
        messageObj.sender.msg("ERROR:  " + theCommand + " is not a valid command!", {"fast": true});
        messageObj.sender.msg("To view a list of wrapper commands, type: !help", {"fast": true});
      }
    }
  }
};

function importSettingsFile() {
  if (isSeen(settingsFile)) {
    if (isFile(settingsFile)) {
      defaultSettings = require(settingsFile);
      console.log("Imported default settings for command.js:");
    } else {
      console.log("Settings file was not a file?  Skipping!");
    }
  } else {
    console.log("Settings file for commands.js not found, skipping!");
  }
}

function verifySettings() {
  // Verify that all the settings were specified from the .json file, using hardcoded defaults for any not specified.
  if (!defaultSettings.hasOwnProperty("defaultCategory")) {
    defaultSettings["defaultCategory"] = "General";
  }
  if (!defaultSettings.hasOwnProperty("defaultAdminOnly")) {
    defaultSettings["defaultAdminOnly"] = false;
  }
  if (!defaultSettings.hasOwnProperty("defaultDisplayInHelp")) {
    defaultSettings["defaultDisplayInHelp"] = true;
  }
  if (!defaultSettings.hasOwnProperty("defaultHelpWidth")) {
    defaultSettings["defaultHelpWidth"] = 80;
  }
  if (!defaultSettings.hasOwnProperty("commandPrefix")) {
    defaultSettings["commandPrefix"] = "";
  }
  if (!defaultSettings.hasOwnProperty("commandSpacer")) {
    defaultSettings["commandSpacer"] = "  /  ";
  }
  if (!defaultSettings.hasOwnProperty("commandSuffix")) {
    defaultSettings["commandSuffix"] = "";
  }
  if (!defaultSettings.hasOwnProperty("categoryPrefix")) {
    defaultSettings["categoryPrefix"] = "--- ";
  }
  if (!defaultSettings.hasOwnProperty("categorySuffix")) {
    defaultSettings["categorySuffix"] = " ---";
  }
}
async function command(player, command, args, messageObj) { // Normally we would not use the messageObj, but it's here if for some reason we want the command to operate differently depending on channel sent to
  if (command == "changehelpwidth") {
    var theNewNum = toNumIfPossible(args[0]);
    if (typeof theNewNum == "number") {
      if (theNewNum > 10) {
        global["commandSettings"]["defaultHelpWidth"] = theNewNum;
        player.botMsg("Changed help width to: " + theNewNum).catch((err) => console.error(err));
      } else {
        player.botMsg("ERROR:  Please specify a positive number that is larger than 10!").catch((err) => console.error(err));
      }
    } else {
      await player.botMsg("This command is used to change the width of the help to a certain number of max characters.").catch((err) => console.error(err));
      await player.botMsg("Example: " + commandOperator + "changehelpwidth 90").catch((err) => console.error(err));
    }
  } else if (command == "savehelpsettings") {
    player.botMsg("Saving the Help settings file..").catch((err) => console.error(err));
    try {
      writeSettings();
      await player.msg("Done!").catch((err) => console.error(err));
    } catch (err) {
      console.error(err.toString());
      player.botMsg("ERROR:  Unable to write to help file!  Try again!").catch((err) => console.error(err));
    }
  } else if (command == "reloadhelpsettings") {
    player.botMsg("Reloading the Help settings file.").catch((err) => console.error(err));
    reloadSettingsFile();
  } else if (command == "helpcategorysuffix") {
    if (args[0]) {
      let valToUse = args[0].replace('"', "").replace("'", "");
      player.botMsg("Set the Help Category Suffix to: " + valToUse).catch((err) => console.error(err));
      defaultSettings["categorySuffix"] = valToUse;
    } else {
      player.botMsg("Usage: " + commandOperator + "helpCategorySuffix aStringValue").catch((err) => console.error(err));
    }
  } else if (command == "helpcategoryprefix") {
    if (args[0]) {
      let valToUse = args[0].replace('"', "").replace("'", "");
      player.botMsg("Set the Help Category Prefix to: " + valToUse).catch((err) => console.error(err)).catch((err) => console.error(err));
      defaultSettings["categoryPrefix"] = valToUse;
    } else {
      player.botMsg("Usage: " + commandOperator + "helpCategoryPrefix aStringValue").catch((err) => console.error(err));
    }
  } else if (command == "helpcommandsuffix") {
    if (args[0]) {
      let valToUse = args[0].replace('"', "").replace("'", "");
      player.botMsg("Set the Help Command Suffix to: " + valToUse).catch((err) => console.error(err));
      defaultSettings["commandSuffix"] = valToUse;
    } else {
      player.botMsg("Usage: " + commandOperator + "helpCommandSpacer aStringValue").catch((err) => console.error(err));
    }
  } else if (command == "helpcommandspacer") {
    if (args[0]) {
      let valToUse = args[0].replace('"', "").replace("'", "");
      player.botMsg("Set the Help Command Spacer to: " + valToUse).catch((err) => console.error(err));
      defaultSettings["commandSpacer"] = valToUse;
    } else {
      player.botMsg("Usage: " + commandOperator + "helpCommandSpacer aStringValue").catch((err) => console.error(err));
    }
  } else if (command == "helpcommandprefix") {
    if (args[0]) {
      let valToUse = args[0].replace('"', "").replace("'", "");
      player.botMsg("Set the Help Command Prefix to: " + valToUse).catch((err) => console.error(err));
      defaultSettings["commandPrefix"] = valToUse;
    } else {
      player.botMsg("Usage: " + commandOperator + "helpCommandPrefix aStringValue").catch((err) => console.error(err));
    }


  } else if (command == "togglehide") {
    if (testIfInput(args[0])) {
      var lowerCaseArg = args[0].toLowerCase();
      if (commands.hasOwnProperty(lowerCaseArg)) {
        var tempObj = commands[lowerCaseArg];
        if (tempObj.displayInHelp) {
          player.botMsg("Hiding the \"" + args[0] + "\" command!").catch((err) => console.error(err));
          tempObj["displayInHelp"] = false;
        } else {
          player.botMsg("Unhiding the \"" + args[0] + "\" command!").catch((err) => console.error(err));
          tempObj["displayInHelp"] = true;
        }
        global.regCommand(tempObj); // the regCommand function can accept an object input.
      } else {
        player.botMsg("ERROR:  Could not hide the \"" + args[0] + "\" command!  It does not exist!").catch((err) => console.error(err));
      }
    } else {
      player.botMsg("ERROR:  Please give a valid command to toggle hide for.").catch((err) => console.error(err));
      player.msg("Example: " + commandOperator + "togglehide SomeCommand");
    }
  }
};


// function regCommand(myCommandObj){ // This is used by mods to register a command object, which is later used by !help and to trigger command events.
function regCommand(name, category, adminOnly, displayInHelp, playersArray) {
  // This is used by mods to register a command object, which is later used by !help and to trigger command events.
  // This can accept an object as the first argument, 'name' with some of the values registered.  It will fill in the blanks with defaults as necessary.
  // Note:  This can be used to reregister a command, if the permissions might change later.
  // {
  //   "name":"home",
  //   "category":"General",
  //   "adminOnly":true/fase, // optional
  //   "displayInHelp": true/false // optional
  // }
  // TODO: allow "adminOnly":true/false
  // TODO: allow "playersAuthorized":["Array","of","playernames"]

  // This is to ensure it has all the properties it needs -- This can accept an object as input and will fill out anything that is missing.
  var myCommandObj = new CommandObj(name, category, adminOnly, displayInHelp, playersArray);
  var failure = true;
  if (myCommandObj.hasOwnProperty("name")) {
    if (testIfInput(myCommandObj.name)) {
      var myCommandName = myCommandObj.name.toLowerCase();
      if (typeof serverObj.commands != "object") {
        serverObj.commands = {};
      }
      serverObj.commands[myCommandName] = myCommandObj;
      commands=serverObj.commands; // Set the commands variable if not already set.

      console.log("Registered new command: " + myCommandName);
      // console.dir(myCommandObj);
      failure = false;
    }
  }
  if (failure) {
    console.error("ERROR:  Could not register new command!  No name given!");
  }
}

function CommandObj(name, category, adminOnly, displayInHelp, playersArray) { // Expects string values or an object as the first argument.
  // If given an object, it will add to it as necessary.
  if (typeof name == "object") {
    if (name.hasOwnProperty("name")) { // This should only be set IF a name was provided.  We cannot set a "default" command name.
      this.name = name.name;
    }
    this.category = getOption(name, "category", defaultSettings.defaultCategory);
    this.adminOnly = getOption(name, "adminOnly", defaultSettings.defaultAdminOnly);
    this.displayInHelp = getOption(name, "displayInHelp", defaultSettings.defaultDisplayInHelp);
    var arrayToTest = getOption(name, "playersArray");
    if (isArray(arrayToTest)) {
      if (arrayToTest.length > 0) {
        this.playersArray = arrayToTest;
      }
    }
  } else {
    var theName = name.toString();
    if (typeof theName == "string") { // If the name is not given, we cannot guess at it or set a default.
      this.name = theName;
    }
    if (category) {
      this.category = category;
    } else {
      this.category = defaultSettings.defaultCategory;
    }
    if (testIfInput(adminOnly)) {
      this.adminOnly = adminOnly;
    } else {
      this.adminOnly = defaultSettings.defaultAdminOnly;
    }
    if (testIfInput(displayInHelp)) {
      this.displayInHelp = displayInHelp;
    } else {
      this.displayInHelp = defaultSettings.defaultDisplayInHelp;
    }
    if (isArray(playersArray)) {
      if (playersArray.length > 0) {
        this.playersArray = playersArray;
      }
    }
  }
};

function reloadSettingsFile() {
  // delete require.cache[require.resolve(settingsFile)]; // taken from here: http://derpturkey.com/reload-module-with-node-js-require/
  Reflect.deleteProperty(require.cache, require.resolve(settingsFile)); // This is to make ESLint happy.

  importSettingsFile();
  verifySettings();
  return true;
}

function writeSettings() {
  var settingsFileName = path.basename(settingsFile);
  try {
    var settingsFileStream = fs.createWriteStream(settingsFile);
    settingsFileStream.write(JSON.stringify(defaultSettings, null, 4));
    settingsFileStream.end();
    console.log("Updated '" + settingsFileName + "' file.");
    log("Updated '" + settingsFileName + "' file.");
  } catch (err) {
    console.error("ERROR: Could not write to the '" + settingsFileName + "' file!");
    log("ERROR: Could not write to the '" + settingsFileName + "' file!");
    throw err;
  }
}
