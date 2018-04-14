Here are the current goals of starmade.js:

1. We are building a wrapper that should translate in-game events to node event broadcasts.
2. In-Game events should be definable in an editable text file or .json file.
3. Mods will be scoped to the running StarMade instance by default, but globally scoped mods can also be created.
4. There should be adequate built in functions to support mods, but we should avoid unnecessary complexity.
5. Setting up the wrapper should be as simple and easy as possible.
6. The wrapper should be able to run on Windows, MacOSX, and Linux consoles, with full functionality at the console.
7. All functionality of the wrapper should exist in the form of mods which can be replaced or disabled.

How-To and WHY:
1. This is done by scanning the console output AND the serverlog.0.log file, then parsing each line to pull relevant data, such as the name of a player who has died.
2. We want mods to function on either the server OR global scope so that server management mods can exist.
For example, perhaps a global mod has a web interface and allows spawning multiple instances of a StarMade server and then loading and unloading specific mods to all of them.
If not specified, the scope will be assumed to work for the individual server instance, so that mods can be kept simpler.
3. For example, reading/writing to local and global databases should be made easy.  We don't people to have to guess where data is or come up with their own various methods of saving and retreiving data.  We want a standardized approach.
4. This is to allow compatiblity with future versions of StarMade WITHOUT having to edit the source code.  For example, maybe the syntax of player deaths changes in a version.  The pattern file can be updated without breaking any mods.
5. For things like installing a mod, it should be as simple as dropping in a zip file to a directory.
Full documentation on features and tutorials should also exist, so that anybody can follow along and have a modded game server up and running in no time.
Server admins should NOT have to be coders to run a full-featured server, but people who want to create mods for the wrapper should have a clear path on how to make mods for the wrapper.
6. Cross-platform for the wrapper is important, because right now a lot of people are being encouraged to use windows for their server simply because that's where many of the best wrappers exist.
We want to ensure the wrapper does not have any built-in GUI, because the best servers are headless.  There is no reason why we cannot give webpage access to control the server if we wish to include a GUI, and there is no reason why this GUI should exist as a mod.
7. We want all functionality of the wrapper to be moddable to allow the most customization possible.
For example, when a person types a command in-game, such as !help, there should be a default "mod" that handles this.  Perhaps it looks up sub-folders within a "/mods" folder, and then reads from a "commands.json" file to get the names of each command, what their category is, and then builds a list of commands with proper spacing and under like-categories.  Then the "mod" might also provide a "!help" command, which parses the same "command.json" files for all the mods, providing the help text for whatever subcommand is given. For example, "!help quests" would find all mods that have such a command listed, then provide the help text for each one.  BUT perhaps a modder wants to change this functionality so that instead of just spitting out the help section for the command, it might look for and prefer a "script" value.  It would then take run the script provided with the player's name to allow dynamic help on a per-player basis, and this would also be backward compatible with existing mods.
