# Server architecture

The library mod `cc-instanceinator` provides separate "instances", that each contain their own game state, including menus, game options, in-game state, etc.  
`cc-multibakery` creates multiple of these instances, manages them and links some of their state.  
In `cc-multibakery`, there are 3 instance types:
- Server instance
- Map instance
- Client instance

Here's what the hierarchy looks like:  
![Instance hierarchy](https://github.com/user-attachments/assets/24bcd80b-4dff-4823-b1a1-962e50c35ca7)

## Server instance

There's always one server instance at any given time.  
It doesn't do any work per say.  
It's main purpose is to be a fallback context after game loop updates are complete.  
The other function is to store game data that is shared across all maps:
- game variables (`ig.Vars`): `maps.` and other global vars
- areas visited, active landmarks
- etc.

## Map instances

They represent a single map. They are created on demand (when a client instance tries to enter one).  
Map instances run the actual game physics updates.  
They do not have any gui elements, just a simple game view.  
`ig.game.playerEntity` is `null`.  
Map instances become inactive when no player is currently on them.  
Inactive maps don't get updated.

## Client instances

They represent a game view for a single player.  
Their only job is to create a gui for the player to interact with and to display the game view.  
Client instances "link" to the correct map instance when the player enters a new map:
- `ig.game.entities` is linked
- `ig.game.physics` is linked
- other map specific variables

This means that all players on the same map will see the same entities, however they can see different gui elements.  
`ig.game.playerEntity` is set.  
The same client instance is reused when the player switches maps.  

## Instance visibility

By default, only local client instances are shown.  
You can show other instances by enabling these options in the settings menu under the `Server` tab:
- `Display server inst` - not much to see there
- `Display map insts` - display map instances
- `Display client insts` - on by default
- `Display remote client insts` - display client instances of players connecting remotely

