import { poststart, prestart } from '../../plugin'

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
            initSortMenu(this: this): void
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
    multi.class.ServerList = {} as any

    multi.class.ServerList.Menu = sc.ListInfoMenu.extend({
        init() {
            sc.serverListMenu = this
            this.parent(new multi.class.ServerList.List())

            this.list.setPos(9, 23)

            this.initSortMenu()
        },
        initSortMenu() {
            this.sortMenu.addButton('name', modmanager.gui.MENU_SORT_ORDER.NAME, modmanager.gui.MENU_SORT_ORDER.NAME)
        },
        showMenu() {
            this.parent()
            sc.menu.pushBackCallback(() => this.onBackButtonPress())
            sc.menu.moveLeaSprite(0, 0, sc.MENU_LEA_STATE.HIDDEN)
        },
        hideMenu() {
            this.parent()
            sc.menu.moveLeaSprite(0, 0, sc.MENU_LEA_STATE.LARGE)
            this.exitMenu()
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
    ig.lang.labels.sc.gui.menu['menu-titles'][menuId] = 'Server list'
})
