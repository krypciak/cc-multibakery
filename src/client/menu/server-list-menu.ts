import { poststart, prestart } from '../../loading-stages'
import Multibakery from '../../plugin'
import {
    addServerListEntry,
    moveServerEntry,
    type NetServerInfoRemote,
    removeServerListEntry,
    replaceServerEntry,
} from './server-info'
import { addTitleScreenButton } from '../../misc/title-screen-button'
import { checkNwjsVerionAndCreatePopupIfProblemsFound } from '../../misc/nwjs-version-popup'
import { DEFAULT_HTTP_PORT } from './default-server-list'

import './server-list-list'

prestart(() => {
    if (!REMOTE) return

    addTitleScreenButton({
        text: 'Server list',
        onClick() {
            openServerListMenu()
        },
    })
})

declare global {
    namespace sc {
        enum MENU_SUBMENU {
            MULTIBAKERY_LOGIN,
        }
    }
    namespace multi.class.ServerList {
        interface Menu extends sc.ListInfoMenu, sc.Model {
            list: multi.class.ServerList.List
            accountButton: sc.ButtonGui
            addEntryButton: sc.ButtonGui
            removeEntryButton: sc.ButtonGui
            editEntryButton: sc.ButtonGui
            upButton: sc.ButtonGui
            downButton: sc.ButtonGui

            initAccountButton(this: this): void
            initAddEntryButton(this: this): void
            initRemoveEntryButton(this: this): void
            initEditEntryButton(this: this): void
            initUpDownButtons(this: this): void
            getEntryList(this: this): multi.class.ServerList.ListEntry[]
            onBackButtonPress(this: this): void
            setAllVisibility(this: this, visible: boolean): void
            getCurrentlyFocusedEntryIndex(this: this): number
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

async function addServerDialog(entry?: NetServerInfoRemote): Promise<NetServerInfoRemote | undefined> {
    function getInfoFromAddress(addr: string): NetServerInfoRemote | undefined {
        if (!addr.startsWith('http://')) addr = 'http://' + addr

        let url
        try {
            url = new URL(addr)
        } catch (_) {
            return
        }
        if (url.protocol != 'http:' && url.protocol != 'https:') return

        let port = parseInt(url.port)
        if (Number.isNaN(port)) port = DEFAULT_HTTP_PORT
        let host = url.hostname

        return {
            connection: {
                type: 'socket',
                host,
                port,
            },
        }
    }

    return new Promise<NetServerInfoRemote | undefined>(resolve => {
        const dialog = new multi.class.InputFieldDialog(
            300,
            'Enter server address',
            entry ? `${entry.connection.host}:${entry.connection.port}` : '',
            [
                {
                    name: 'Ok',
                    async onPress() {
                        dialog.closeMenu()
                        const address = dialog.getText()
                        const info = getInfoFromAddress(address)
                        resolve(info)
                    },
                },
                {
                    name: 'Cancel',
                    onPress() {
                        dialog.closeMenu()
                        resolve(undefined)
                    },
                },
            ],
            text => {
                return !!getInfoFromAddress(text)
            }
        )
        dialog.openMenu()
    })
}

async function openServerListMenu() {
    const problems = await checkNwjsVerionAndCreatePopupIfProblemsFound(['win_remote_crash'])

    if (problems.includes('win_remote_crash')) return

    sc.menu.setDirectMode(true, sc.MENU_SUBMENU.MULTIBAKERY_LOGIN)
    sc.model.enterMenu(true)
}

const menuId = 'multibakery_login'
prestart(() => {
    if (!REMOTE) return

    multi.class.ServerList = {} as any

    multi.class.ServerList.Menu = sc.ListInfoMenu.extend({
        observers: [],
        init() {
            sc.serverListMenu = this
            this.parent(new multi.class.ServerList.List(), undefined, true)

            this.list.setPos(9, 23)

            this.initAccountButton()
            this.initAddEntryButton()
            this.initRemoveEntryButton()
            this.initEditEntryButton()
            this.initUpDownButtons()
        },
        addObservers() {
            sc.Model.addObserver(this, this)
        },
        removeObservers() {
            sc.Model.removeObserver(this, this)
        },
        initAccountButton() {
            this.accountButton = new sc.ButtonGui('\\i[help]' + 'Account', undefined, true, sc.BUTTON_TYPE.SMALL)
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
        initAddEntryButton() {
            this.addEntryButton = new sc.ButtonGui('\\i[help4]' + 'Add', 65, true, sc.BUTTON_TYPE.SMALL)
            this.addEntryButton.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP)
            this.addEntryButton.setPos(10, 22)
            this.addEntryButton.keepMouseFocus = true
            this.addEntryButton.onButtonPress = () => {
                addServerDialog().then(data => {
                    if (!data) return
                    addServerListEntry(data)
                    this.list.reloadEntries()
                })
            }
            this.addChildGui(this.addEntryButton)
        },
        initRemoveEntryButton() {
            this.removeEntryButton = new sc.ButtonGui('\\i[help2]' + 'Remove', 80, true, sc.BUTTON_TYPE.SMALL)
            this.removeEntryButton.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP)
            this.removeEntryButton.setPos(this.addEntryButton.hook.pos.x + this.addEntryButton.hook.size.x + 5, 22)
            this.removeEntryButton.keepMouseFocus = true
            this.removeEntryButton.onButtonPress = () => {
                const entryIndex = this.getCurrentlyFocusedEntryIndex()
                if (entryIndex == -1) return
                removeServerListEntry(entryIndex)
                this.list.reloadEntries()
            }
            this.removeEntryButton.setActive(false)
            this.addChildGui(this.removeEntryButton)
        },
        initEditEntryButton() {
            this.editEntryButton = new sc.ButtonGui('\\i[help3]' + 'Edit', 70, true, sc.BUTTON_TYPE.SMALL)
            this.editEntryButton.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP)
            this.editEntryButton.setPos(this.removeEntryButton.hook.pos.x + this.removeEntryButton.hook.size.x + 5, 22)
            this.editEntryButton.keepMouseFocus = true
            this.editEntryButton.onButtonPress = () => {
                const entryIndex = this.getCurrentlyFocusedEntryIndex()
                if (entryIndex == -1) return
                const entry = this.getEntryList()[entryIndex]

                addServerDialog(entry.serverInfo).then(data => {
                    if (!data) return
                    replaceServerEntry(entryIndex, data)
                    this.list.reloadEntries()
                })
            }
            this.editEntryButton.setActive(false)
            this.addChildGui(this.editEntryButton)
        },
        initUpDownButtons() {
            this.upButton = new sc.ButtonGui('\\i[right]' + 'Up', 50, true, sc.BUTTON_TYPE.SMALL)
            this.upButton.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP)
            this.upButton.setPos(this.editEntryButton.hook.pos.x + this.editEntryButton.hook.size.x + 5, 22)
            this.upButton.keepMouseFocus = true
            this.upButton.onButtonPress = () => {
                const entryIndex = this.getCurrentlyFocusedEntryIndex()
                if (entryIndex == -1) return
                if (moveServerEntry(entryIndex, -1)) {
                    this.list.reloadEntries()
                }
            }
            this.upButton.setActive(false)
            this.addChildGui(this.upButton)

            this.downButton = new sc.ButtonGui('\\i[left]' + 'Down', 65, true, sc.BUTTON_TYPE.SMALL)
            this.downButton.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP)
            this.downButton.setPos(this.upButton.hook.pos.x + this.upButton.hook.size.x + 5, 22)
            this.downButton.keepMouseFocus = true
            this.downButton.onButtonPress = () => {
                const entryIndex = this.getCurrentlyFocusedEntryIndex()
                if (entryIndex == -1) return
                if (moveServerEntry(entryIndex, 1)) {
                    this.list.reloadEntries()
                }
            }
            this.downButton.setActive(false)
            this.addChildGui(this.downButton)
        },
        getEntryList() {
            return this.list.currentList.buttonGroup.elements[0] as multi.class.ServerList.ListEntry[]
        },
        commitHotKeysToTopBar(longTransition) {
            sc.menu.addHotkey(() => this.accountButton)
            sc.menu.commitHotkeys(longTransition)
            // this.parent(longTransition)
        },
        onAddHotkeys() {
            sc.menu.buttonInteract.addGlobalButton(this.accountButton, () => sc.control.menuHotkeyHelp())
            sc.menu.buttonInteract.addGlobalButton(this.addEntryButton, () => sc.control.menuHotkeyHelp4())
            sc.menu.buttonInteract.addGlobalButton(this.removeEntryButton, () => sc.control.menuHotkeyHelp2())
            sc.menu.buttonInteract.addGlobalButton(this.editEntryButton, () => sc.control.menuHotkeyHelp3())
            sc.menu.buttonInteract.addGlobalButton(this.upButton, () => sc.control.rightPressed())
            sc.menu.buttonInteract.addGlobalButton(this.downButton, () => sc.control.leftPressed())
            this.parent()
        },
        showMenu(_previousMenu, prevSubmenu) {
            this.parent()
            if (prevSubmenu != sc.MENU_SUBMENU.START) sc.menu.popBackCallback()
            this.setAllVisibility(true)
        },
        hideMenu() {
            this.parent()
            sc.menu.moveLeaSprite(0, 0, sc.MENU_LEA_STATE.LARGE)
            this.exitMenu()
            this.setAllVisibility(false)

            sc.menu.buttonInteract.removeGlobalButton(this.accountButton)
            sc.menu.buttonInteract.removeGlobalButton(this.addEntryButton)
            sc.menu.buttonInteract.removeGlobalButton(this.removeEntryButton)
            sc.menu.buttonInteract.removeGlobalButton(this.editEntryButton)
            sc.menu.buttonInteract.removeGlobalButton(this.upButton)
            sc.menu.buttonInteract.removeGlobalButton(this.downButton)
        },
        setAllVisibility(visible) {
            const state = visible ? 'DEFAULT' : 'HIDDEN'

            this.addEntryButton.doStateTransition(state)
            this.removeEntryButton.doStateTransition(state)
            this.editEntryButton.doStateTransition(state)
            this.upButton.doStateTransition(state)
            this.downButton.doStateTransition(state)
        },
        onBackButtonPress() {
            sc.menu.popBackCallback()
            sc.menu.popMenu()
        },
        modelChanged(model, message, _data) {
            if (model == this) {
                let active: boolean | undefined
                if (message == modmanager.gui.MENU_MESSAGES.ENTRY_FOCUSED) {
                    active = true
                } else if (message == modmanager.gui.MENU_MESSAGES.ENTRY_UNFOCUSED) {
                    active = false
                }
                if (active !== undefined) {
                    this.removeEntryButton.setActive(active)
                    this.editEntryButton.setActive(active)
                    const index = this.getCurrentlyFocusedEntryIndex()

                    this.upButton.setActive(active && index != 0)
                    this.downButton.setActive(active && index != this.getEntryList().length - 1)
                }
            }
        },
        getCurrentlyFocusedEntryIndex() {
            return this.getEntryList().findIndex((b: ig.FocusGui) => b.focus)
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
