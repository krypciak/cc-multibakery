# Game variables

## Variable request flow

When getting/setting a game variable, the request goes through a chain:

![Variable flow graph](/docs/drawio/game-var-flow.svg)

For example:
- if a client instance requests a variable `tmp.var`, the map instance will capture the request and return the correct value.  
- all clients on the same map share all variables
- if a client instance requests a variable `plot.line`, the server instance will capture the request.
- if you want each client instance to have their own unique variable storage, use:  
  `tmp.clients[player.username].something` - no special rules apply here.  
   When run on a client instance, `player.username` returns the client username, otherwise `null`.  


## New variables

![Graph of game variables](/docs/drawio/game-vars.svg)


Notes:
- `PartyId` is a regular string
- `party.has`, `party.alive` and `party.size` behavior is kept unchanged from vanilla,  
  this means that they operate only on vanilla party members

Examples:
- `multi.players.length` - count of players on the server
- `multi.playersOnMap.length` - count of players on the current map
- `multi.players[0].username` - username of the first player on the server
- `multi.players[0].model.player.username` - username of the first player on the server
- `multi.playersByName[tmp.username].model.item.3.amount` - amount of `Sweet Berry Tea` (id 3)
  that player with username located in `tmp.username` has
- `multi.parties.length` - amount of parties
- `multi.parties[0].title` - title of the first party
- `multi.partiesById[tmp.partyId].combatants.all[0].pos.x` - x position of the first combatant  
   in a party with id located in `tmp.partyId`
- `party.combatants.allOnMap.length` - count of players on the current map in the client's party
- `pvp.parties[1].combatants.players[0].pos.x` - x position of the first player in the second party
- `pvp.parties[1].combatants.playersOnMap[0].pos.x` - x position of the first player on the current map in the second party
- `pvp.parties[0].combatants.playersByNameOnMap.Chris.pos.x` - x position of player named `Chris` in the first party
