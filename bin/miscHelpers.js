const path=require('path');
const binFolder=path.resolve(__dirname,"../bin/");

function requireBin(scriptFile){
  return require(path.join(binFolder,scriptFile));
}

function isPidAlive(thePID){
  try {
    process.kill(thePID,0);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports={
  requireBin,
  isPidAlive
};
