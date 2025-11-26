import { COLOR, wrapColor } from '../misc/wrap-color'
import { poststart, prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { MULTI_PARTY_EVENT, MultiParty, PlayerInfoEntry } from './party'
import { runEventSteps } from '../state/event-steps'
import { Username } from '../net/binary/binary-types'

declare global {
    namespace sc {
        enum PARTY_MEMBER_TYPE {
            MULTIPLAYERS,
        }
        interface SocialMenu {
            optionsMultiPlayers?: sc.SortMenu
        }
        interface SocialList {
            statusText: sc.TextGui
        }
        interface SocialBaseInfoBox {
            show(this: this, modelName: string | PlayerInfoEntry, model: sc.PartyMemberModel | sc.PlayerModel): void
        }
    }
}
prestart(() => {
    // @ts-expect-error
    sc.PARTY_MEMBER_TYPE.MULTIPLAYERS = Math.max(...(Object.values(sc.PARTY_MEMBER_TYPE) as number[])) + 1
})

type Func<T> = (
    clickedPlayerInfo: PlayerInfoEntry,
    ownPlayerInfo: PlayerInfoEntry,
    clickedParty: MultiParty,
    ownParty: MultiParty
) => T

const popupConfigs: {
    id: string
    title: string
    description: string
    condition: Func<boolean>
    enabled?: Func<boolean>
    execute: Func<void>
}[] = [
    {
        id: 'leaveParty',
        title: 'Leave party',
        description: '',
        condition(clickedPlayerInfo, ownPlayerInfo) {
            return clickedPlayerInfo.username == ownPlayerInfo.username
        },
        enabled(_clickedPlayerInfo, ownPlayerInfo, _clickedParty, ownParty) {
            return ownParty.owner != ownPlayerInfo.username
        },
        execute(clickedPlayerInfo) {
            multi.server.party.leaveCurrentParty(clickedPlayerInfo.username)
        },
    },
    {
        id: 'changePartyName',
        title: 'Change party name',
        description: '',
        condition(clickedPlayerInfo, ownPlayerInfo, _clickedParty, ownParty) {
            return clickedPlayerInfo.username == ownPlayerInfo.username && ownParty.owner == ownPlayerInfo.username
        },
        execute(_clickedPlayerInfo, _ownPlayerInfo, clickedParty) {
            runEventSteps(
                [
                    {
                        type: 'SHOW_INPUT_DIALOG',
                        title: 'Party name',
                        initialValue: clickedParty.title,
                        validFunction: multi.server.party.isPartyTitleValid,
                        onAcceptFunction(newTitle) {
                            multi.server.party.changePartyTitle(clickedParty, newTitle)
                        },
                    },
                ],
                ig.EventRunType.BLOCKING
            )
        },
    },
    {
        id: 'invitePlayer',
        title: 'Invite',
        description: '',
        condition(clickedPlayerInfo, _ownPlayerInfo, _clickedParty, ownParty) {
            return !ownParty.players.includes(clickedPlayerInfo.username)
        },
        execute(clickedPlayerInfo, _ownPlayerInfo, _clickedParty, ownParty) {
            multi.server.party.invitePlayerTo(clickedPlayerInfo.username, ownParty)
        },
    },
    {
        id: 'kickPlayer',
        title: 'Kick from party',
        description: '',
        condition(clickedPlayerInfo, ownPlayerInfo, _clickedParty, ownParty) {
            return (
                ownPlayerInfo.username != clickedPlayerInfo.username &&
                ownParty.players.includes(clickedPlayerInfo.username)
            )
        },
        execute(clickedPlayerInfo) {
            multi.server.party.leaveCurrentParty(clickedPlayerInfo.username)
        },
    },
]

prestart(() => {
    function changeTabIndex(this: sc.SocialList, from: number, to: number) {
        this.tabArray[to] = this.tabArray[from]
        this.keys[to] = this.keys[from]
        const gui = this.tabGroup.elements[from][0]
        this.tabGroup.removeFocusGui(from, 0)

        this.tabGroup.addFocusGui(gui, to, 0)
    }
    sc.SocialList.inject({
        init() {
            this.parent()
            if (!multi.server) return

            this.statusText = this.bg.hook.children.find(
                c => c.gui instanceof sc.TextGui && c.gui.text == ig.lang.get('sc.gui.menu.social.status')
            )!.gui as sc.TextGui

            changeTabIndex.call(this, 1, 2)
            changeTabIndex.call(this, 0, 1)

            const id = 'multiplayers'
            this.addTab(id, 0, {
                type: sc.PARTY_MEMBER_TYPE.MULTIPLAYERS,
            })

            const tab = this.tabs[id]
            tab.icon = this.tabs['contacts'].icon

            this.currentTabIndex = 0
            this.tabGroup.setCurrentFocus(0, 0)
            tab.setPressed(true)
            this._prevPressed = tab
            this.rearrangeTabs()
        },
        onTabChanged(newIndex, prevIndex) {
            this.parent(newIndex, prevIndex)
            if (!multi.server) return

            if (this.currentTabIndex == 0) {
                this.statusText.setText('PARTY')
                this.statusText.setPos(40, -8)
            } else {
                this.statusText.setText(ig.lang.get('sc.gui.menu.social.status'))
                this.statusText.setPos(37, -8)
            }
        },
        onCreateListEntries(list, buttonGroup, type, sort) {
            if (!multi.server || type <= sc.PARTY_MEMBER_TYPE.FRIEND) return this.parent(list, buttonGroup, type, sort)

            list.clear()
            buttonGroup.clear()
            const playerList = multi.server.party.getPlayerInfoList()
            for (const playerInfo of playerList) {
                const button = new multi.class.SocialEntryButton(playerInfo)
                list.addButton(button)
            }
        },
    })

    function createOnExecute(action: (index: number) => void) {
        return function (this: sc.SocialMenu, button: sc.ButtonGui) {
            this._keepButtonFocused?.unPressButton()
            this._keepButtonFocused = null

            this.options.hideSortMenu()
            this.optionsContacts.hideSortMenu()
            this.optionsMultiPlayers?.hideSortMenu()

            const index: number = (button.data as any).sortType
            action(index)

            ig.interact.setBlockDelay(0.2)
            this.onOptionsBack()
        }
    }

    sc.SocialMenu.inject({
        init() {
            this.parent()
            if (!multi.server) return
        },
        addObservers() {
            this.parent()
            if (!multi.server) return
            sc.Model.addObserver(multi.server.party, this)
        },
        removeObservers() {
            this.parent()
            if (!multi.server) return
            sc.Model.removeObserver(multi.server.party, this)
        },
        modelChanged(model, message, data) {
            this.parent(model, message, data)
            if (!multi.server) return
            if (model == sc.menu) {
                if (message == sc.MENU_EVENT.SYNO_CHANGED_TAB) {
                    if (this.list.currentTabIndex <= 1) this.info.show()
                    else this.info.hide()

                    this.optionsMultiPlayers?.hideSortMenu()
                }
            } else if (model == multi.server.party) {
                if (message != MULTI_PARTY_EVENT.LEAVE) {
                    this.list.tabContent[0] = this.list.onContentCreation()
                    this.optionsMultiPlayers?.hideSortMenu()
                    this.party.updatePartyMembers()
                }
            }
        },
        exitMenu() {
            this.parent()
            this.optionsMultiPlayers?.hideSortMenu()
        },
        openOptionsMenu(button, isNotFriend) {
            if (!multi.server || this.list.currentTabIndex != 0) return this.parent(button, isNotFriend)

            assert(button instanceof multi.class.SocialEntryButton)
            const clickedPlayerInfo = button.playerInfo
            const clickedParty = multi.server.party.getPartyOfUsername(clickedPlayerInfo.username)

            assert(ig.client)
            const ownPlayerInfo = multi.server.party.getPlayerInfoOf(ig.client.username)
            const ownParty = multi.server.party.getPartyOfUsername(ig.client.username)

            const filteredConfigs = popupConfigs.filter(config =>
                config.condition(clickedPlayerInfo, ownPlayerInfo, clickedParty, ownParty)
            )
            const onExecute = createOnExecute(index => {
                filteredConfigs[index].execute(clickedPlayerInfo, ownPlayerInfo, clickedParty, ownParty)
            })

            const menu = (this.optionsMultiPlayers = new sc.SortMenu(
                onExecute.bind(this),
                this.onOptionsBack.bind(this),
                126
            ))
            menu.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_TOP)
            menu.setPivot(menu.hook.size.x / 2, 0)
            ig.gui.addGuiElement(menu)

            for (let i = 0; i < filteredConfigs.length; i++) {
                const config = filteredConfigs[i]
                menu.addButton(config.id, i, i)
                const active = config.enabled?.(clickedPlayerInfo, ownPlayerInfo, clickedParty, ownParty) ?? true
                menu.buttons[i].setActive(active)
            }

            this.hotkeySort.setActive(false)

            const origScreenCords = button.hook.screenCoords!
            const ortMenuX: number = origScreenCords.x
            let sortMenuY = origScreenCords.y + origScreenCords.h - 2
            if (sortMenuY + menu.hook.size.y > ig.system.height - 26) {
                sortMenuY = origScreenCords.y - menu.hook.size.y + 1
                menu.setPivot(menu.hook.size.x / 2, menu.hook.size.y)
            } else {
                menu.setPivot(menu.hook.size.x / 2, 0)
            }

            // if (!sc.model.player.getCore(sc.PLAYER_CORE.MENU_SOCIAL_INVITE)) {
            //     inviteActive = contactActive = false
            // }

            // sc.party.currentParty.length >= sc.PARTY_MAX_MEMBERS

            button.keepButtonPressed()
            this._keepButtonFocused = button
            menu.showSortMenuAt(ortMenuX, sortMenuY)
        },
    })
})
poststart(() => {
    ig.lang.labels.sc.gui.menu.social.tabs.multiplayers = 'Players'

    function setSort(id: string, title: string, des: string) {
        ig.lang.labels.sc.gui.menu.sort[id] = title
        ig.lang.labels.sc.gui.menu.sort.des[id] = des
    }
    for (const { id, title, description } of popupConfigs) {
        setSort(id, title, description)
    }
})

declare global {
    namespace multi.class {
        interface SocialEntryButton extends sc.SocialEntryButton {
            playerInfo: PlayerInfoEntry
            partyText: sc.TextGui
        }
        interface SocialEntryButtonConstructor extends ImpactClass<SocialEntryButton> {
            new (playerInfo: PlayerInfoEntry): SocialEntryButton
        }
        var SocialEntryButton: SocialEntryButtonConstructor
    }
}
prestart(() => {
    multi.class.SocialEntryButton = sc.SocialEntryButton.extend({
        init(playerInfo) {
            this.playerInfo = playerInfo
            const model = sc.party.models[playerInfo.character]
            this.parent(playerInfo.character, model)
            this.button.setText(playerInfo.username, true)
            this.level.setNumber(playerInfo.stats.level)
            this.head.active = true

            this.removeChildGui(this.status)
            const buttonWidth = 187 + this.status.hook.size.x
            const lineWidth = 73 - this.status.hook.size.x

            this._width = buttonWidth
            this.setSize(buttonWidth + lineWidth, sc.BUTTON_TYPE.ITEM.height)
            this.button.setWidth(buttonWidth)

            const party = multi.server.party.getPartyOfUsername(playerInfo.username)
            this.partyText = new sc.TextGui(wrapColor(party.title, COLOR.YELLOW), { font: sc.fontsystem.smallFont })
            this.partyText.setPos(this.hook.size.x - this.button.hook.size.x + 8, 2)
            this.partyText.setAlign(ig.GUI_ALIGN_X.RIGHT, ig.GUI_ALIGN_Y.TOP)
            this.addChildGui(this.partyText)
        },
        updateMemberStatus() {},
    })
})

prestart(() => {
    sc.SocialList.inject({
        onListEntrySelected(button) {
            if (!(button instanceof multi.class.SocialEntryButton)) return this.parent(button)
            sc.menu.setSynopInfo(button.playerInfo)
        },
    })
    sc.SocialInfoBox.inject({
        setCharacter(id) {
            if (!id || typeof id == 'string') return this.parent(id)
            const playerInfo = id as PlayerInfoEntry
            const { character, username } = playerInfo
            const { maxhp, attack, defense, focus } = playerInfo.stats

            const model = sc.party.models[character]
            this.base.show(playerInfo, model)
            this.clazz.setText(ig.lang.get(`sc.gui.menu.social.classes.${model.clazz}`))
            this.name.setText(username)
            this.baseHp.setNumber(maxhp, true)
            this.baseAttack.setNumber(attack, true)
            this.baseDefense.setNumber(defense, true)
            this.baseFocus.setNumber(focus, true)
            this.equip.removeAllChildren()

            const equipEntries = Object.entriesT(playerInfo.equip)
            for (let i = 0, y = -3; i < equipEntries.length; i++) {
                const [bodyPart, item] = equipEntries[i]
                if (item == -1) continue
                y = this.createEquipEntry(item, y, bodyPart)
            }
            this.content.doStateTransition('DEFAULT', true)
            this.noEntry.doStateTransition('HIDDEN', true)
        },
    })
    sc.SocialBaseInfoBox.inject({
        show(modelName, model) {
            if (!modelName || typeof modelName == 'string') return this.parent(modelName, model)
            const playerInfo = modelName as PlayerInfoEntry
            const { level, exp, hp, maxhp, sp, spLevel } = playerInfo.stats

            this.face.setCharacter(model.defaultExpression)
            this.name.setText(playerInfo.username)
            this.level.setNumber(level)

            this.exp.currentValue = this.exp.targetValue = exp
            this.exp.maxValue = sc.EXP_PER_LEVEL
            this.exp.currentNumber.setNumber(exp, true)
            this.exp.maxNumber.setNumber(this.exp.maxValue, true)

            this.hp.currentValue = this.hp.targetValue = hp
            this.hp.maxValue = maxhp
            this.hp.currentNumber.setNumber(hp, true)
            this.hp.maxNumber.setNumber(maxhp, true)

            this.sp.currentNumber.setNumber(Math.floor(sp), true)
            this.sp.maxNumber.setNumber(spLevel, true)

            this.doStateTransition('DEFAULT', true)
        },
    })
})

declare global {
    namespace sc {
        interface SocialPartyBox {
            scrollContainer: sc.ScrollPane
            scrollContent: ig.GuiElementBase
            thisFramePartyMembersUpdated: boolean

            createEntry(
                this: this,
                username: Username,
                y: number,
                isFirst: boolean,
                skipTransition?: Nullable<boolean>
            ): number
            updateScroll(this: this, y: number): void
        }
    }
}
prestart(() => {
    sc.SocialPartyBox.inject({
        init() {
            this.parent()
            if (!multi.server) return

            this.scrollContainer = new sc.ScrollPane(sc.ScrollType.Y_ONLY)
            this.scrollContainer.hook.transitions = {
                DEFAULT: { state: {}, time: 0.2, timeFunction: KEY_SPLINES.EASE },
                HIDDEN: { state: { alpha: 0, scaleX: 0.2, scaleY: 0.2 }, time: 0.2, timeFunction: KEY_SPLINES.LINEAR },
            }
            this.scrollContainer.showTopBar = false
            this.scrollContainer.showBottomBar = false
            this.scrollContainer.setSize(this.hook.size.x, this.hook.size.y + 10)
            this.addChildGui(this.scrollContainer)

            this.scrollContent = new ig.GuiElementBase()
            this.scrollContainer.setContent(this.scrollContent)

            this.scrollContainer.scrollbarV!.hook.transitions = {
                DEFAULT: { state: {}, time: 0.2, timeFunction: KEY_SPLINES.EASE },
                HIDDEN: { state: { alpha: 0 }, time: 0.2, timeFunction: KEY_SPLINES.LINEAR },
            }
        },
        update() {
            this.parent()
            if (!multi.server) return

            this.thisFramePartyMembersUpdated = false
            if (sc.control.menuScrollUp()) {
                this.scrollContainer.scrollY(-20, false, 0.05)
            } else if (sc.control.menuScrollDown()) {
                this.scrollContainer.scrollY(20, false, 0.05)
            }
        },
        createEntry(username, y, isFirst, skipTransition) {
            const playerInfo = multi.server.party.getPlayerInfoOf(username)
            const gui = new multi.class.SocialPartyMember(isFirst, playerInfo)
            gui.setPos(0, y)
            gui.show(skipTransition)
            y += gui.hook.size.y + 3
            this.scrollContent.addChildGui(gui)
            this.members.push(gui)
            return y
        },
        updatePartyMembers() {
            if (!multi.server) return this.parent()
            if (this.thisFramePartyMembersUpdated) return
            this.thisFramePartyMembersUpdated = true

            const deleted: number[] = []
            const unchanged: Username[] = []
            let y = 0

            assert(ig.client)
            const party = multi.server.party.getPartyOfEntity(ig.client.dummy)
            const players = party.players

            for (let i = 0; i < this.members.length; i++) {
                const gui = this.members[i]
                const username: Username = gui.name!
                if (players.includes(username)) {
                    unchanged.push(username)
                    gui.doPosTranstition(0, y, 0.2)
                    y += gui.hook.size.y + 3
                } else {
                    deleted.push(i)
                    gui.doStateTransition('SCALE', false, true)
                }
            }
            for (let i = deleted.length - 1; i >= 0; i--) this.members.splice(deleted[i], 1)

            y = 35 * this.members.length + 3 * this.members.length + 9

            for (const username of players) {
                if (!unchanged.includes(username)) {
                    y = this.createEntry(username, y, false)
                }
            }
            this.members[0]?.currentValue?.setNumber(multi.server.party.sizeOf(party), true)

            this.updateScroll(y)
        },
        show(skipTransition) {
            if (!multi.server) return this.parent(skipTransition)
            this.scrollContainer?.doStateTransition('DEFAULT', skipTransition)

            assert(ig.client)
            const party = multi.server.party.getPartyOfEntity(ig.client.dummy)
            const players = party.players

            for (let i = 0; i < this.members.length; i++) {
                const memberGui = this.members[i]
                if (skipTransition && i >= 1) memberGui.hide(true)
                else memberGui.remove()
            }

            this.members = []

            let y = 0
            for (let i = 0; i < players.length; i++) {
                const username = players[i]
                y = this.createEntry(username, y, i == 0, skipTransition)
            }
            this.updateScroll(y)
        },
        updateScroll(y: number) {
            this.scrollContent.setSize(this.hook.size.x, Math.max(this.hook.size.y, y))
            this.scrollContainer.recalculateScrollBars(true)
            this.scrollContainer.scrollbarV!.doStateTransition(this.hook.size.y >= y - 3 ? 'HIDDEN' : 'DEFAULT')
        },
        hide(removeAfter) {
            this.parent(removeAfter)
            this.scrollContainer?.doStateTransition('HIDDEN')
        },
    })
})

declare global {
    namespace multi.class {
        interface SocialPartyMember extends sc.SocialPartyMember {}
        interface SocialPartyMemberConstructor extends ImpactClass<SocialPartyMember> {
            new (isFirst: boolean, playerInfo: PlayerInfoEntry): SocialPartyMember
        }
        var SocialPartyMember: SocialPartyMemberConstructor
    }
}
prestart(() => {
    multi.class.SocialPartyMember = sc.SocialPartyMember.extend({
        init(isFirst, playerInfo) {
            const model = sc.party.models[playerInfo.character]
            this.parent(isFirst, model, playerInfo.username)

            const party = multi.server.party.getPartyOfUsername(playerInfo.username)
            this.maxValue?.setMaxNumber(multi.server.party.maxPartySize)
            this.maxValue?.setNumber(multi.server.party.maxPartySize)
            this.currentValue?.setNumber(multi.server.party.sizeOf(party))

            this.info.show(playerInfo, model)
        },
    })
})
