# starmade.js

[![Build Status](https://travis-ci.org/Benevolent27/starmade.js.svg?branch=master)](https://travis-ci.org/Benevolent27/starmade.js)
[![AppVeyor](https://ci.appveyor.com/api/projects/status/nklifk3369iqmed5?svg=true)](https://ci.appveyor.com/project/Benevolent27/starmade-js)
[![Dependencies Status](https://david-dm.org/Benevolent27/starmade.js.svg)](https://david-dm.org/Benevolent27/starmade.js)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js?ref=badge_shield)

This is an server wrapper for running a StarMade server.  It is currently being developed and is lacking most features.

The end goal here is to produce a highly moddable wrapper that will:
* Work on any OS that runs nodejs.  
* Be event driven 
* Have built in support for storing and retreiving data from ini and local/global sqlite databases
* Have a rich feature set out of the box.  Some base features may include a banking system for players, quest engine, automated tournaments, and more.  
* Allow to easily configure and deploy mods, with easy to drop in, refresh, disable, or remove without restarting the server.  
* There will be a clear framework for mods, with full documentation of base features and capabilities, and tutorials.

These features are planned to be available upon release.

But for now, if you would like to be a contributor, just send me a message and we'll get started or get yourself a test build set up! :)

**Spawn a test build!**
If you'd like to spawn a test build, the scripting has been successfully running a server on linux but could use some testing on windows. 
It requires node.js and git to be installed first.
* https://nodejs.org/  <-- get eeett, nodejs is a pretty awesome language.
* https://git-scm.com/downloads  <-- git, yus, it is good.

Then you can clone my repository and run it.  No other install required.

Here's how to clone a repo:
Start a command window.  (in windows, you can use windows key + r, then type cmd and press enter)
* `git clone https://github.com/Benevolent27/starmade.js`  <-- clone the code repository.  This creates a starmade.js folder.
* `cd starmade.js`
* `node starmade.js`  <-- you are now running the server!  Yay!

When you would like to shut the server down, type `/shutdown 1` in the window.  Anything you type will be forwarded to the running server process, so you can use any of the [[Admin Commands](https://starmadedock.net/threads/admin-commands.1283/)].  There will also be !style commands that you can run to control the server wrapper.  Right now there are just a few basic commands which will change:
* !stdout \[on/off\]
* !stderr \[on/off\]
* !settings list
* !changesettings \[settingName\] \[What you want to change it to\]

Note:  If for some reason your script crashes, the StarMade server might still be running in the background.  You can kill it manually in task manager or at the command line.  If you need the PID, it will be stored the "server.lck" file that is generated in the same folder as your starmade.js file.  You can also type "jps" in your console if you have the JDK installed to get the PID of any java process running.  AFTER the server is killed You will then want to delete the "server.lck" file to start the server again.

Oh, and if you get a server up and running, try typing "!command" in-game in any chat window and press enter.



## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FBenevolent27%2Fstarmade.js?ref=badge_large)

