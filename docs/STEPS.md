# Steps

Recommend to read [cc-krypek-lib](https://github.com/krypciak/cc-krypek-lib?tab=readme-ov-file#for-mod-developers) documentation beforehand.  

## Pvp related steps

### `ig.EVENT_STEP.ADD_PLAYERS_TO_PVP`

Given players, retrieves their parties and adds those parties to pvp.  
Pvp has to be off when calling this step.  

Settings:
- `players` (`ig.Event.ArrayExpression<dummy.DummyPlayer>`) - array of players

Examples:  
```json
{ "type": "COMMENT", "text": "ran in a client instance, add the player's party to pvp" },
{ "type": "ADD_PLAYERS_TO_PVP", "players": { "varName": "party.combatants.players" } }
```

### `ig.EVENT_STEP.CLEAR_MULTIPLAYER_PVP_PARTIES`

Clear selected parties for pvp.  
Pvp has to be off when calling this step.  

Examples:  
```json
{ "type": "CLEAR_MULTIPLAYER_PVP_PARTIES" } }
```

### `ig.EVENT_STEP.START_MULTIPLAYER_PVP_BATTLE`

Start multiplayer pvp battle.  
If there are less than 2 parties selected for pvp, the game will crash.  

Settings:
- `winPoints` (`ig.Event.NumberExpression`) - number of win points

Examples:  
```json
{ "type": "START_MULTIPLAYER_PVP_BATTLE", "winPoints": { "varName": "tmp.pvpWinPoints" } },
```

## Misc steps

### `ig.EVENT_STEP.FOR_EACH_PLAYER`

Runs steps for each provided player in the player's client instance.  
If the server is off, it simply executes `steps`.  
If you want your steps to also work when the server is off, avoid using multibakery player selectors,
so for example instead of `multi.playersOnMap` use cc-krypek-lib variable `game.entities.type.Player`.

Settings:
- `players` (`ig.Event.ArrayExpression<dummy.DummyPlayer>`) - array of players
- `steps` (`ig.EventStepBase[]`) - steps to run
- `noWait` (`boolean`) (optional, default = `false`) - whether to wait for all `steps` to finish in all client instances
- `indexVarName` (`string`) (optional) - if set, set variable named `indexVarName` to the index of the current player in the array

Examples:  
```json
{ "type": "COMMENT", "text": "this teleports all players on the current map to specific coordinates" },
{
    "type": "FOR_EACH_PLAYER",
    "players": { "varName": "game.entities.type.Player" },
    "steps": [
        { "type": "DO_ACTION", "entity": { "player": true }, "action": [
            { "type": "SET_POS", "newPos": { "x": 100, "y": 100, "z": 32 } }
        ] }
    ]
}
{ "type": "COMMENT", "text": "this teleports the first player on the map to specific coordinates" },
{ "type": "COMMENT", "text": "multi.playersOnMap[0] will crash the game when the server is off!" },
{ "type": "COMMENT", "text": "use game.entities.type.Player if you don't want that to happen" },
{
{
    "type": "FOR_EACH_PLAYER",
    "players": [{ "varName": "multi.playersOnMap[0]" }],
    "steps": [
        { "type": "DO_ACTION", "entity": { "player": true }, "action": [
            { "type": "SET_POS", "newPos": { "x": 100, "y": 100, "z": 32 } }
        ] }
    ]
}
```

### `ig.EVENT_STEP.GODMODE`

Gives the player op stats:
- all items
- equip end game gear
- lvl 99
- unlocks all circuit tree entries (except Pin Body)
- alotta circuit points, credits
- unlocks all areas, all maps, all landmarks
- unlocks all core abilities
- infinite sp
- gives party member entries

Settings:
- `circuitBranch` (`ig.Event`) (optional) - what skill circuit branch to use

Examples:  
```json
{ "type": "GODMODE" },
{ "type": "GODMODE", "circuitBranch": true },
{ "type": "GODMODE", "circuitBranch": { "varName": "tmp.godmodeBranch" } }
```
