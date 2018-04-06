const fs = require('fs');

var settingsFile="./settings.json";
var settingSet=false;
var settings={};
// For async Function at bottom of script.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

var questionsArray = [
    "What is your StarMade Directory?",
    "What is the Minimum Memory?",
    "What is the Maximum memory?",
    "What is the Port?"
];
var questions = questionsArray.length;
  // Ask for the path to the starmade folder and put into a "result" variable.


function askQuestions() {
        if (questions > 0) {
        process.stdout.write("Question #" + questions + " : " + questionsArray[(questions-1)].toString());
        process.stdin.once('data', function (data) {
            console.log("You typed:" + data.toString().trim());
			if (questions==3) { // We just got the answer for the 1st question(ports)
				if (data){
					settings["port"]=data.toString().trim();
				} else {
					settings["port"]='4242'
				}
			} else if (questions==2) { // We just got the answer to the 2nd question(javaMax)
				if (data){
					settings["javaMax"]=data.toString().trim();
				} else {
					settings["javaMax"]='1024'
				}
			} else if (questions==1) { // We just got the answer to the 3rd question(javaMin)
			    if (data){
					settings["javaMin"]=data.toString().trim();
				} else {
					settings["javaMin"]='512'
				}
			} else if (questions==0) { // We just got the answer to the 4th (StarMade Folder)
			    if (data){
					settings["starMadeFolder"]=data.toString().trim();
				} else {
					settings["starMadeFolder"]='/starmade/'
				}
			}
            askQuestions();
        });
    } else {
        process.stdin.end();
    }
    questions--;
};


askQuestions();

async function end(){
    while(questions>-1){
        await sleep(1000);
    }
    console.log("Done!");
    console.dir(settings);
}
end();


//try {
//  var settings = require(settingsFile);
//  console.log("Imported settings values from " + settingsFile);
//} catch (ex) {
//    console.log("'" + settingsFile + "' file not found! Asking for information!");
//    var settings = {};
//	// ask for ALL the information
// 
//	settingSet=true;
//}
  
// IF there was a settings.json file imported, ensure that all values are set.
//if (!settings.hasOwnProperty('starMadeFolder')) askForStarMadeFolder();
//if (!settings.hasOwnProperty('javaMin')) askForJavaMin();
//if (!settings.hasOwnProperty('javaMax')) askForJavaMax();
//if (!settings.hasOwnProperty('port')) askForPort();
// Only write to the file IF new settings were set, otherwise leave it alone.
//if (settingSet==true) {
//	var settingsFileStream=fs.createWriteStream(settingsFile);
//	settingsFileStream.write(JSON.stringify(settings));
//	settingsFileStream.end();
//};