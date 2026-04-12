import { removeAddons } from '../misc/game-addon-util'
import { assert } from '../misc/assert'

export function removeUnnecessarySystemsForServerInstance() {
    assert(instanceinator.id == multi.server.inst.id)
    const toRemove = [
        // sc.options
        // sc.lore
        // sc.trade,
        // sc.quests,
        // sc.commonEvents,
        ig.bgm,
        ig.camera,
        ig.rumble,
        ig.slowMotion,
        ig.gui,
        ig.guiImage,
        ig.light,
        ig.weather,
        ig.navigation,
        ig.mapStyle,
        ig.mapImage,
        ig.overlay,
        ig.dreamFx,
        ig.screenBlur,
        ig.interact,
        ig.envParticles,
        ig.mapSounds,
        ig.greenworks,
        ig.langEdit,
        sc.globalinput,
        sc.fontsystem,
        sc.timers,
        sc.stats,
        sc.autoControl,
        sc.message,
        sc.quickmodel,
        sc.map,
        sc.menu,
        sc.model,
        sc.detectors,
        sc.combat,
        sc.pvp,
        sc.enemyBooster,
        sc.gameCode,
        sc.mapInteract,
        sc.elevatorModel,
        sc.skipInteract,
        sc.npcRunner,
        sc.party,
        sc.playerSkins,
        sc.bounceSwitchGroups,
        sc.inputForcer,
        sc.credits,
        sc.arena,
        sc.gamesense,
    ]
    removeAddons(toRemove, ig.game)
}
