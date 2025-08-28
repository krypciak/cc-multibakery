import { poststart, prestart } from '../../loading-stages'
import Multibakery from '../../plugin'

import './title-screen-button'
import './server-list-list'

declare global {
    namespace sc {
        enum MENU_SUBMENU {
            MULTIBAKERY_LOGIN,
        }
    }
    namespace multi.class.ServerList {
        interface Menu extends sc.ListInfoMenu {
            accountButton: sc.ButtonGui

            initSortMenu(this: this): void
            initAccountButton(this: this): void
            onBackButtonPress(this: this): void
        }
        interface MenuConstructor extends ImpactClass<Menu> {
            new (): Menu
        }
        var Menu: MenuConstructor
    }
    namespace sc {
        var serverListMenu: multi.class.ServerList.Menu
    }
}
const menuId = 'multibakery_login'
prestart(() => {
    if (!REMOTE) return

    multi.class.ServerList = {} as any

    multi.class.ServerList.Menu = sc.ListInfoMenu.extend({
        init() {
            sc.serverListMenu = this
            this.parent(new multi.class.ServerList.List())

            this.list.setPos(9, 23)

            this.initSortMenu()
            this.initAccountButton()
        },
        initSortMenu() {
            this.sortMenu.addButton('name', modmanager.gui.MENU_SORT_ORDER.NAME, modmanager.gui.MENU_SORT_ORDER.NAME)
        },
        initAccountButton() {
            this.accountButton = new sc.ButtonGui('\\i[help2]' + 'Account', undefined, true, sc.BUTTON_TYPE.SMALL)
            this.accountButton.keepMouseFocus = true
            this.accountButton.hook.transitions = {
                DEFAULT: { state: {}, time: 0.2, timeFunction: KEY_SPLINES.EASE },
                HIDDEN: {
                    state: { offsetY: -this.accountButton.hook.size.y },
                    time: 0.2,
                    timeFunction: KEY_SPLINES.LINEAR,
                },
            }
            this.accountButton.onButtonPress = () => {
                const tab = 1
                modmanager.openModOptionsMenu(Multibakery.manifset.id, tab)
            }
        },
        commitHotKeysToTopBar(longTransition) {
            sc.menu.addHotkey(() => this.accountButton)
            this.parent(longTransition)
        },
        onAddHotkeys() {
            sc.menu.buttonInteract.addGlobalButton(this.accountButton, () => sc.control.menuHotkeyHelp2())
            this.parent()
        },
        showMenu(_previousMenu, prevSubmenu) {
            this.parent()
            if (prevSubmenu != sc.MENU_SUBMENU.START) sc.menu.popBackCallback()
        },
        hideMenu() {
            this.parent()
            sc.menu.moveLeaSprite(0, 0, sc.MENU_LEA_STATE.LARGE)
            this.exitMenu()
            sc.menu.buttonInteract.removeGlobalButton(this.accountButton)
        },
        onBackButtonPress() {
            sc.menu.popBackCallback()
            sc.menu.popMenu()
        },
        createHelpGui() {
            if (!this.helpGui) {
                this.helpGui = new sc.HelpScreen(
                    this,
                    'hi',
                    [
                        {
                            title: 'hi',
                            content: ['hi'],
                        },
                    ],
                    () => {
                        this.showMenu()
                        sc.menu.popBackCallback()
                        sc.menu.popBackCallback()
                    },
                    true
                )
                this.helpGui.hook.zIndex = 15e4
                this.helpGui.hook.pauseGui = true
            }
        },
    })

    // @ts-expect-error
    sc.MENU_SUBMENU.MULTIBAKERY_LOGIN = Math.max(...Object.values(sc.MENU_SUBMENU)) + 1

    sc.SUB_MENU_INFO[sc.MENU_SUBMENU.MULTIBAKERY_LOGIN] = {
        Clazz: multi.class.ServerList.Menu,
        name: menuId,
    }
}, 10)

poststart(() => {
    if (!REMOTE) return
    ig.lang.labels.sc.gui.menu['menu-titles'][menuId] = 'Server list'
})
