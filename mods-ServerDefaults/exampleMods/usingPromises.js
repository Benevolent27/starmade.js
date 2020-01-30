// In addition to this tutorial, I highly recommend reading this article to 
// understand how to do error handling with promises:  https://javascript.info/promise-error-handling

// If interested in logging your errors, check this out:  https://rangle.io/blog/errors-in-promises/

// The purpose of this tutorial is to:
// 1. demonstrate different ways of performing actions, either sequentially (in order) or 
// non-sequentially (as fast as possible).  
//
// 2. Handle errors from StarNet.jar.
// Sometimes a server may be under heavy load, or maybe it crashes, or maybe it just has gone offline
// and the wrapper is still running.  All of these situations will cause an error when a mod attempts
// to run a function that grabs information from the server, perhaps about a player/entity/etc.
// It's very important to handle these errors, otherwise the server may crash or unexpected behavior
// might occur with your mod.  
// Imagine trying to grab a player's faction, but the command fails. The rest of your mod scripting
// might rely on this information, so things get out of whack!  Eep!
//
// 3. Handle responses from successful queries.  
// These responses are typically true or false. For example, the result of a "PlayerObj.msgPromise" 
// command will be true or false. If true, then the player received the message.  If false, then
// the server message command failed for some reason.  This is normally because the player is offline.


// First, let's just talk about general structure.  When we have commands, we need to
// register them.  There is an "init" event for this.
var installObj = global.getInstallObj(__dirname); // Get the install object
var {event} = installObj;
event.on('start', function (theServerObj) {
  // This is super ugly for events.. TODO: Build separate events for servers in the config.
  event.on("command", command); // Only registered commands will trigger a "command" event.
  event.on("command", asyncCommand);
  event.on("commandStart", function (regCommand) { // We cannot register our commands till the commands mod has finished loading.  It emits "commandStart" when it is ready.
    regCommand("reg1", "Promises Tutorial", false, true); // This is function provided by one of the default mods, the "Commands" mod.  This provides the !help command and manages how commands function.
    // The above registers a command, "reg1".  The player can type !reg1 in-game to run it.
    // The category is set to "Promises Tutorial".
    // It is NOT admin-only (false), so any player can run it.
    // It SHOULD appear in the "!help" command's list of commands. (true)

    // Ok, so let's register the rest of our commands for the tutorial..
    regCommand("reg2", "Promises Tutorial", false, true);
    regCommand("reg3", "Promises Tutorial", false, true);
    // You know.. We don't actually need to set the last two values..
    // If not specified, the default behavior is to NOT be admin-only and to appear in the !help list. 
    regCommand("reg4", "Promises Tutorial"); // Ah, that's nice.
    regCommand("async1", "Promises Tutorial");
    regCommand("async2", "Promises Tutorial");
    regCommand("async3", "Promises Tutorial");
    regCommand("async4", "Promises Tutorial");
    regCommand("async5", "Promises Tutorial");
    regCommand("async6", "Promises Tutorial");
    regCommand("async7", "Promises Tutorial");
  });
});

// You should start up your server and connect to it.  In-game, type "!help".
// You'll see the "Promises Tutorial" section, with these commands listed under it.


// We need to listen for the 'command' event to now do something when a player types the command.
function command(player, command, args, messageObj) { // command events are given a PlayerObj, the command in lowercase (as a string), any words after the command as an array, and the original MessageObj if we need to look at it (such as to see what kind of channel the command was said in)
  // As we go through each command, I'd recommend you type them in-game to see what happens.

  // Ok, so for this tutorial, I'll use the "PlayerObj.botMsg" function to illustrate 
  // the various ways of running the command and handling any errors.
  if (command == "reg1") {
    // This first example will always run as quickly as possible, and will PROBABLY 
    // happen out of order!  We normally wouldn't want this for messages, but it can be useful
    // if we are doing a lot of things at once and don't mind the order they happen in.

    // Try running this a few times in-game and you'll probably see what I mean.
    player.botMsg("Welcome to the server you bodacious turtle!").catch(function (err) {
      console.error(err)
    });
    player.botMsg("Welcome to the server you bodacious turtle2!").catch((err) => console.error(err)); // This is a shorter function declaration.  It's the same as above.
    player.botMsg("Welcome to the server you bodacious turtle3!").catch((err) => console.error(err));
    player.botMsg("Welcome to the server you bodacious turtle4!").catch((err) => console.error(err));
    player.botMsg("Welcome to the server you bodacious turtle5!").catch((err) => console.error(err));
    player.botMsg("Welcome to the server you bodacious turtle6!").catch((err) => console.error(err));

    // For each one of the above commands, we handle any error.  This opens 6 connections to the
    // server very rapidly.  Each one might complete at different times, so we can't control
    // the order they happen in.

    // Note that for now, we are only handling connection errors, We are NOT checking the result
    // of each command to see whether the command succeeded or not.  
    // For example, if a player goes offline, the botMsg will not throw an error, since
    // the connection to the server succeeded, but the result it provides will be 'false',
    // to indicate that it did not succeed in messaging the player.

  } else if (command == "reg2") {
    // We can string Promise commands together using ".then".
    // This causes each command to run sequentially.  We can then attach 1 catch to the end
    // of the sequence to handle errors for any of the messages.
    player.botMsg("Welcome to the server you languishing lizard!").then(() =>
      player.botMsg("Welcome to the server you languishing lizard2!").then(() => // This line does not happen till the first line completes
        player.botMsg("Welcome to the server you languishing lizard3!").then(() => // Same for this line
          player.botMsg("Welcome to the server you languishing lizard4!").then(() => // etc.
            player.botMsg("Welcome to the server you languishing lizard5!").then(() =>
              player.botMsg("Welcome to the server you languishing lizard6!")
            ))))).catch(function (err) { // This handles errors for any of the above messages
      console.error(err)
    });
  } else if (command == "reg3") {
    // Let's simulate an error!  
    // The wrapper comes the ability to simulate errors.  You can test your mod to ensure
    // it works correctly even when connection problems happen. (such as when the server is under 
    // heavy load)
    // In this next sequence, we're going to simulate being unable to connect to the server
    // with an immediate connection rejection (attempting to connect to the wrong port).

    // As above, this will run sequentially, stopping where the connection problem occurs.  
    // It will then skips to the closest ".catch", which is at the end.
    player.botMsg("Welcome to the server you salacious salamander!").then(() =>
      player.botMsg("Welcome to the server you salacious salamander2!").then(() =>
        player.botMsg("Welcome to the server you salacious salamander3!", { // We simulate an immediate connection problem here which will return an error.
          "simulateProblem": "wrongport",
          "maxTimeToRetry": 5000
        }).then(() =>
          player.botMsg("Welcome to the server you salacious salamander4!").then(() => // This never happens.
            player.botMsg("Welcome to the server you salacious salamander5!").then(() => // This never happens.
              player.botMsg("Welcome to the server you salacious salamander6!") // This never happens.
            ))))).catch((err) => console.error(err)); // This handles the error and just prints it to the console.  I'm using javascript shorthand to declare the function to make it more compact.
  } else if (command == "reg4") {
    // These will run sequentially, but we handle errors for each individual message.
    // This allows the sequence to continue on past the error, since each error is resolved as it happens.
    player.botMsg("Welcome to the server you busy bee!").catch((err) => console.error(err)).then(() =>
      player.botMsg("Welcome to the server you busy bee2!").catch((err) => console.error(err)).then(() =>
        player.botMsg("Welcome to the server you busy bee3!", { // <-- Error is simulating here.
          "simulateProblem": "wrongport",
          "maxTimeToRetry": 5000
        }).catch((err) => console.error(err)).then(() =>
          player.botMsg("Welcome to the server you busy bee4!").catch((err) => console.error(err)).then(() => // Since the above error is resolved, things continue to this line.
            player.botMsg("Welcome to the server you busy bee5!").catch((err) => console.error(err)).then(() => // This also happens.
              player.botMsg("Welcome to the server you busy bee6!").catch((err) => console.error(err)) // And this happens too!
            )))));
  }
};
// Async functions give us the ability to use "await".  This can simplify our code quite a bit.
// There really isn't any reason that I can see NOT to use an async function for events.  I recommend,
// you always use async functions for your event handling because it really simplifies things quite a bit.
async function asyncCommand(player, command, args, messageObj) {
  if (command == "async1") {
    // await causes the scripting to wait until the command finishes, without blocking the main thread.
    // When finished, it returns the result OR throws a Promise error. 

    // This will always run in order continuing from one to the next.
    // Since we are handling errors for each command, when the StarNet.jar error
    // happens, things continue on.
    await player.botMsg("Welcome to the server you gnarly toad!").catch((err) => console.error(err));
    await player.botMsg("Welcome to the server you gnarly toad2!").catch((err) => console.error(err));
    await player.botMsg("Welcome to the server you gnarly toad3!", {
      "simulateProblem": "wrongport",
      "maxTimeToRetry": 5000
    }).catch((err) => console.error(err));
    await player.botMsg("Welcome to the server you gnarly toad4!").catch((err) => console.error(err));
    await player.botMsg("Welcome to the server you gnarly toad5!").catch((err) => console.error(err));
    await player.botMsg("Welcome to the server you gnarly toad6!").catch((err) => console.error(err));
  } else if (command == "async2") {
    // We cannot string these together with a .catch to the end of the sequence, because when
    // await resolves the command, a promise is not returned.  Just the result is.
    // However we can wrap them all in a try/catch, provided we use await on each one.
    try {
      await player.botMsg("Welcome to the server you cuddly koala!");
      await player.botMsg("Welcome to the server you cuddly koala2!");
      await player.botMsg("Welcome to the server you cuddly koala3!", {
        "simulateProblem": "wrongport",
        "maxTimeToRetry": 5000
      });
      // Promise error thrown above
      await player.botMsg("Welcome to the server you cuddly koala4!"); // This does not happen.
      await player.botMsg("Welcome to the server you cuddly koala5!"); // This does not happen.
      await player.botMsg("Welcome to the server you cuddly koala6!"); // This does not happen.
    } catch (err) { // This catches any errors thrown -- including coding errors!  Be careful with this.
      console.error(err)
    };

  } else if (command == "async3") {
    // So what happens if we don't use await?
    // Without using await, what is returned is a Promise object instead the result.
    // Since a Promise Object is not an error, the code inside of the "try" will finish the 
    // try/catch without any errors.
    // Then Later on when the promise finishes, the promise error is thrown outside of 
    // the try/catch and it will be unresolved.  See more about this below.
    try {
      player.botMsg("Welcome to the server you spontaneous sponge!");
      player.botMsg("Welcome to the server you spontaneous sponge2!");
      player.botMsg("Welcome to the server you spontaneous sponge3!", {
        "simulateProblem": "wrongport",
        "maxTimeToRetry": 10000
      }); // This will cause an error, but the promise error will not be caught by the try wrap.
      player.botMsg("Welcome to the server you spontaneous sponge4!"); // This and below still happens.
      player.botMsg("Welcome to the server you spontaneous sponge5!");
      player.botMsg("Welcome to the server you spontaneous sponge6!");
    } catch (err) { // This will NOT handle errors thrown by any of the messages.
      console.error(err)
    };
    // IMPORTANT:
    // Unlike regular errors being thrown, node.js does not crash the main process when 
    // Promise errors are not handled.  This will change in a future version of node.js though.
    // They will, however, leave leave a big, ugly error in our console with NO specifics 
    // about where the problem occurred in the mod's code.  This will make debugging a nightmare!:
    //
    // (node:6236) UnhandledPromiseRejectionWarning: Error: Error when sending starNet.jar command: /server_message_to plain Benevolent27'[Melvin]: Welcome to the server you spontaneous sponge3!'
    //     at c:\coding\starmade.js\bin\starNet.js:642:24
    //     at processData (c:\coding\starmade.js\bin\starNet.js:180:3)
    //     at ChildProcess.<anonymous> (c:\coding\starmade.js\bin\starNet.js:156:46)
    //     at ChildProcess.emit (events.js:198:13)
    //     at Process.ChildProcess._handle.onexit (internal/child_process.js:248:12)
    // (node:6236) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). (rejection id: 1)
    // (node:6236) [DEP0018] DeprecationWarning: Unhandled promise rejections are deprecated. In the future, promise rejections that are not handled will terminate the Node.js process with a non-zero exit code.

  } else if (command == "async4") {
    // If we want these to run out of order, we can simply handle the errors for each 
    // individual command, like we did in the 'async1' example.
    player.botMsg("Welcome to the server you gnarly toad!").catch((err) => console.error(err));
    player.botMsg("Welcome to the server you gnarly toad2!").catch((err) => console.error(err));
    player.botMsg("Welcome to the server you gnarly toad3!", {
      "simulateProblem": "wrongport",
      "maxTimeToRetry": 5000
    }).catch((err) => console.error(err));
    player.botMsg("Welcome to the server you gnarly toad4!").catch((err) => console.error(err));
    player.botMsg("Welcome to the server you gnarly toad5!").catch((err) => console.error(err));
    player.botMsg("Welcome to the server you gnarly toad6!").catch((err) => console.error(err));

  } else if (command == "async5") {
    // If we want to actually handle the results, we can do it one by one if we want..  
    // But..This is messy and probably unnecessary for messages.  Blech!
    player.botMsg("Welcome to the server you spontaneous sponge!").then(function (result) {
      if (result) {
        console.log("Message succeeded!");
      } else {
        console.log("Message failed! Is the player offline?");
      }
    }, function (err) {
      console.error("Error sending message: " + err);
    });
    player.botMsg("Welcome to the server you spontaneous sponge2!").then(function (result) {
      if (result) {
        console.log("Message succeeded!");
      } else {
        console.log("Message failed! Is the player offline?");
      }
    }, function (err) {
      console.error("Error sending message: " + err);
    });
    player.botMsg("Welcome to the server you spontaneous sponge3!").then(function (result) {
      if (result) {
        console.log("Message succeeded!");
      } else {
        console.log("Message failed! Is the player offline?");
      }
    }, function (err) {
      console.error("Error sending message: " + err);
    });
    player.botMsg("Welcome to the server you spontaneous sponge4!").then(function (result) {
      if (result) {
        console.log("Message succeeded!");
      } else {
        console.log("Message failed! Is the player offline?");
      }
    }, function (err) {
      console.error("Error sending message: " + err);
    });
  } else if (command == "async6") {
    // We can use a function to handle the errors in a standardized way.  This keeps things nice and simple.
    // Hint:  If you are using VSCode, try holding the CTRL key on your keyboard and click on "handleMsgPromise"
    handleMsgPromise(player.botMsg("Welcome to the server you spontaneous sponge!"));
    handleMsgPromise(player.botMsg("Welcome to the server you spontaneous sponge2!"));
    handleMsgPromise(player.botMsg("Welcome to the server you spontaneous sponge3!", {
      "simulateProblem": "wrongport",
      "maxTimeToRetry": 10000
    }));
    handleMsgPromise(player.botMsg("Welcome to the server you spontaneous sponge4!"));
    handleMsgPromise(player.botMsg("Welcome to the server you spontaneous sponge5!"));
    handleMsgPromise(player.botMsg("Welcome to the server you spontaneous sponge6!"));
    // That's a lot cleaner isn't it?
  } else if (command == "async7") {
    // Usually a LOT of messages are sent to players, so we probably don't want to clog up our console
    // with a ton of success/fail messages.  Also, unless it's a connection error, normally a message 
    // command only fails if the player goes offline.  In my experience, it's ok to just ignore the 
    // failures of the command.  I'd recommend just processing the errors.
    handleOnlyErrors(player.botMsg("Welcome to the server you spontaneous sponge!"));
    handleOnlyErrors(player.botMsg("Welcome to the server you spontaneous sponge2!"));
    handleOnlyErrors(player.botMsg("Welcome to the server you spontaneous sponge3!", {
      "simulateProblem": "wrongport",
      "maxTimeToRetry": 10000
    }));
    handleOnlyErrors(player.botMsg("Welcome to the server you spontaneous sponge4!"));
    handleOnlyErrors(player.botMsg("Welcome to the server you spontaneous sponge5!"));
    handleOnlyErrors(player.botMsg("Welcome to the server you spontaneous sponge6!"));
  }
}

function handleMsgPromise(inputPromise) { 
  // We just use the same code we would have on each individual promise here and return the result of it.
  return inputPromise.then((result) => {
    if (result) {
      console.log("The message succeeded!");
    } else {
      console.log("The message failed.  The player is probably offline.");
    }
  }).catch((err) => {
    console.error("There was a StarNet.jar error: ");
    console.dir(err);
  });
}

function handleOnlyErrors(inputPromise) {
  return inputPromise.catch((err) => {
    console.error("There was a StarNet.jar error: ");
    console.dir(err);
  });
}

// *=-~The More You Know~-=*
// You might be wondering why I don't resolve the promises by always grabbing the return values/errors.
// Will this keep the promise in memory, preventing the event handler function from terminating?
// Will all the other variables from this event handler ALSO stay in active memory?
// The answer is, NOPE.  Promises are just objects.  If there is no reference made to the object, 
// it will clear out of memory when the event handler ends, even IF it's still pending.
// source: https://stackoverflow.com/questions/36734900/what-happens-if-we-dont-resolve-or-reject-the-promise
