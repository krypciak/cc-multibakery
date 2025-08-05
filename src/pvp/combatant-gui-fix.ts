import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { OnLinkChange } from '../server/ccmap/ccmap'

declare global {
    namespace ig.ENTITY {
        interface Combatant {
            statusGuis: Record<string, ig.GUI.StatusBar>
            onPlayerEnterLeave?: OnLinkChange
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

            const createGui = () => {
                const gui = new ig.GUI.StatusBar(this)
                ig.gui.addGuiElement(gui)
                this.statusGuis[instanceinator.id] = gui
            }

            this.statusGuis = {}
            map.forEachPlayerInst(() => createGui())
            this.statusGuis[instanceinator.id] = this.statusGui

            const self = this
            this.onPlayerEnterLeave = {
                onLink(client) {
                    const prevId = instanceinator.id
                    client.inst.apply()

                    createGui()

                    instanceinator.instances[prevId].apply()
                },
                onDestroy(client) {
                    const id = client.inst.id
                    self.statusGuis[id].remove()
                    delete self.statusGuis[id]
                },
            }
            map.onLinkChange.push(this.onPlayerEnterLeave)

            this.statusGui = new Proxy(this.statusGui, {
                get(target, p, _receiver) {
                    const key = p as keyof ig.GUI.StatusBar
                    const obj = target[key]

                    if (typeof obj == 'function') {
                        return function (...args: unknown[]) {
                            let ret: unknown
                            for (const gui of Object.values(self.statusGuis)) {
                                const func = gui[key] as Function
                                assert(typeof func === 'function' && func)
                                ret = func.call(gui, ...args)
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
        hide() {
            this.parent()
            if (!multi.server || !this.onPlayerEnterLeave) return

            const map = ig.ccmap
            assert(map)
            map.onLinkChange.erase(this.onPlayerEnterLeave)
        },
    })
})
