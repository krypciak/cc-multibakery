import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import { OnLinkChange } from '../server/ccmap/ccmap'

declare global {
    namespace ig.ENTITY {
        interface Combatant extends OnLinkChange {
            statusGuis: Record<number, ig.GUI.StatusBar>

            createStatusGui(this: this): void
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
            this.parent(noShowFx)
            if (!multi.server) return

            const map = ig.ccmap
            assert(map)

            this.statusGuis = {}
            runTasks(map.getAllInstances(), () => this.createStatusGui())
            this.statusGuis[instanceinator.id] = this.statusGui

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
                                self.statusGuis = {}
                            }
                            return ret
                        }
                    } else {
                        return obj
                    }
                },
            })
        },
        createStatusGui() {
            const gui = new ig.GUI.StatusBar(this)
            ig.gui.addGuiElement(gui)

            this.statusGuis[instanceinator.id]?.forceRemove()
            this.statusGuis[instanceinator.id] = gui
        },
        hide() {
            this.parent()
            if (!multi.server) return

            const map = ig.ccmap
            assert(map)
            map.onLinkChange.erase(this)
        },
        onKill(levelChange) {
            this.parent(levelChange)
            if (!multi.server) return

            const map = ig.ccmap
            assert(map)
            map.onLinkChange.erase(this)

            /* memory leak fix, does it work: probably no */
            this.statusGui = undefined as any
            this.statusGuis = {}
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
                runTask(client.inst, () => ig.gui.removeGuiElement(gui))
                gui.hide()
                delete this.statusGuis[id]
            }
        },
    })
})
