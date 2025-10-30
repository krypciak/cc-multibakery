<!-- markdownlint-disable MD013 MD024 -->

# Change Log

## [Unreleased]

### Added 

- Add map, area and landmark remote state
- Add ig.ENTITY.DynamicPlatform remote state

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
