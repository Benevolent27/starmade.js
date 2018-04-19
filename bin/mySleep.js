// This script uses spawnSync, calling itself to wait for a desired duration.
// It's pretty accurate for durations of 100ms or higher.
// returns true if it thinks it was accurate, false if not, with about a 15ms variance.

var spawnSync=require('child_process').spawnSync;
// var path=require('path');

if (__filename == require.main.filename){ // Only run this part if the script was run as the main script ran.
  if (process.argv[2]){
    if (isNaN(parseInt(process.argv[2]))){
      throw new Error("Non-integer provided to mySleep as argument!"); // This should never happen since it should always be running itself.
    } else {
      sleepNow(process.argv[2]);
    }
  }
}
var sleepLeft;
async function sleepNow(sleepTill){
  sleepLeft=sleepTill-Date.now();
  if (sleepLeft > 0){
    await sleep(sleepLeft);
  }
  process.stdout.write(Date.now().toString());
  return true;
}
function sleep(ms) { // This will only work within async functions.
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gotoSleep(sleepTill){
  if (__filename != require.main.filename){ // Only spawn itself IF it is being called from another script, otherwise horrible loops can happen.
    var result=spawnSync("node",[__filename,sleepTill],{"cwd":__dirname}).stdout; // It's running itself here for the specified timeframe.
    return parseInt(result);
  }
  return false;
}
var sleepTill;
function mySleep(ms){
  if (ms){
    if (isNaN(parseInt(ms))){
      throw new Error("Non-integer value provided to mySleep!");
    } else {
      sleepTill=Date.now() + parseInt(ms);
      var sleepResult=gotoSleep(sleepTill - 5);
      var finalResult=sleepTill-sleepResult;
      if (Math.abs(finalResult) < 10){
        return true;
      }
      return false;
    }
  } else {
    throw new Error("No number value given to mySleep!");
  }
}
module.exports=mySleep;
