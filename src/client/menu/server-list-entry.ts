import { assert } from '../../misc/assert'
import { isErrorPopupShown } from '../../misc/error-popup'
import { getServerDetailsAndPing, getServerIcon } from '../../net/web-server'
import { Opts } from '../../options'
import { prestart } from '../../loading-stages'
import { tryJoinRemote } from '../../server/remote/try-join-remote'
import { createClientJoinData, showTryNetJoinResponseDialog } from '../../server/server'
import { type NetServerInfoRemote } from './server-info'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { isModCompatibilityListSatisfied, showModCompatibilityListPopup } from '../../server/mod-compatibility-list'
import { wrapColor, COLOR } from '../../misc/wrap-color'

interface ServerImageConfig {
    pathOrData: string | HTMLImageElement
    offsetX: number
    offsetY: number
    sizeX: number
    sizeY: number
}

declare global {
    namespace multi.class.ServerList {
        export interface ListEntry extends ig.FocusGui, sc.Model.Observer {
            ninepatch: ig.NinePatch
            serverInfo: NetServerInfoRemote
            iconOffset: number
            nameIconPrefixesText: sc.TextGui
            nameText: sc.TextGui
            textColor: COLOR
            descriptionText: sc.TextGui
            versionText: sc.TextGui
            connectionText: sc.TextGui
            pingText: sc.TextGui
            highlight: modmanager.gui.ListEntryHighlight
            iconGui: ig.ImageGui
            isServerReachable: boolean

            updateDetails(this: this): void
            updateIcon(this: this): void
            getIconConfig(this: this): Promise<ServerImageConfig>
            setIcon(this: this, config: ServerImageConfig): void
            getTitleAndIcon(this: this): { icon: string; text: string }
            updateNameText(this: this, color?: COLOR): void
            updateHighlightWidth(this: this): void
            onButtonPress(this: this): Promise<void>
            updateConnectionStatus(this: this): Promise<void>
        }
        interface ListEntryConstructor extends ImpactClass<ListEntry> {
            new (serverInfo: NetServerInfoRemote, modListWidth: number): ListEntry
        }
        var ListEntry: ListEntryConstructor
    }
}

prestart(() => {
    if (!REMOTE) return

    multi.class.ServerList.ListEntry = ig.FocusGui.extend({
        ninepatch: new ig.NinePatch('media/gui/CCModManager.png', {
            width: 42,
            height: 26,
            left: 1,
            top: 14,
            right: 1,
            bottom: 0,
            offsets: { default: { x: 0, y: 0 }, focus: { x: 0, y: 41 } },
        }),

        init(serverInfo, modListWidth) {
            this.parent()
            this.serverInfo = serverInfo

            this.iconOffset = 25

            const width = modListWidth - 3
            const height = 42
            this.setSize(width, height - 3)

            this.nameText = new sc.TextGui('')
            this.nameIconPrefixesText = new sc.TextGui('')

            let connectionStr
            const connS = serverInfo.connection
            if (connS.type == 'socket') {
                connectionStr = `socket ${connS.host}:${connS.port}`
            } else assert(false, 'not implemented')

            this.connectionText = new sc.TextGui(connectionStr, {
                font: sc.fontsystem.tinyFont,
            })

            this.highlight = new modmanager.gui.ListEntryHighlight(
                this.hook.size.x,
                this.hook.size.y,
                this.nameText.hook.size.x,
                height
            )
            this.highlight.setPos(this.iconOffset, 0)
            this.addChildGui(this.highlight)
            this.addChildGui(this.nameText)
            this.addChildGui(this.nameIconPrefixesText)
            this.addChildGui(this.connectionText)

            this.descriptionText = new sc.TextGui('', {
                font: sc.fontsystem.smallFont,
                maxWidth: this.hook.size.x - 50,
                linePadding: -4,
            })
            this.descriptionText.setPos(4 + this.iconOffset, 14)
            this.addChildGui(this.descriptionText)

            this.versionText = new sc.TextGui('', { font: sc.fontsystem.tinyFont })
            this.versionText.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP)
            this.versionText.setPos(3, 3)
            this.addChildGui(this.versionText)

            this.pingText = new sc.TextGui('', { font: sc.fontsystem.tinyFont })
            this.pingText.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP)
            this.pingText.setPos(4, 11)
            this.addChildGui(this.pingText)

            this.updateNameText(COLOR.WHITE)
            this.updateHighlightWidth()

            if (serverInfo.details) this.updateDetails()
            else this.updateIcon()

            this.updateConnectionStatus()
        },
        updateDetails() {
            assert(this.serverInfo.details)
            const { modCompatibility, description } = this.serverInfo.details
            const { satisfied } = isModCompatibilityListSatisfied(modCompatibility)
            this.updateNameText()
            this.versionText.setText(satisfied ? `compatible` : `incompatible`)
            this.descriptionText.setText(description)

            this.updateIcon()
            this.updateHighlightWidth()
        },
        async updateIcon() {
            const id = instanceinator.id
            const config = await this.getIconConfig()
            runTask(instanceinator.instances[id], () => {
                this.setIcon(config)
            })
        },
        async getIconConfig() {
            if (this.serverInfo.details?.hasIcon) {
                return {
                    pathOrData: await getServerIcon(this.serverInfo.connection),
                    offsetX: 0,
                    offsetY: 0,
                    sizeX: 24,
                    sizeY: 24,
                }
            }
            return {
                pathOrData: 'media/gui/menu.png',
                offsetX: 536,
                offsetY: 160,
                sizeX: 24,
                sizeY: 24,
            }
        },
        setIcon(config) {
            if (this.iconGui) this.removeChildGui(this.iconGui)
            // @ts-expect-error
            const image = new ig.Image(config.pathOrData)
            if (typeof config.pathOrData == 'object') {
                image.data = config.pathOrData
                image.onload()
            }
            this.iconGui = new ig.ImageGui(image, config.offsetX, config.offsetY, config.sizeX, config.sizeY)
            this.iconGui.setPos(2, 8)
            this.addChildGui(this.iconGui)
        },
        getTitleAndIcon() {
            return {
                icon: '\\i[lore-others]',
                text: this.serverInfo.details?.title ?? 'Unknown',
            }
        },
        updateNameText(color?: COLOR) {
            color ??= this.textColor
            const { text, icon } = this.getTitleAndIcon()
            this.nameIconPrefixesText.setText(icon)
            this.nameIconPrefixesText.setPos(4 + this.iconOffset, 0)

            this.nameText.setFont(sc.fontsystem.font)
            this.textColor = color
            this.nameText.setText(wrapColor(text, color))
            this.nameText.setPos(4 + this.iconOffset + this.nameIconPrefixesText.hook.size.x, 0)

            this.updateHighlightWidth()
        },
        updateDrawables(renderer) {
            // if (this.modList.hook.currentStateName != 'HIDDEN') {
            this.ninepatch.draw(renderer, this.hook.size.x, this.hook.size.y, this.focus ? 'focus' : 'default')
            // }
        },
        focusGained() {
            this.parent()
            this.highlight.focus = this.focus
            sc.Model.notifyObserver(sc.serverListMenu, modmanager.gui.MENU_MESSAGES.ENTRY_FOCUSED, this)
        },
        focusLost() {
            this.parent()
            this.highlight.focus = this.focus
            sc.Model.notifyObserver(sc.serverListMenu, modmanager.gui.MENU_MESSAGES.ENTRY_UNFOCUSED, this)
        },
        updateHighlightWidth() {
            this.highlight.updateWidth(
                this.hook.size.x,
                this.nameIconPrefixesText.hook.size.x + this.nameText.hook.size.x
            )

            this.connectionText.setPos(this.nameText.hook.pos.x + this.nameText.hook.size.x + 8, 4)
        },
        async onButtonPress() {
            if (isErrorPopupShown()) return

            await this.updateConnectionStatus()
            if (!this.isServerReachable) {
                return sc.Dialogs.showErrorDialog('Unable to reach the server.')
            }
            const modCompatibilityList = this.serverInfo.details!.modCompatibility
            const { satisfied, errors } = isModCompatibilityListSatisfied(modCompatibilityList)
            if (!satisfied) {
                showModCompatibilityListPopup(errors)
                return
            }

            const username = Opts.clientLogin
            const joinData = createClientJoinData({
                username,
                initialInputType: ig.input.currentDevice,
                prefferedTpInfo: ig.client?.tpInfo,
            })
            const resp = await tryJoinRemote(this.serverInfo, joinData)
            showTryNetJoinResponseDialog(joinData, resp)
        },
        async updateConnectionStatus() {
            this.isServerReachable = false
            const obj = await getServerDetailsAndPing(this.serverInfo.connection)
            if (!obj) {
                this.updateNameText(COLOR.RED)
                return
            }
            const { details, ping } = obj
            this.serverInfo.details = details

            this.updateDetails()
            this.updateNameText(COLOR.GREEN)
            this.pingText.setText(`${ping}ms`)
            this.isServerReachable = true
        },
    })
})
