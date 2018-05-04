const path=require('path');
const binFolder=path.resolve(__dirname,"../bin/");

function requireBin(scriptFile){
  return require(path.join(binFolder,scriptFile));
}

module.exports={requireBin};
