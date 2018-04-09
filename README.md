# starmade.js

[![Build Status](https://travis-ci.org/Benevolent27/starmade.js.svg?branch=master)](https://travis-ci.org/Benevolent27/starmade.js)
[![AppVeyor](https://ci.appveyor.com/api/projects/status/nklifk3369iqmed5?svg=true)](https://ci.appveyor.com/project/Benevolent27/starmade-js)
[![Dependencies Status](https://david-dm.org/Benevolent27/starmade.js.svg)](https://david-dm.org/Benevolent27/starmade.js)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js?ref=badge_shield)

This is an unfinished server wrapper for running a StarMade server.  It is currently being developed and is close to working out of the box.

The end goal here is to produce a highly moddable wrapper that will:
* Work on any OS that runs nodejs.  
* Be event driven 
* Have built in support for storing and retreiving data from ini and local/global sqlite databases
* Have a rich feature set out of the box.  Some base features may include a banking system for players, quest engine, automated tournaments, and more.  
* Allow to easily configure and deploy mods, with easy to drop in, refresh, disable, or remove without restarting the server.  
* There will be a clear framework for mods, with full documentation of base features and capabilities, and tutorials.

These features are planned to be available upon release.

But for now, if you would like to be a contributor, just send me a message and we'll get started. :)

If you'd like to get started now, the scripting has been successfully running a server on linux.  When you run starmade.js, it should automatically download whatever is needed and get things set up after some quick questions. 
Note:  If for some reason your script crashes, the StarMade server might still be in the background.  One of the quirks of starting a process in node.  You can kill it manually.  If you need the PID, it will be stored the "server.lck" file that is generated in the same folder as your starmade.js file.  You can also type "jps" in your console if you have the JDK installed to get the PID of any java process running.  You will then want to delete the "server.lck" file to start the server again.

Oh, and if you get a server up and running, try typing "!command" in-game in any chat window and press enter.



## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js?ref=badge_large)

