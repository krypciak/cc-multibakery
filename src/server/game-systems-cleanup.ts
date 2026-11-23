import { removeAddons } from '../misc/game-addon-util'
import { assert } from '../misc/assert'

export function removeUnnecessarySystemsForInstance(type: 'server' | 'map') {
    if (type == 'server') assert(instanceinator.id == multi.server.inst.id)
    else if (type == 'map') assert(ig.ccmap)

    // sc.options
    // sc.lore
    // sc.trade,
    // sc.quests,
    // sc.commonEvents,
    const toRemove: ig.GameAddon[] = [
        ig.interact,
        ig.greenworks,
        sc.globalinput,
        ig.langEdit,
        sc.stats,
        sc.inputForcer,
        sc.autoControl,
        sc.quickmodel,
    ]
    if (type == 'server') {
        toRemove.push(
            ig.bgm,
            ig.camera,
            ig.rumble,
            ig.slowMotion,
            ig.mapImage,
            ig.overlay,
            ig.dreamFx,
            ig.screenBlur,
            ig.gui,
            ig.guiImage,
            ig.light,
            ig.weather,
            ig.navigation,
            ig.mapStyle,
            ig.envParticles,
            ig.mapSounds,
            sc.fontsystem,
            sc.timers,
            sc.message,
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
            sc.credits,
            sc.arena,
            sc.gamesense
        )
    }

    removeAddons(toRemove, ig.game)
}
