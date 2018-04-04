# starmade.js
This is an unfinished server wrapper for running a StarMade server.  It is currently being developed and is close to working out of the box.

If you would like to test it right now, create a "settings.json" file in the same folder you have the starmade.js file with the following contents:
{
    "starMadeFolder": "/home/philip/Programs/StarMade/",
    "javaMin": "128m",
    "javaMax": "1024m",
    "port":"4242"
}

Change the "starMadeFolder" value to be your starmade install folder where your StarMade.jar is located.  javaMin, javaMax, and port values can be changed as you wish.  (I'd suggest increasing the memory usage if you plan on actually flying around the universe)  When ready to shut down the server, type "/shutdown 1" in the console.  If for some reason your script crashes, the server will still be running.  You will need to kill end it manually.  The PID will be in the "server.lck" file generated.  You will then want to delete the "server.lck" file to start the server again.

The end goal here is to produce a highly moddable wrapper that works on any OS that runs nodejs.  It will be an event driven wrapper with built in support for writing to cfg and ini files, storing data in local and global sqlite databases, and will have a rich feature set out of the box.  Some base features may include a banking system for players, quest engine, automated tournaments, and more.  Every "mod" will be easy to drop in, refresh, disable, or remove without restarting the server.  There will be a clear framework for mods, full documentation of features and capabilities, and tutorials on how to make mods for the wrapper.  These will be available upon release.

But for now, if you would like to be a contributor, just send me a message and we'll get started. :)
