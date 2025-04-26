import { prestart } from '../../plugin'
import { getServerListInfo, NetServerInfoRemote } from './server-info'
import './server-list-entry'

declare global {
    namespace multi.class.ServerList {
        enum SORT_ORDER {
            NAME,
        }

        var TAB_INDEXES: {
            SERVERS: number
        }

        interface List extends sc.ListTabbedPane, sc.Model.Observer {
            tabz: {
                name: string
                icon: string
                populateFunc: (
                    list: sc.ButtonListBox,
                    buttonGroup: sc.ButtonGroup,
                    sort: multi.class.ServerList.SORT_ORDER
                ) => void
            }[]
            currentSort: multi.class.ServerList.SORT_ORDER

            sortModEntries(this: this, servers: NetServerInfoRemote[], sort: multi.class.ServerList.SORT_ORDER): void
            populateServers(
                this: this,
                list: sc.ButtonListBox,
                buttonGroup: sc.ButtonGroup,
                sort: multi.class.ServerList.SORT_ORDER
            ): void
            populateListFromServers(this: this, servers: NetServerInfoRemote[], list: sc.ButtonListBox): void
            reloadEntries(this: this): void
        }
        interface ListConstructor extends ImpactClass<List> {
            new (): List
        }
        var List: ListConstructor
    }
}

prestart(() => {
    multi.class.ServerList.SORT_ORDER = {
        NAME: 0,
    } as const

    multi.class.ServerList.TAB_INDEXES = {
        SERVERS: 0,
    } as const

    multi.class.ServerList.List = sc.ListTabbedPane.extend({
        currentSort: multi.class.ServerList.SORT_ORDER.NAME,
        init() {
            this.parent(false)

            this.tabz = [
                //
                { name: 'Servers', populateFunc: this.populateServers, icon: 'mod-icon-online' },
            ]

            this.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_TOP)
            const width = 552
            const height = 240
            this.setSize(width, height)
            this.setPanelSize(width, height - 19)
            this.setPivot(width, height)

            for (let i = 0; i < this.tabz.length; i++) {
                this.addTab(this.tabz[i].name, i, {})
            }
        },
        show(_tabIndex) {
            this.parent()

            this.setTab(multi.class.ServerList.TAB_INDEXES.SERVERS, true, { skipSounds: true })
            this.rearrangeTabs()

            ig.interact.setBlockDelay(0.2)
            this.doStateTransition('DEFAULT')
            this.addObservers!()
        },
        hide() {
            this.parent()
            this.doStateTransition('HIDDEN')
            this.removeObservers!()
        },
        onTabButtonCreation(key: string, _index: number, settings) {
            const icon = this.tabz.find(tab => tab.name == key)!.icon
            const button = new sc.ItemTabbedBox.TabButton(key, icon, 85)
            button.textChild.setPos(7, 1)
            button.setPos(0, 2)
            button.setData({ type: settings.type })
            this.addChildGui(button)
            return button
        },
        onTabPressed(_button, wasSame) {
            if (!wasSame) {
                sc.BUTTON_SOUND.submit.play()
                return true
            }
        },
        onLeftRightPress() {
            sc.BUTTON_SOUND.submit.play()
            return { skipSounds: true }
        },
        onContentCreation(index, settings) {
            this.currentList && this.currentList.clear()
            this.currentGroup && this.currentGroup.clear()
            return this.parent(index, settings)
        },
        onCreateListEntries(list, buttonGroup) {
            list.clear()
            buttonGroup.clear()
            this.tabz[this.currentTabIndex].populateFunc.bind(this)(list, buttonGroup, this.currentSort)
        },
        addObservers() {
            sc.Model.addObserver(sc.menu, this)
        },
        removeObservers() {
            sc.Model.removeObserver(sc.menu, this)
        },
        modelChanged(model, message, data) {
            if (model == sc.menu) {
                if (message == sc.MENU_EVENT.SORT_LIST) {
                    const sort = ((data as sc.ButtonGui).data as any).sortType as multi.class.ServerList.SORT_ORDER
                    this.currentSort = sort
                    this.reloadEntries()
                }
            }
        },

        sortModEntries(servers, sort) {
            if (sort == multi.class.ServerList.SORT_ORDER.NAME) {
                servers.sort((a, b) => {
                    const titleA = a.details?.title ?? 'ZZZ'
                    const titleB = b.details?.title ?? 'ZZZ'
                    return titleA.localeCompare(titleB)
                })
            }
        },
        populateServers(list, _, sort) {
            const servers = getServerListInfo()
            // mods = createFuzzyFilteredModList(this.filters, mods)
            this.sortModEntries(servers, sort)
            this.populateListFromServers(servers, list)
        },
        populateListFromServers(servers, list) {
            for (let i = 0; i < servers.length; i++) {
                const server = servers[i]
                const newModEntry = new multi.class.ServerList.ListEntry(server, this.hook.size.x)
                const x = 0
                list.addButton(newModEntry, undefined, x)
            }
        },

        reloadEntries() {
            this.setTab(this.currentTabIndex, true, { skipSounds: true })
        },
    })
})
