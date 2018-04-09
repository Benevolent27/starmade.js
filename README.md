# starmade.js

[![Build Status](https://travis-ci.org/Benevolent27/starmade.js.svg?branch=master)](https://travis-ci.org/Benevolent27/starmade.js)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js?ref=badge_shield)
[![Dependencies Status](https://david-dm.org/Benevolent27/starmade.js.svg)](https://david-dm.org/Benevolent27/starmade.js.svg)

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

If you would like to test the wrapper RIGHT NOW, create a "settings.json" file in the same folder you have the starmade.js file with the following contents:
`{
    "starMadeFolder": "/home/philip/Programs/StarMade/",
    "javaMin": "128m",
    "javaMax": "1024m",
    "port":"4242"
}`

Change the "starMadeFolder" value to be your starmade install folder where your StarMade.jar is located.  javaMin, javaMax, and port values can be changed as you wish.  (I'd suggest increasing the memory usage if you plan on actually flying around the universe)  When ready to shut down the server, type "/shutdown 1" in the console.  If for some reason your script crashes, the server will still be running.  You will need to kill end it manually.  The PID will be in the "server.lck" file generated.  You will then want to delete the "server.lck" file to start the server again.



## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js?ref=badge_large)

