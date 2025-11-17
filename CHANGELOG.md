<!-- markdownlint-disable MD013 MD024 -->

# Change Log

## [Unreleased]
## [0.5.9] 2025-11-14

### Added

- Add ig.ACTION_STEP remote state (fixes missing combat sounds, zooms, blurs)
- Add cc-variable-charge-time support

### Fixed

- Fix remote sc.CombatProxyEntity not sharing animation state
- Fix ig.ENTITY.ObjectLayerView being invisible
- Fix no sound playing on client when the map instance is hidden
- Fix error when creating a client in the "Manage server" menu and copyNewPlayerStats is on

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
