<!-- markdownlint-disable MD013 MD024 -->

# Change Log

## [Unreleased]

### Added

- Allow clients to have unique interface options
- Sync client game options for remote clients

### Changed

- Read only var `multi.players` now returns an array of player entities instead of player models
- Remove `tmp.client` and `map.client` special access variables. Use `tmp.clients[player.username]` instead.
- Make the default argument `players` in `FOR_EACH_PLAYER` be `{ "varName": "game.entities.type.Player" }`
- Simplify new variables graph in docs/GAME-VARIABLED.md
- Let each client have their own timers
- Use new `SHOW_OBJECT_SLIDER_DIALOG` from cc-krypek-lib for pvp round selection
- Don't override pvp damage factor, let cc-krypek-lib handle that

### Fixed

- Fix map interact entries sometimes duplicating
- Return null when accessing `player.username` on map instance instead of crashing
- Disallow "null" and "undefined" player usernames
- Fix variable resolving not running in client instance on event chain vars
- Don't crash on `pvp.multiActive` access when server is off
- Don't crash on `player.username` access when server is off
- Fix client guis not receiving var change updates
- Fix crash when an event is redirected to a client
- Fix bgm steps not working on remote
- Fix crash when serializing steps with data polluted by ig.EVENT_STEP.FOR_EACH_PLAYER
- Fix game options often not saving

## [0.7.6] 2026-03-11

### Added

- Add remote ig.ENTITY.Door animation
- Add sc.BombEntity remote state
- Add ig.ENTITY.BombPanel remote state
- Add sc.FerroEntity remote state

### Fixed

- Fix crash when remote player enters after a pvp battle is done
- Fix ig.ENTITY.OneTimeSwitch not switching to off animation on remote
- Fix SHOW_EXTERN_ANIM anims syncing only for the current player on remote
- Fix player actions appearing in a different map after another player attacks him and changes maps
- Fix crash when player exits in the middle of combat with complex enemies
- Fix jetpack mod compatibly

## [0.7.5] 2026-03-06

### Added

- Add player elemental overload remote state
- Add `multi.parties` read only game variable
- Add `multi.players` read only game variable
- Add `pvp.points` read only variable
- Add `pvp.lastWinPartyId` read only variable
- Add `ByName` optional suffix to party var object `.combatants.{all,players,vanillaMembers}`
- Add documentation
- Bake vars into text in steps before sending then to the remote
- Add `sc.FoodIconEntity` remote state

### Changed

- `multi.playerCount` no longer exists, use `multi.players.length`
- `pvp.active` no longer true when multiplayer pvp active, use `pvp.multiActive` instead

### Fixed

- Fix remote crash when remote player uses the nax art switch keybinding
- Fix duplicate particles when using the nax art switch keybinding
- Preserve event chain in actions (fixed saw obstacle)
- Fix crash when using FOR_EACH_PLAYER event step with server off
- Fix certain player properties (like face orientation or items) being shared across different players when loading from save (again)
- Fix server crash when remote interacts with gui props
- Fix remote ig.EVENT_STEP.SHOW_CENTER_MSG
- Fix crash when spawning enemy with steps on client instance
- Fix perfect guard sound and effect not playing on remote
- Fix conditional lights getting cleared when exiting a map
- Fix players remaining a valid target for combat arts even after leaving the map
- Fix combat art branch linking between players
- Fix remote camera detaching from player after prop interaction
- Fix entity shadows not falling onto the ground when entity is midair
- Fix weather
- Fix door, touch trigger and teleport stairs block events not running in client instance

## [0.7.4] 2026-01-22

### Fixed

- Fix server crash when remote player joins and the save file has a lot of data

## [0.7.3] 2026-01-01

### Added

- Add ping interval and ping timeout server options
- Add remote camera and screen blur step state
- Add ig.ENTITY.OneTimeSwitch event chain preservation
- Add ig.ENTITY.EnemyCounter event chain preservation
- Add ig.ENTITY.NPC activeStateIdx remote state
- Add remote player credit state

### Changed

- Teleport new remote players to the same map as master player
- Allow music to play only in the master player's instance

### Fixed

- Fix remote player camera detaching after teleporting to the same map
- Fix remote external animations (like lea sitting)
- Fix crash on ig.EVENT_STEP.ADD_GUI
- Fix pvp hp bars not disappearing after player defeat on remote
- Fix pvp hp bars not rearranging themselves after player defeat on remote
- Fix remote npc animations sometimes not being correct

## [0.7.2] 2025-12-19

### Fixed

- Fix compatibility with cc-krypek-lib v1.1.0

## [0.7.1] 2025-12-18

### Fixed

- Fix crash when starting server using the Server manage menu
- Fix crash when a player in pvp leaves the server
- Fix generated random username in the Create client menu sometimes being invalid
- Fix certain player properties (like face orientation or items) being shared across different players when loading from save
- Fix pvp soft locking sometimes after round end

## [0.7.0] 2025-12-17

### Added

- Add client specific `map.client.` and `tmp.client.` variable namespaces
- Add game addon remote client compatibility check (to check if client has the DLC if the server has it)
- Add player skin support
- Add player exp info to save file and remote syncing
- Added the party system

### Changed

- Ditch entity selection system in favor of var arrays
- Pvp party rework (now uses the new party system)
- Custom pvp steps rework
- Respect cc-instanceinator display id and display fps options

### Fixed

- Fix variables like `player.element` referring to a wrong player when access in the client context
- Fix remote crashed when trying to spawn an effect whose sheet is not yet loaded
- Fix player entities on remote not updating visuals every frame
- Fix remote menu scroll desyncing
- Fix some some actions sometimes not preserving the event chain and running on the wrong instance
- Fix variables failing to set when their parent object doesn't exist
- Fix crash on item drop
- Fix navigation maps often not working
- Fix Manage server popup being closeable while Create client popup is shown
- Fix interactables visual glitches
- Fix remote state not sending vars with prefix `maps.`
- Fix circle glow not appearing for other remote players on remote
- Fix remote game model state getting overriden by client initialization
- Fix godmode overriding maps vars

## [0.6.1] 2025-11-19

### Added

- Added var access namespace: `multi.`

### Changed

- Allow k&m input even when in gamepad input mode

### Fixed

- Fix triblader triggering melee attack circle glow when dashing
- Fix remote client sometimes desyncing when using ig.ENTITY.TeleportField
- Fix remote crash when hit effect occurs on the same frame that the entity gets killed (for example triblader Deploy Shields and lea Flare Burn!)
- Fix remote double effects on sc.CombatProxyEntity death
- Fix waiting for gamepad poping up every time a map is switched
- Fix combat art branch linking on lea character configs
- Don't apply blur and zoom effects in menus
- Don't send remote clients other player action step data (fixes crashes on Gatling Arctillery for example)
- Fix remote zoom/blur effects not clearing after certain combat arts

## [0.6.0] 2025-11-17

### Added

- Add cc-variable-charge-time support

### Fixed

- Fix remote sc.CombatProxyEntity not sharing animation state
- Fix ig.ENTITY.ObjectLayerView being invisible
- Fix no sound playing on client when the map instance is hidden
- Fix error when creating a client in the "Manage server" menu and copyNewPlayerStats is on
- Fix zoom on remote not resetting after using Amber Breaker
- Fix remote item gained popup appearing when losing items (for example eating)
- Fix remote gamepad aim not working

## [0.5.9] 2025-11-14

### Added

- Add ig.ACTION_STEP remote state (fixes missing combat sounds, zooms, blurs)

### Fixed

- Fix remote sc.CombatProxyEntity not sharing animation state
- Fix ig.ENTITY.ObjectLayerView being invisible
- Fix no sound playing on client when the map instance is hidden

## [0.5.8] 2025-11-13

### Added

- Add option (on by default) to give new players cloned stats of the first player found on the map

### Fixed

- Fix entity event to var causal chain sometimes not working on var increments
- Fix most crashes on remote cutscene skip (there are still some rare ones)
- Fix ig.ENTITY.WallVertical & ig.ENTITY.WallHorizontal initial remote state
- Fix ig.ENTITY.EnemyCounter ding on remote on second remote client creation
- Fix ig.ENTITY.Effect not spawning on remote after a while
- Fix crash when loading maps in areas with more than one floor
- Fix creating server from current state resetting stuff like vars, active landmarks etc.
- Fix saving server state not saving stuff like vars, active landmarks etc.
- Fix ig.ENTITY.NPC#postActionUpdate getting overriden when server is off
- Fix map menu player markers not getting drawn on some maps
- Fix map menu player markers persisting after restarting the server
- Fix not all vars getting linked to map/client instance
- Fix ig.ENTITY.Ball remote state not including velocity causing misrotated projectiles
- Fix sc.PlayerConfig inter-instance coupling
- Fix ascended equipment level scaling being inconsistent (now it picks the highest level on the server)
- Fix remote ig.EVENT_STEP.SHOW_BOARD_MSG and ig.EVENT_STEP.SHOW_CHOICE

## [0.5.7] 2025-11-10

### Added

- Add buttons for adding new server entries to the server list menu
- Add ig.ENTITY.XenoDialog state
- Add popup about problems when NW.js is outdated
- Add mod compatibility checks for remote servers
- Add blackout effect when switching maps

### Fixed

- Fix remote state not being collected sometimes (leaving unkilled projectiles)
- Fix two setInteval run loops running when using crossnode
- Fix socket memory leaks after server close
- Improved compatibility with nax-ccuilib
- Fix map crash recovery
- Fix crash loop after getting near ig.ENTITY.XenoDialog on a second map
- Fix triblader and hexacast remote attack circle glow missing
- Fix combatant party api not creating new parties after reaching party value 10

## [0.5.6] 2025-10-31

### Added 

- Add map, area and landmark remote state
- Add ig.ENTITY.DynamicPlatform remote state
- Add ig.ENTITY.NPC remote state
- Implement ig.ENTITY.Enemy.create
- Add ig.ENTITY.ItemDestruct remote state
- Set player collision to ig.COLLTYPE.NONE when in cutscene

### Fixed

- Fix server crash when remote player unequips armor
- Fix player invalid player on map location offset when on different maps
- Fix player ghosts sometimes remaining on remote clients when a different player switches a map
- Fix remote crash when an enemy shoots any projectile
- Fix current player floor not getting set in map menu
- Sync ig.ENTITY.Switch position remote state
- Fix remote crash after teleporting with ig.ENTITY.TeleportField
- Fix player sometimes being stuck in a cutscene after teleporting
- Fix server crash after getting a circuit point
- Fix server crash when effect has rotateFace: 16
- Fix server crash on events with ig.Action data
- Fix ig.ENTITY.ConditionalLight
- Unregister dummy.PlayerModel from ig.Vars#varAccessors on entity kill
- Fix remote crash on Mjolnir
- Fix remote crash when sc.CombatProxyEntity gets killed faster on remote client
- Fix remote quick respawn effect
- Fix remote sc.NPCRunnerEntity not getting simulated
- Fix ig.ENTITY.Combatant old hp bars not getting detached when switching to a new map
- Fix ig.ENTITY.Enemy netid overlaps
- Fix server crash ig.ENTITY.Combatant has hp higher than u10
- Fix server crash when using the training area panel to spawn enemies

## [0.5.5] 2025-10-29

### Added

- Add character model state for remote server

## [0.5.4] 2025-10-29

### Fixed

- Fix some options weirdness by linking base instance sc.OptionModel to server and map sc.OptionModel
- Fix some music weirdness by linking base instance ig.Music to server and map ig.Music
- Update base instance music volume after stopping server
- Fix crash when enemy drops item and player quickly leaves map
- Direct enemy drops to the player that finished it off
- Fix npc runners spawn rate multiplying with the number of clients on a map
- Make newly spawned client marker the same as the player that issued the spawn
- Fix rare remote server crash on ig.ENTITY.Ball despawn

## [0.5.3] 2025-10-29
## [0.5.2] 2025-10-29
## [0.5.1] 2025-10-04
## [0.5.0] 2025-10-04
