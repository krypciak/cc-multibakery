import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../misc/assert'
import { runTask, runTasks, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import { inputBackup as wrapInput } from '../dummy/dummy-input'
import { isPhysics } from '../server/physics/is-physics-server'
import { runTaskInMapInst } from './client'

function cloneIconHoverTextGui(subGui: sc.IconHoverTextGui): sc.IconHoverTextGui {
    let title: string | undefined
    let textGui: ig.GuiElementBase
    if (subGui.hook.children.length == 2) {
        const titleGui = subGui.hook.children[0].gui as sc.TextGui
        assert(titleGui instanceof sc.TextGui)
        title = titleGui.text!.toString()

        textGui = subGui.hook.children[1].gui as sc.TextGui
    } else {
        textGui = subGui.hook.children[0].gui as sc.TextGui
    }
    assert(textGui instanceof sc.TextGui)
    const text = textGui.text!.toString()
    const gui = new sc.IconHoverTextGui(text, textGui.hook.pos.y, subGui.showOnNear, title)
    Vec2.assign(gui.hook.pos, subGui.hook.pos)
    return gui
}

function cloneTradeIconGui(subGui: sc.TradeIconGui): sc.TradeIconGui {
    const traderObj = Object.entries(sc.trade.traders).find(([_, obj]) => obj == subGui.tradeInfo)
    assert(traderObj)
    const trader: string = traderObj[0]
    const gui = new sc.TradeIconGui(trader)
    return gui
}

function cloneXenoDialogIcon(e: sc.XenoDialogIcon): sc.XenoDialogIcon {
    const gui = new sc.XenoDialogIcon()
    scheduleTask(instanceinator.instances[instanceinator.id], () => {
        gui.setText(e.textGui.text, e.xenoDialog)
    })
    gui.show()
    return gui
}

function cloneMapInteractEntry(e: sc.MapInteractEntry): sc.MapInteractEntry {
    // TODO elevator ruining my day, it makes double icons
    const ne = new sc.MapInteractEntry(e.entity, e.handler, e.icon, e.zCondition, e.interrupting)
    ne.gui.offset = Vec2.create(e.gui.offset)

    const subGui = e.gui.subGui
    let newSubSui: typeof subGui | undefined
    if (subGui instanceof sc.IconHoverTextGui) {
        newSubSui = cloneIconHoverTextGui(subGui)
    } else if (subGui instanceof sc.TradeIconGui) {
        newSubSui = cloneTradeIconGui(subGui)
    } else if (subGui instanceof sc.XenoDialogIcon) {
        newSubSui = cloneXenoDialogIcon(subGui)
    } else if (subGui) assert(false, 'subGui type not supported ' + findClassName(subGui))

    if (newSubSui) {
        ne.setIcon(e.icon)
        ne.setState(e.state)
        ne.setSubGui(newSubSui)
    }
    return ne
}

let isBroadcasting = false
export function initMapInteractEntries(mapInst: InstanceinatorInstance) {
    isBroadcasting = true
    assert(!ig.ccmap)
    for (const entry of sc.mapInteract.entries) {
        sc.mapInteract.removeEntry(entry)
    }
    for (const entry of mapInst.sc.mapInteract.entries) {
        if (entry.gui.subGui instanceof sc.XenoDialogIcon) continue
        sc.mapInteract.addEntry(entry)
    }
    isBroadcasting = false
}

prestart(() => {
    function broadcastFunction(broadcast: () => void, func: () => void) {
        if (isBroadcasting) {
            func()
            return
        }
        isBroadcasting = true
        runTaskInMapInst(() => {
            runTasks(ig.ccmap!.getAllInstances(true), () => {
                broadcast()
            })
        })
        isBroadcasting = false
    }

    function findEntry(entry: sc.MapInteractEntry) {
        return sc.mapInteract.entries.find(a => a.entity == entry.entity)
    }

    sc.MapInteract.inject({
        addEntry(entry) {
            if (!multi.server) return this.parent(entry)
            broadcastFunction(
                () => sc.mapInteract.addEntry(entry),
                () => {
                    const newEntry = entry._instanceId == this._instanceId ? entry : cloneMapInteractEntry(entry)
                    if (newEntry) this.parent(newEntry)
                }
            )
        },
        removeEntry(entry) {
            if (!multi.server) return this.parent(entry)

            broadcastFunction(
                () => sc.mapInteract.removeEntry(entry),
                () => {
                    const newEntry = sc.mapInteract.entries.find(a => a.entity == entry.entity)
                    if (newEntry) this.parent(newEntry)
                }
            )
        },
        onPreUpdate() {
            if (!multi.server || ig.ccmap || !ig.client || !ig.client.dummy) return this.parent()
            wrapInput(ig.client.dummy.inputManager, () => this.parent())
        },
        onLevelLoadStart(data) {
            this.parent?.(data)
            for (const entry of this.entries) {
                entry.gui.remove()
            }
            this.entries = []
        },
    })

    sc.MapInteractEntry.inject({
        setIcon(icon) {
            if (!multi.server) return this.parent(icon)
            this.parent(icon)
            broadcastFunction(
                () => findEntry(this)?.setIcon(icon),
                () => this.parent(icon)
            )
        },
    })
})

prestart(() => {
    ig.ENTITY.XenoDialog.inject({
        _isInRange(range, noIgnoreZ) {
            if (!multi.server) return this.parent(range, noIgnoreZ)
            assert(ig.ccmap)
            return ig.ccmap.clients.some(client => {
                assert(!ig.game.playerEntity)
                ig.game.playerEntity = client.dummy
                const ret = this.parent(range, noIgnoreZ)
                ig.game.playerEntity = undefined as any
                return ret
            })
        },
        onEventStart() {
            runTask(instanceinator.instances[this._instanceId], () => {
                this.parent()
            })
        },
        onEventEnd() {
            runTask(instanceinator.instances[this._instanceId], () => {
                this.parent()
            })
        },
    })
    sc.XenoDialogIcon.inject({
        onSkipInteract(msg) {
            if (!isPhysics(multi.server) || ig.ccmap) return this.parent(msg)
            assert(ig.client)

            if (msg == sc.SKIP_INTERACT_MSG.SKIPPED) {
                if (this.textGui.textBlock.isFinished()) {
                    runTask(ig.client.getMap().inst, () => {
                        this.xenoDialog._showNextMessage()
                    })
                } else {
                    this.textGui.finish()
                }
            }
            this.updateSkipIcon()
        },
    })
    ig.ENTITY.NPC.inject({
        updateNpcState(...args) {
            runTask(instanceinator.instances[this._instanceId], () => {
                this.parent(...args)
            })
        },
    })
})

declare global {
    namespace sc {
        interface PushPullable {
            player?: dummy.DummyPlayer
        }
    }
}
prestart(() => {
    sc.PushPullable.inject({
        onInteraction() {
            if (!ig.client) return this.parent()
            if (this.player) return

            assert(ig.game.playerEntity instanceof dummy.DummyPlayer)
            this.player = ig.game.playerEntity
            this.parent()
        },
        onUpdate() {
            if (!multi.server) return this.parent()
            assert(ig.ccmap)
            assert(!ig.game.playerEntity)
            if (this.gripDir) assert(this.player)
            if (!this.player) return this.parent()

            wrapInput(this.player!.inputManager, () => this.parent())
        },
        onDeferredUpdate() {
            if (!multi.server) return this.parent()
            assert(ig.ccmap)
            assert(!ig.game.playerEntity)
            if (this.gripDir) assert(this.player)
            ig.game.playerEntity = this.player!
            this.parent()
            ig.game.playerEntity = undefined as any
        },
        cancelGrip() {
            this.parent()
            this.player = undefined
        },
    })
}, 1000)
