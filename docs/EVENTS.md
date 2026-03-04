# Events

Events can run in either the map instance of the client instance.  
Since in map instances `ig.game.playerEntity` is null, some steps that expect it to be set may crash when executed on the map instance.  
Events can be redirected to run in an client instance if the event is detected to be caused by the player.  
Example:  

![Diagram showing an example of a player triggering an event](/docs/drawio/events.svg)

Other actions initiated by the player and tracked by the system include:
- Killing an `ig.ENTITY.Enemy` that has a `varIncrease` variable counter
- Floor switches
- Walking into `ig.ENTITY.TouchTrigger`
- etc.

If an action does not properly trigger the redirection mechanism, it is considered a bug, since each entity requires manual redirection implementation.
