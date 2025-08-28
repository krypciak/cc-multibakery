import { Opts } from '../options'
import { prestart } from '../loading-stages'

import './dummy-box-addon'

declare global {
    namespace dummy.BoxGuiAddon {
        interface Username extends dummy.BoxGuiAddon.BoxGuiAddon {}
        interface UsernameConstructor extends ImpactClass<Username> {
            new (game: ig.Game): Username
        }
        var Username: UsernameConstructor
    }
}
prestart(() => {
    dummy.BoxGuiAddon.Username = dummy.BoxGuiAddon.BoxGuiAddon.extend({
        init(game) {
            this.parent(
                'DummyUsernameGui',
                game,
                player => {
                    return player.data.username
                },
                player => {
                    if (!ig.client) return true
                    if (!Opts.hideClientUsername) return true
                    return ig.client.player.username != player.data.username
                }
            )
        },
    })
}, 3)

declare global {
    namespace dummy.BoxGuiAddon {
        interface Menu extends dummy.BoxGuiAddon.BoxGuiAddon {}
        interface MenuConstructor extends ImpactClass<Menu> {
            new (game: ig.Game): Menu
        }
        var Menu: MenuConstructor
    }
}
prestart(() => {
    dummy.BoxGuiAddon.Menu = dummy.BoxGuiAddon.BoxGuiAddon.extend({
        init(game) {
            const stateMap: PartialRecord<sc.GAME_MODEL_SUBSTATE | -1, string> = {
                [sc.GAME_MODEL_SUBSTATE.QUESTSOLVED]: '(Quests)',
                [sc.GAME_MODEL_SUBSTATE.QUICK]: '(Quick)',
                [sc.GAME_MODEL_SUBSTATE.PAUSE]: '(Pause)',
                [sc.GAME_MODEL_SUBSTATE.MENU]: '(Main)',
                [sc.GAME_MODEL_SUBSTATE.ONMAPMENU]: '(Shop)',
            }
            const menuMap: PartialRecord<sc.MENU_SUBMENU | -1, string> = {
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

            const getText = (player: dummy.DummyPlayer): string | undefined => {
                const menu = player.data.currentMenu ?? -1
                if (menuMap[menu]) return menuMap[menu]

                const state = player.data.currentSubState ?? -1
                if (stateMap[state]) return stateMap[state]

                if (player.data.inCutscene) return '(Cutscene)'
            }
            this.parent(
                'DummyMenuGui',
                game,
                player => getText(player)!,
                player => !!getText(player),
                undefined,
                undefined,
                11,
                true
            )
        },
    })
}, 3)
