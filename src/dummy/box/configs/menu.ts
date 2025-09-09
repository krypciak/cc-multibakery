import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig } from '../configs'

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

addDummyBoxGuiConfig({
    yPriority: 10,
    hideSmall: true,

    textGetter: player => getText(player)!,
    condition: player => !!getText(player),
})
