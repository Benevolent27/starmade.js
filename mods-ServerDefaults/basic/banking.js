// ##################
// ### Banking Mod ##
// ##################
//
// This mod is designed to introduce basic banking to servers, so players can bank their credits.
// This mod adds the following in-game commands:
// !deposit 
// !withdraw
// !transfer
// !bankTransfer
const path=require('path');
const objectHelper=global.objectHelper;
var {toNumIfPossible}=objectHelper;
const miscHelpers=global.miscHelpers;
var {writeJSONFileSync,getJSONFile,getJSONFileSync,existsAndIsFile,i,toNumberWithCommas}=miscHelpers;

const installObj=global.getInstallObj(__dirname); // Get the install object
const installPath=installObj.path;
const bankingFilePath=path.join(installPath,"banking.json");
const maxCreditsAstronautCanHold=2147483647; // This is a java limitation in StarMade
const {event,log}=installObj;
const thisConsole=installObj.console;
var serverObj={};
var bankingFileObj={};
var commandOperator="!";
global.exitHook(() => { // This will handle sigint and sigterm exits, errors, and everything (except SIGKILL, of course).
  writeBankingFile();
});

event.on("serverExit",function(){ // This isn't really necessary, because each transaction forces a write, but let's just do it for now in case a transaction is interrupted by an error or something.
  writeBankingFile();
});

if (existsAndIsFile(bankingFilePath)){
  bankingFileObj=getJSONFileSync(bankingFilePath)
} else {
  writeBankingFile(); // Create the file if it does not exist
}

event.on("serverStart",function(theServerObj){
  serverObj=theServerObj;
  commandOperator=serverObj.settings.commandOperator;
});

event.on("commandStart",function(regCommand){
  thisConsole.log("Registering commands for banking.js..");
  regCommand("deposit", "Banking", false, true,{},deposit);
  regCommand("withdraw", "Banking", false, true,{},withdraw);
  regCommand("balance", "Banking", false, true,{},balance);
  regCommand("transfer", "Banking", false, true,{},transfer);
  regCommand("banktransfer", "Banking", false, true,{},bankTransfer);
});


async function bankTransfer(player, command, args, messageObj){
  // Usage: !banktransfer [CreditAmount] [PlayerToTransferTo]
  thisConsole.log("bankTransfer command ran!");
  if (args.length == 2){
    var creditAmountToTransfer=args[0];
    var playerNameToTransferTo=args[1];
    if (i(playerNameToTransferTo,player.name)){
      return player.botMsg(`ERROR:  You cannot transfer credits to yourself!`,{fast:true}).catch((err) => console.error(err));  
    }
    // TODO:  Replace below with an offline resolve.  This is an incomplete solution to correct case that only works if the player is online.
    var playerObjToTransferTo=await serverObj.resolveOnlinePlayerName(playerNameToTransferTo).catch((err) => console.error(err));
    if (typeof playerObjToTransferTo == "object" && playerObjToTransferTo !== null){
      if (playerObjToTransferTo.hasOwnProperty("name")){
        if (i(playerObjToTransferTo.name,playerNameToTransferTo)){
          playerNameToTransferTo=playerObjToTransferTo.name;
        }
      }
    }
    if (!bankingFileObj.hasOwnProperty(player.name)){ // If the player has no bank account, set it to 0.
      bankingFileObj[player.name]=0;  
    }
    if (!bankingFileObj.hasOwnProperty(playerNameToTransferTo)){ // If the player has no bank account, set it to 0.
      bankingFileObj[playerNameToTransferTo]=0;  
    }
    if (creditAmountToTransfer == "all"){
      creditAmountToTransfer=bankingFileObj[player.name];
    }
    creditAmountToTransfer=convertNumShortcuts(creditAmountToTransfer); // Resolve any shortcuts and convert to number
    if (creditAmountToTransfer > 0){
      if (bankingFileObj[player.name] >= creditAmountToTransfer){
        bankingFileObj[player.name]-=creditAmountToTransfer;
        bankingFileObj[playerNameToTransferTo]+=creditAmountToTransfer;
        writeBankingFile();
        log(`BANKING:  BANK TRANSFER of ${toNumberWithCommas(creditAmountToTransfer)} credits from player, ${player.name}, to player, ${playerNameToTransferTo}, successful!`);
        if (playerObjToTransferTo){ // Player was online.
          playerObjToTransferTo.botMsg(`${player.name} sent ${toNumberWithCommas(creditAmountToTransfer)} credits to you via bank transfer!  Your new bank credit balance is:  ${toNumberWithCommas(bankingFileObj[playerNameToTransferTo])}`,{fast:true}).catch((err) => console.error(err));
        }
        return player.botMsg(`Bank transfer of ${toNumberWithCommas(creditAmountToTransfer)} credits to player ${playerNameToTransferTo} succeeded!  Your new bank account credit balance is: ${toNumberWithCommas(bankingFileObj[player.name])}`,{fast:true}).catch((err) => console.error(err));
      } else {
        return player.botMsg(`ERROR:  You cannot transfer more credits than you have!  Your bank account balance is currently: ${toNumberWithCommas(bankingFileObj[player.name])}`,{fast:true}).catch((err) => console.error(err));    
      }
    } else if (creditAmountToTransfer == 0){
      return player.botMsg(`ERROR:  Is it really possible to transfer 0 credits?`,{fast:true}).catch((err) => console.error(err));  
    } else {
      return player.botMsg(`ERROR:  You can only transfer a POSITIVE number of credits!`,{fast:true}).catch((err) => console.error(err));  
    }
  } else if (args.length > 2){
    player.botMsg("ERROR:  Too many parameters!",{fast:true}).catch((err) => console.error(err));
    return bankTransferHelp(player,{fast:true});
  } else if (i(args[0],"help") || args.length==0) {
    return bankTransferHelp(player,{fast:true});    
  } else { // If one parameter given and it wasn't help
    player.botMsg("ERROR:  Invalid number of parameters!",{fast:true}).catch((err) => console.error(err));
    return bankTransferHelp(player,{fast:true});
  }
}
function bankTransferHelp(player,options){
  player.botMsg("This command is used to transfer credits from your bank account to the bank account of another online or offline player.",options).catch((err) => console.error(err));
  player.msg(`Usage: ${commandOperator}banktransfer [Number of Credits] [Player]`,options).catch((err) => console.error(err));
  player.msg(`Note: 'all' can be used to transfer all credits in your bank account.  "k","m","b" can be used for shorthand.`,options).catch((err) => console.error(err));
  player.msg(`Example 1: ${commandOperator}banktransfer all Benevolent27`,options).catch((err) => console.error(err));
  player.msg(`Example 2: ${commandOperator}banktransfer 50000 Benevolent27`,options).catch((err) => console.error(err));
  player.msg(`Example 3: ${commandOperator}banktransfer 50k Benevolent27`,options).catch((err) => console.error(err));
  player.msg(" ",options).catch((err) => console.error(err));
  player.msg(`Note: If you would like to transfer credits from your inventory, please use the ${commandOperator}transfer command.`,options).catch((err) => console.error(err));
}


async function transfer(player, command, args, messageObj){
  // Usage: !transfer [CreditAmount] [PlayerToTransferTo]
  thisConsole.log("transfer command ran!");
  if (args.length == 2){
    var creditAmountToTransfer=args[0];
    var playerNameToTransferTo=args[1];
        
    if (i(playerNameToTransferTo,player.name)){
      return player.botMsg(`ERROR:  You cannot transfer credits to yourself!`,{fast:true}).catch((err) => console.error(err));  
    }
    // Check if player is online and get their playerObj (input is case insensitive)
    var playerObjToTransferTo=await serverObj.resolveOnlinePlayerName(playerNameToTransferTo).catch((err) => console.error(err));
    if (!playerObjToTransferTo){
      await player.botMsg(`ERROR: ${playerNameToTransferTo} is either not online or their name has been mispelled!  The player must be online to receive an inventory credit transfer.  If transferring credits to an offline player, please use the ${commandOperator}banktransfer command.`,{fast:true}).catch((err) => console.error(err));  
      return player.botMsg(`If you are sure the player is online, please check the spelling of their name and try again.`,{fast:true}).catch((err) => console.error(err));  
    }
    playerNameToTransferTo=playerObjToTransferTo.name; // This corrects any case missmatch
    var playerObjToTransferToCredits=await playerObjToTransferTo.credits().catch((err) => console.error(err)); // This is needed because players can only have up to a certain number of credits.
    var playerCredits=await player.credits().catch((err) => console.error(err));
    if (typeof playerCredits == "number" && typeof playerObjToTransferToCredits == "number"){ // Ensure the credits commands were successful
      if (creditAmountToTransfer == "all"){
        creditAmountToTransfer=playerCredits;
      }
      creditAmountToTransfer=convertNumShortcuts(creditAmountToTransfer); // Resolve any shortcuts and convert to number
      if (creditAmountToTransfer <= 0){  // Cannot transfer 0 or less credits
        return player.botMsg(`ERROR:  You can only transfer a POSITIVE number of credits!`,{fast:true}).catch((err) => console.error(err));  
      }
      if (playerCredits < creditAmountToTransfer){
        return player.botMsg(`ERROR:  You do not have ${toNumberWithCommas(creditAmountToTransfer)} credits or more in your inventory! You currently have ${toNumberWithCommas(playerCredits)} credits.`,{fast:true}).catch((err) => console.error(err));  
      }
      let playerObjToTransferToNewCredits=playerObjToTransferToCredits+creditAmountToTransfer;
      if (playerObjToTransferToNewCredits > maxCreditsAstronautCanHold){ // Astronauts can only carry so many credits.  This is a java limitation.
        return player.botMsg(`ERROR:  Could not add credits to their inventory!  The max credits an astronaut can carry in StarMade is ${toNumberWithCommas(maxCreditsAstronautCanHold)} credits!  This would exceed that amount!`,{fast:true}).catch((err) => console.error(err));  
      }
      let creditAmountToTransferNegative=creditAmountToTransfer * -1;
      let removeResult=await player.giveCredits(creditAmountToTransferNegative).catch((err) => console.error(err));
      if (removeResult){
        let addResult=await playerObjToTransferTo.giveCredits(creditAmountToTransfer).catch((err) => console.error(err));
        if (addResult){
          player.botMsg(`Successfully transferred ${toNumberWithCommas(creditAmountToTransfer)} credits to ${playerNameToTransferTo}!`,{fast:true}).catch((err) => console.error(err));
          return playerObjToTransferTo.botMsg(`${player.name} has transferred ${toNumberWithCommas(creditAmountToTransfer)} credits to your inventory!  Congrats!  You now have ${toNumberWithCommas(playerObjToTransferToNewCredits)} credits.`,{fast:true}).catch((err) => console.error(err));
        } else {
          // Here we need to attempt to re-add the credits to the player's inventory and give a stronger admin message if this also fails.
          let reAddResult=await player.giveCredits(creditAmountToTransfer).catch((err) => console.error(err));
          if (reAddResult){
            log(`BANKING: Failed to add credit count for '${player.name}' during transfer to player '${playerNameToTransferTo}'.  REFUND Successful!  Credits attempted: ${toNumberWithCommas(creditAmountToTransfer)}`);
            return player.botMsg(`ERROR:  Could not add credits to the inventory for player, ${playerNameToTransferTo}!  Please try again!`,{fast:true}).catch((err) => console.error(err));  
          } else {
            log(`BANKING: FAILED to add credit count for '${player.name}' during transfer to player '${playerNameToTransferTo}'.  REFUND FAILED!!!  Credit loss has occurred!  Credits attempted: ${toNumberWithCommas(creditAmountToTransfer)}`);
            return player.botMsg(`ERROR:  Could not add credits to the inventory for player, ${playerNameToTransferTo}!  REFUND FAILED! You have lost credits!  Please speak to an admin!!  Please try again!`,{fast:true}).catch((err) => console.error(err));  
          }
        }
      } else {
        log(`BANKING: Failed to remove credit count for '${player.name}' during transfer to player '${playerNameToTransferTo}'.  Credits attempted: ${creditAmountToTransfer}`);
        return player.botMsg(`ERROR:  Could not remove credits from your inventory!  Please try again!`,{fast:true}).catch((err) => console.error(err));  
      }
    } else {
      return player.botMsg(`Error retreiving inventory credit values!  Please try again!`,{fast:true}).catch((err) => console.error(err));
    }
  } else if (args.length > 2){
    player.botMsg("ERROR:  Too many parameters!",{fast:true}).catch((err) => console.error(err));
    return transferHelp(player,{fast:true});
  } else if (i(args[0],"help") || args.length==0) {
    return transferHelp(player,{fast:true});    
  } else { // If one parameter given and it wasn't help
    player.botMsg("ERROR:  Invalid number of parameters!",{fast:true}).catch((err) => console.error(err));
    return transferHelp(player,{fast:true});
  }
}
function transferHelp(player,options){
  player.botMsg("This command is used to transfer credits from your inventory to the inventory of another online player.",options).catch((err) => console.error(err));
  player.msg(`Usage: ${commandOperator}transfer [Number of Credits] [Player]`,options).catch((err) => console.error(err));
  player.msg(`Note: 'all' can be used to transfer all credits in your inventory.  "k","m","b" can be used for shorthand.`,options).catch((err) => console.error(err));
  player.msg(`Example 1: ${commandOperator}transfer all Benevolent27`,options).catch((err) => console.error(err));
  player.msg(`Example 2: ${commandOperator}transfer 50000 Benevolent27`,options).catch((err) => console.error(err));
  player.msg(`Example 3: ${commandOperator}transfer 50k Benevolent27`,options).catch((err) => console.error(err));
  player.msg(" ",options).catch((err) => console.error(err));
  player.msg(`Note: If you would like to transfer credits from your bank account, please use the ${commandOperator}banktransfer command.`,options).catch((err) => console.error(err));
}


async function balance(player, command, args, messageObj){
  if (!bankingFileObj.hasOwnProperty(player.name)){ // If the player has no bank account, set it to 0.
    bankingFileObj[player.name]=0;  
  }
  var playerCredits=await player.credits().catch((err) => console.error(err));
  if (typeof playerCredits == "number"){
    return player.botMsg(`Your bank account currently contains ${toNumberWithCommas(bankingFileObj[player.name])} credits and your player inventory has ${toNumberWithCommas(playerCredits)} credits.`,{fast:true}).catch((err) => console.error(err));
  }
  return player.botMsg(`Error retreiving your inventory credit amount!  Please try again!`,{fast:true}).catch((err) => console.error(err));
}

function convertNumShortcuts(inputNumber){ // this is for k,m, and b. Only ensures output is a number if no multiplier specified.
  var outputNumber=toNumIfPossible(inputNumber); // Removes commas
  if (typeof outputNumber != "number"){
    var multiplier=1;
    if (inputNumber.length > 0){ // Check if there is a multiplier
      let lastCharNum=inputNumber.length - 1;
      if (i(inputNumber[lastCharNum],"k")){
        multiplier=1000;
      } else if (i(inputNumber[lastCharNum],"m")){
        multiplier=1000000;
      } else if (i(inputNumber[lastCharNum],"b")){
        multiplier=1000000000;
      }
      if (multiplier > 1){
        let tempArray=inputNumber.split("");
        tempArray.pop();
        var tempNumber=toNumIfPossible(tempArray.join(""));
        if (typeof tempNumber=="number"){
          outputNumber=tempNumber*multiplier;
        }
      }
    }
  }
  return toNumIfPossible(outputNumber); // If the value cannot be converted to a number, the input is output untouched
}
async function withdraw(player, command, args, messageObj){
  // Expect
  thisConsole.log("Withdraw command ran!");
  if (args.length == 1){
    if (i(args[0],"help")){
      return withdrawHelp(player,{fast:true});
    }
    var creditsToWithdraw=args[0];
    if (!bankingFileObj.hasOwnProperty(player.name)){ // If the player has no bank account, set it to 0.
      bankingFileObj[player.name]=0;  
    }
    if (i(creditsToWithdraw,"all")){
      creditsToWithdraw=Number(bankingFileObj[player.name]);
    }
    creditsToWithdraw=convertNumShortcuts(creditsToWithdraw); // this is for k,m, and b.  Does nothing if no multiplier specified.
    if (typeof creditsToWithdraw == "number"){
      if (creditsToWithdraw > 0){
        var playerCredits=await player.credits().catch((err) => console.error(err));
        if (typeof playerCredits == "number"){
          if (bankingFileObj[player.name] >= creditsToWithdraw){
            // First add the credits from the player's inventory
            let playerNewCredits=playerCredits+creditsToWithdraw;
            if (playerNewCredits > maxCreditsAstronautCanHold){ // Astronauts can only carry so many credits.  This is a java limitation.
              return player.botMsg(`ERROR:  Could not add credits to your inventory!  The max credits an astronaut can carry in StarMade is ${toNumberWithCommas(maxCreditsAstronautCanHold)} credits!`,{fast:true}).catch((err) => console.error(err));  
            }
            let addResult=await player.giveCredits(creditsToWithdraw);
            if (addResult){
              let playerNewCreditCount=playerCredits+creditsToWithdraw;
              bankingFileObj[player.name]-=creditsToWithdraw; // If successful, remove credits player's bank account
              writeBankingFile();
              log(`BANKING:  Withdrew ${toNumberWithCommas(creditsToWithdraw)} for player, ${player.name}, bringing their account to ${toNumberWithCommas(bankingFileObj[player.name])} credits.`);
              return player.botMsg(`Credit withdrawel of ${toNumberWithCommas(creditsToWithdraw)} succeeded!  Your bank account now has ${toNumberWithCommas(bankingFileObj[player.name])} credits and your inventory has ${toNumberWithCommas(playerNewCreditCount)} credits!`,{fast:true}).catch((err) => console.error(err));
            } else {
              log(`BANKING: Failed to add credits to inventory for '${player.name}' during withdraw.  Credits attempted: ${toNumberWithCommas(creditsToWithdraw)}`);
              return player.botMsg(`ERROR:  Could not add credits to your inventory!  Please try again! (Your bank credits are SAFE!)`,{fast:true}).catch((err) => console.error(err));  
            }
          } else {
            return player.botMsg(`Sorry, you do not have that many credits in your bank account!  You only have ${toNumberWithCommas(bankingFileObj[player.name])} credit(s)!`,{fast:true}).catch((err) => console.error(err));
          }
        } else {
          log(`BANKING: Failed to retreive credit count for '${player.name}' during withdraw.`);
          return player.botMsg("ERROR:  Something went wrong when attempting to withdraw your credits.  Your credits are SAFE.  Please try again!",{fast:true}).catch((err) => console.error(err));
        }
      } else {
        await player.botMsg("ERROR:  Invalid amount of credits given!  Please provide a POSITIVE number!  If you would like to deposit credits, please use the deposit command!",{fast:true}).catch((err) => console.error(err));
        return withdrawHelp(player,{fast:true});
      }
    } else {
      player.botMsg("ERROR:  Invalid amount of credits given!  Please provide a number!",{fast:true}).catch((err) => console.error(err));
      return withdrawHelp(player,{fast:true});
    }
  } else if (args.length > 1){
    player.botMsg("ERROR:  Too many arguments!",{fast:true}).catch((err) => console.error(err));
    return withdrawHelp(player,{fast:true});
  } else {
    player.botMsg("ERROR:  You must provide the amount of credits you would like to withdraw!",{fast:true}).catch((err) => console.error(err));
    return withdrawHelp(player,{fast:true});
  }
}
function withdrawHelp(player,options){
  player.botMsg("This command is used to withdraw credits from your virtual bank.",options).catch((err) => console.error(err));
  player.msg(`Usage: ${commandOperator}withdraw [Number of Credits]`,options).catch((err) => console.error(err));
  player.msg(`Note: 'all' can be used to withdraw as many credits as possible.  "k","m","b" can be used for shorthand.`,options).catch((err) => console.error(err));
  player.msg(`Example 1: ${commandOperator}withdraw all`,options).catch((err) => console.error(err));
  player.msg(`Example 2: ${commandOperator}withdraw 50000`,options).catch((err) => console.error(err));
  player.msg(`Example 3: ${commandOperator}withdraw 50k`,options).catch((err) => console.error(err));
}

async function deposit(player, command, args, messageObj){
  // Expect
  thisConsole.log("Deposit command ran!");
  if (args.length == 1){
    if (i(args[0],"help")){
      return depositHelp(player,{fast:true});
    }
    var playerCredits=await player.credits().catch((err) => console.error(err));
    if (typeof playerCredits == "number"){ 
      if (playerCredits == 0){
        return player.botMsg(`Sorry, you do not have any credits in your inventory to deposit!`,{fast:true}).catch((err) => console.error(err));
      }
      var creditsToDeposit=convertNumShortcuts(args[0]);
      if (creditsToDeposit=="all"){
        creditsToDeposit=playerCredits;
      }
      if (typeof creditsToDeposit == "number"){
        if (creditsToDeposit > 0){
          if (playerCredits >= creditsToDeposit){
            // First withdraw the credits from the player's inventory
            let negativeCreditsToDeposit=creditsToDeposit * -1;
            let removeResult=await player.giveCredits(negativeCreditsToDeposit).catch((err) => console.error(err));
            if (removeResult){
              if (!bankingFileObj.hasOwnProperty(player.name)){ // If the player has no bank account, set it to 0.
                bankingFileObj[player.name]=0;  
              }
              bankingFileObj[player.name]+=creditsToDeposit;
              writeBankingFile();
              log(`BANKING:  Deposited ${toNumberWithCommas(creditsToDeposit)} for player, ${player.name}, bringing their account to ${toNumberWithCommas(bankingFileObj[player.name])} credits.`);
              return player.botMsg(`Deposited ${toNumberWithCommas(creditsToDeposit)} credits!  Your bank account now has ${toNumberWithCommas(bankingFileObj[player.name])} credits!`,{fast:true}).catch((err) => console.error(err));
            } else {
              log(`BANKING: Failed to remove credit count for '${player.name}' during deposit.  Credits attempted: ${creditsToDeposit}`);
              return player.botMsg(`ERROR:  Could not remove credits from your inventory!  Please try again!`,{fast:true}).catch((err) => console.error(err));  
            }
          } else {
            return player.botMsg(`Sorry, you do not have that many credits in your inventory!  You only have ${toNumberWithCommas(playerCredits)} credit(s)!`,{fast:true}).catch((err) => console.error(err));
          }
        } else {
          await player.botMsg("ERROR:  Invalid amount of credits given!  Please provide a POSITIVE number!  If you would like to withdraw credits, please use the WITHDRAW command!",{fast:true}).catch((err) => console.error(err));
          return depositHelp(player,{fast:true});
        }
      } else {
        player.botMsg("ERROR:  Invalid amount of credits given!  Please provide a number!",{fast:true}).catch((err) => console.error(err));
        return depositHelp(player,{fast:true});
      }
    } else {
      log(`BANKING: Failed to retreive credit count for '${player.name}' during deposit.`);
      return player.botMsg("ERROR:  Something went wrong when attempting to deposit your credits.  Your credits are SAFE.  Please try again!",{fast:true}).catch((err) => console.error(err));
    }
  } else if (args.length > 1){
    player.botMsg("ERROR:  Too many arguments!",{fast:true}).catch((err) => console.error(err));
    return depositHelp(player,{fast:true});
  } else {
    player.botMsg("ERROR:  You must provide the amount of credits you would like to deposit!",{fast:true}).catch((err) => console.error(err));
    return depositHelp(player,{fast:true});
  }
}
function depositHelp(player,options){
  player.botMsg("This command is used to deposit credits into your virtual bank.",options).catch((err) => console.error(err));
  player.msg(`Usage: ${commandOperator}deposit [Number of Credits]`,options).catch((err) => console.error(err));
  player.msg(`Note: 'all' can be used to deposit all credits.  "k","m","b" can be used for shorthand.`,options).catch((err) => console.error(err));
  player.msg(`Example 1: ${commandOperator}deposit all`,options).catch((err) => console.error(err));
  player.msg(`Example 2: ${commandOperator}deposit 50000`,options).catch((err) => console.error(err));
  player.msg(`Example 3: ${commandOperator}deposit 50k`,options).catch((err) => console.error(err));
}
function writeBankingFile(){
  thisConsole.log("Writing to banking file: " + bankingFilePath);
  return writeJSONFileSync(bankingFilePath,bankingFileObj);
}
