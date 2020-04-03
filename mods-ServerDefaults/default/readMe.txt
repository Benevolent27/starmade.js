These mods are responsible for setting up the server, installation, starting/stopping/handling crashes, etc.

Normally you don't want to edit these scripts because it might mess up the ability of other mods to function.

Note:  Mods in this folder are NOT reloaded when a mod reload occurs.  As a result, any mods in this folder must use global["event"].on("init") to re-initialize event.on listeners
