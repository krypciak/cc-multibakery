# Game variables

## Variable request flow

When geting/seting a game variable, the request goes through a chain:

- if a client instance requests a variable `tmp.var`, the map instance will capture the request and return the correct value.  
- all clients on the same map share all variables except `map.client.` and `tmp.client.`

## New variables

![Graph of game variables](https://github.com/user-attachments/assets/9d7b916d-325e-4a55-b3b4-36a29cb525a7)


Examples:
- `multi.players.length` - count of players on the server
- `multi.playersOnMap.length` - count of players on the current map
- `multi.players[0].player.username` - username of the first player on the server
- `multi.players[0].player.entity.username` - username of the first player on the server
- `multi.playersByName[tmp.username].item.3.amount` - amount of `Sweet Berry Tea` (id 3)
  that player with username located in `tmp.username` has
- `multi.parties.length` - amount of parties
- `multi.parties[0].title` - title of the first party
- `multi.partiesById[tmp.partyId].combatants.all[0].pos.x` - x position of the first combatant  
   in a party with id located in `tmp.partyId`
- `party.combatants.allOnMap.length` - count of players on the current map in the client's party
- `pvp.parties[1].combatants.players[0].pos.x` - x position of the first player in the second party
- `pvp.parties[1].combatants.playersOnMap[0].pos.x` - x position of the first player on the current map in the second party
- `pvp.parties[0].combatants.playersByNameOnMap.Chris.pos.x` - x position of player named `Chris` in the first party
