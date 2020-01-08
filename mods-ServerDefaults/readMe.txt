Mods placed here should be server mods only.  These are copied to the installation folder when a new server is set up, then the mods are loaded.
Mods are responsible for configuring the settings for their install, installing, and running the server.
Each time the wrapper is started, the mods will be required in.  
When the wrapper is ready for servers to start, an event "init" will be emitted to global.event
It is the responsibility of a server mod to emit an event "start" with the value of the install directory once the server object is created.  This allows mods to start listening for events on the serverObj.event