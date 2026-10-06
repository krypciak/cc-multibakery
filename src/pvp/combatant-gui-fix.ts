import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import type { OnLinkChange } from '../server/ccmap/ccmap-types'

declare global {
    namespace ig.ENTITY {
        interface Combatant extends OnLinkChange {
            statusGuis: Record<number, ig.GUI.StatusBar>

            createStatusGui(this: this): void
            removeAllStatusGuis(this: this): void
        }
    }
}

prestart(() => {
    ig.ENTITY.Combatant.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.statusGuis = {}
        },
        show(noShowFx) {
            if (!multi.server) return this.parent(noShowFx)

            const map = ig.mapShared.ccmap
            runTask(map.inst, () => {
                this.parent(noShowFx)
                this.statusGuis = {}
                this.statusGuis[instanceinator.id] = this.statusGui
                runTasks(map.getClientInstances(), () => this.createStatusGui())

                const self = this
                map.onLinkChange.push(this)

                this.statusGui = new Proxy(this.statusGui, {
                    get(target, p, _receiver) {
                        const key = p as keyof ig.GUI.StatusBar
                        const obj = target[key]

                        if (typeof obj == 'function') {
                            return function (...args: unknown[]) {
                                let ret: unknown
                                for (const [id, gui] of Object.entries(self.statusGuis)) {
                                    const func = gui[key] as Function
                                    assert(typeof func === 'function' && func)
                                    const inst = instanceinator.instances[parseInt(id)]
                                    if (!inst) return
                                    ret = runTask(inst, () => func.call(gui, ...args))
                                }
                                if (key == 'remove') {
                                    self.removeAllStatusGuis()
                                }
                                return ret
                            }
                        } else {
                            return obj
                        }
                    },
                })
            })
        },
        createStatusGui() {
            const gui = new ig.GUI.StatusBar(this)
            ig.gui.addGuiElement(gui)

            this.statusGuis[instanceinator.id]?.forceRemove()
            this.statusGuis[instanceinator.id] = gui
        },
        removeAllStatusGuis() {
            for (const id in this.statusGuis) {
                const inst = instanceinator.instances[id]
                if (!inst) continue
                const gui = this.statusGuis[id]
                runTask(inst, () => gui.remove())
            }
            this.statusGuis = {}
        },
        hide() {
            this.parent()
            if (!multi.server) return

            ig.mapShared.ccmap.onLinkChange.erase(this)
            this.removeAllStatusGuis()
        },
        onKill(levelChange) {
            this.parent(levelChange)
            if (!multi.server) return

            ig.mapShared.ccmap.onLinkChange.erase(this)
            this.removeAllStatusGuis()
        },
        onClientLink(client) {
            runTask(client.inst, () => {
                this.createStatusGui()
            })
        },
        onClientUnlink(client) {
            const id = client.inst.id
            const gui = this.statusGuis[id]
            if (gui) {
                runTask(client.inst, () => gui.forceRemove())
                delete this.statusGuis[id]
            }
        },
    })
})
