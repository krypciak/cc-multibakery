import { prestart } from '../loading-stages'
import { Opts } from '../options'
import { DummyBoxGuiConfig } from './dummy-box-addon'

const dummyBoxGuiConfigUsername: DummyBoxGuiConfig = {
    yPriority: 0,

    textGetter: player => player.data.username,
    condition: player => !ig.client || !Opts.hideClientUsername || ig.client.username != player.data.username,
}

let stateMap: PartialRecord<sc.GAME_MODEL_SUBSTATE | -1, string>
let menuMap: PartialRecord<sc.MENU_SUBMENU | -1, string>
prestart(() => {
    stateMap = {
        [sc.GAME_MODEL_SUBSTATE.QUESTSOLVED]: '(Quests)',
        [sc.GAME_MODEL_SUBSTATE.QUICK]: '(Quick)',
        [sc.GAME_MODEL_SUBSTATE.PAUSE]: '(Pause)',
        [sc.GAME_MODEL_SUBSTATE.MENU]: '(Main)',
        [sc.GAME_MODEL_SUBSTATE.ONMAPMENU]: '(Shop)',
    }
    menuMap = {
        // [sc.MENU_SUBMENU.START]: '',
        [sc.MENU_SUBMENU.ITEMS]: '(Inventory)',
        [sc.MENU_SUBMENU.SKILLS]: '(Circuits)',
        [sc.MENU_SUBMENU.EQUIPMENT]: '(Equipment)',
        [sc.MENU_SUBMENU.STATUS]: '(Status)',
        [sc.MENU_SUBMENU.SYNOPSIS]: '(Records)',
        [sc.MENU_SUBMENU.MAP]: '(Map)',
        [sc.MENU_SUBMENU.SAVE]: '(Save)',
        [sc.MENU_SUBMENU.OPTIONS]: '(Options)',
        [sc.MENU_SUBMENU.SHOP]: '(Shop Records)',
        [sc.MENU_SUBMENU.QUESTS]: '(Quests)',
        [sc.MENU_SUBMENU.TROPHY]: '(Trohpy Records)',
        [sc.MENU_SUBMENU.LORE]: '(Lore Records)',
        [sc.MENU_SUBMENU.ENEMY]: '(Monster Fibula)',
        [sc.MENU_SUBMENU.SOCIAL]: '(Party)',
        [sc.MENU_SUBMENU.STATS]: '(Stats)',
        [sc.MENU_SUBMENU.MUSEUM]: '(Museum)',
        [sc.MENU_SUBMENU.TRADE]: '(Trade Records)',
        [sc.MENU_SUBMENU.BOTANICS]: '(Botanics)',
        [sc.MENU_SUBMENU.QUEST_HUB]: '(Quest Hub)',
        [sc.MENU_SUBMENU.ARENA]: '(Arena)',
        [sc.MENU_SUBMENU.NEW_GAME]: '(New Game)',
    }
})

function getText(player: dummy.DummyPlayer): string | undefined {
    const menu = player.data.currentMenu ?? -1
    if (menuMap[menu]) return menuMap[menu]

    const state = player.data.currentSubState ?? -1
    if (stateMap[state]) return stateMap[state]

    if (player.data.inCutscene) return '(Cutscene)'
}

const dummyBoxGuiConfigMenu: DummyBoxGuiConfig = {
    yPriority: 2,
    hideSmall: true,

    textGetter: player => getText(player)!,
    condition: player => !!getText(player),
}

declare global {
    namespace dummy {
        interface DummyPlayer {
            combatArtLabelTitle?: string
        }
    }
}

prestart(() => {
    dummy.DummyPlayer.inject({
        handleStateStart(state, input) {
            const backup = sc.options.values['combat-art-name']
            sc.options.values['combat-art-name'] = false
            this.parent(state, input)
            sc.options.values['combat-art-name'] = backup

            if (state.startState == 5) {
                const actionName = this.getChargeAction(
                    this.charging.type,
                    state.applyCharge
                ) as keyof typeof sc.PLAYER_ACTION
                if (!actionName) return

                this.combatArtLabelTitle = this.model.getCombatArtName(sc.PLAYER_ACTION[actionName]).value
            }
        },
    })
})

const dummyBoxGuiConfigCombatArt: DummyBoxGuiConfig = {
    yPriority: 1,
    hideSmall: true,
    time: 1,
    condition: player => !!player.combatArtLabelTitle,
    textGetter: player => player.combatArtLabelTitle,
    onCreate: box => box.stopRumble(),
    onRemove: player => {
        player.combatArtLabelTitle = undefined
    },
}

export const dummyBoxGuiConfigs = [dummyBoxGuiConfigUsername, dummyBoxGuiConfigMenu, dummyBoxGuiConfigCombatArt]
