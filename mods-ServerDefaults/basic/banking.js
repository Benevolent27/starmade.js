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
var {writeJSONFileSync,getJSONFile,getJSONFileSync,existsAndIsFile,i}=miscHelpers;

const installObj=global.getInstallObj(__dirname); // Get the install object
const installPath=installObj.path;
const bankingFilePath=path.join(installPath,"banking.json");
const maxCreditsAstronautCanHold=2147483647;
const {event,log}=installObj;
const thisConsole=installObj.console;
var serverObj={};
var bankingFileObj={};
var commandOperator="!";
global.exitHook(() => { // This will handle sigint and sigterm exits, errors, and everything (except SIGKILL, of course).
  writeBankingFile();
});

event.on("serverExit",function(){ // This isn't really necessary, but let's just do it for now.
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
  // regCommand("transfer", "Banking", false, true,{},transfer);
  // regCommand("banktransfer", "Banking", false, true,{},banktransfer);
});

async function withdraw(player, command, args, messageObj){
  // Expect
  thisConsole.log("Withdraw command ran!");
  if (args.length == 1){
    if (i(args[0],"help")){
      return withdrawHelp(player,{fast:true});
    }
    var creditsToWithdraw=toNumIfPossible(args[0]);
    if (typeof creditsToWithdraw == "number"){
      if (creditsToWithdraw > 0){
        var playerCredits=await player.credits().catch((err) => console.error(err));
        if (typeof playerCredits == "number"){
          if (!bankingFileObj.hasOwnProperty(player.name)){ // If the player has no bank account, set it to 0.
            bankingFileObj[player.name]=0;  
          }
          if (bankingFileObj[player.name] >= creditsToWithdraw){
            // First add the credits from the player's inventory
            let playerNewCredits=playerCredits+creditsToWithdraw;
            if (playerNewCredits > maxCreditsAstronautCanHold){ // Astronauts can only carry so many credits.  This is a java limitation.
              return player.botMsg(`ERROR:  Could not add credits to your inventory!  The max credits an astronaut can carry in StarMade is ${maxCreditsAstronautCanHold} credits!`,{fast:true}).catch((err) => console.error(err));  
            }
            let addResult=await player.giveCredits(creditsToWithdraw);
            if (addResult){
              let playerNewCreditCount=playerCredits+creditsToWithdraw;
              bankingFileObj[player.name]-=creditsToWithdraw; // If successful, remove credits player's bank account
              writeBankingFile();
              log(`BANKING:  Withdrew ${creditsToWithdraw} for player, ${player.name}, bringing their account to ${bankingFileObj[player.name]} credits.`);
              return player.botMsg(`SUCCESSFULLY withdrew ${creditsToWithdraw} credits!  Your bank account now has ${bankingFileObj[player.name]} credits and your inventory has ${playerNewCreditCount} credits!`,{fast:true}).catch((err) => console.error(err));
            } else {
              log(`BANKING: Failed to add credits to inventory for '${player.name}' during withdraw.  Credits attempted: ${creditsToWithdraw}`);
              return player.botMsg(`ERROR:  Could not add credits to your inventory!  Please try again! (Your bank credits are SAFE!)`,{fast:true}).catch((err) => console.error(err));  
            }
          } else {
            return player.botMsg(`Sorry, you do not have that many credits in your bank account!  You only have ${bankingFileObj[player.name]} credit(s)!`,{fast:true}).catch((err) => console.error(err));
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
  player.msg(`Example 1: !withdraw all`,options).catch((err) => console.error(err));
  player.msg(`Example 2: !withdraw 50000`,options).catch((err) => console.error(err));
  player.msg(`Example 3: !withdraw 50k`,options).catch((err) => console.error(err));
}




async function deposit(player, command, args, messageObj){
  // Expect
  thisConsole.log("Deposit command ran!");
  if (args.length == 1){
    if (i(args[0],"help")){
      return depositHelp(player,{fast:true});
    }
    var creditsToDeposit=toNumIfPossible(args[0]);
    if (typeof creditsToDeposit == "number"){
      if (creditsToDeposit > 0){
        var playerCredits=await player.credits().catch((err) => console.error(err));
        if (typeof playerCredits == "number"){
          if (playerCredits >= creditsToDeposit){
            // First withdraw the credits from the player's inventory
            let negativeCreditsToDeposit=creditsToDeposit * -1;
            let removeResult=await player.giveCredits(negativeCreditsToDeposit);
            if (removeResult){
              if (!bankingFileObj.hasOwnProperty(player.name)){ // If the player has no bank account, set it to 0.
                bankingFileObj[player.name]=0;  
              }
              bankingFileObj[player.name]+=creditsToDeposit;
              writeBankingFile();
              log(`BANKING:  Deposited ${creditsToDeposit} for player, ${player.name}, bringing their account to ${bankingFileObj[player.name]} credits.`);
              return player.botMsg(`SUCCESSFULLY deposited ${creditsToDeposit} credits!  Your bank account now has ${bankingFileObj[player.name]} credits!`,{fast:true}).catch((err) => console.error(err));
            } else {
              log(`BANKING: Failed to remove credit count for '${player.name}' during deposit.  Credits attempted: ${creditsToDeposit}`);
              return player.botMsg(`ERROR:  Could not remove credits from your inventory!  Please try again!`,{fast:true}).catch((err) => console.error(err));  
            }
          } else {
            return player.botMsg(`Sorry, you do not have that many credits in your inventory!  You only have ${playerCredits} credit(s)!`,{fast:true}).catch((err) => console.error(err));
          }
        } else {
          log(`BANKING: Failed to retreive credit count for '${player.name}' during deposit.`);
          return player.botMsg("ERROR:  Something went wrong when attempting to deposit your credits.  Your credits are SAFE.  Please try again!",{fast:true}).catch((err) => console.error(err));
        }
      } else {
        await player.botMsg("ERROR:  Invalid amount of credits given!  Please provide a POSITIVE number!  If you would like to withdraw credits, please use the WITHDRAW command!",{fast:true}).catch((err) => console.error(err));
        return depositHelp(player,{fast:true});
      }
    } else {
      player.botMsg("ERROR:  Invalid amount of credits given!  Please provide a number!",{fast:true}).catch((err) => console.error(err));
      return depositHelp(player,{fast:true});
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
  player.msg(`Example 1: !deposit all`,options).catch((err) => console.error(err));
  player.msg(`Example 2: !deposit 50000`,options).catch((err) => console.error(err));
  player.msg(`Example 3: !deposit 50k`,options).catch((err) => console.error(err));
}
function writeBankingFile(){
  thisConsole.log("Writing to banking file: " + bankingFilePath);
  return writeJSONFileSync(bankingFilePath,bankingFileObj);
}
