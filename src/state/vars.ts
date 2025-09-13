import { prestart } from '../loading-stages'
import { addStateHandler, StateKey } from './states'
import { addVarModifyListener } from '../misc/var-set-event'
import { assert } from '../misc/assert'
import { shouldCollectStateData } from './state-util'

type VarObj = Record<string, unknown>

declare global {
    interface StateUpdatePacket {
        vars?: VarObj
    }
    namespace ig {
        interface Vars {
            varsChanged?: VarObj
            everSent?: WeakSet<StateKey>
        }
    }
}

function flattenRecursive(obj: Record<string, unknown>, path: string, into: Record<string, unknown>): void {
    for (const key in obj) {
        const value = obj[key]
        const newPath = path + '.' + key
        if (typeof value == 'object' && value) {
            flattenRecursive(value as any, newPath, into)
        } else {
            into[newPath] = value
        }
    }
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            ig.vars.everSent ??= new WeakSet()

            packet.vars = ig.vars.varsChanged

            if (!player || !ig.vars.everSent.has(player)) {
                if (player) ig.vars.everSent.add(player)

                packet.vars ??= {}
                flattenRecursive(ig.vars.storage.map, 'map', packet.vars)
                flattenRecursive(ig.vars.storage.tmp, 'tmp', packet.vars)
                flattenRecursive(ig.vars.storage.menu ?? {}, 'menu', packet.vars)
            }
        },
        clear() {
            ig.vars.varsChanged = undefined
        },
        set(packet) {
            if (!packet.vars) return

            for (const path in packet.vars) {
                const value = packet.vars[path]

                const obj = ig.vars._getAccessObject(path)
                assert(obj)
                obj.obj[obj.key] = value
            }
            ig.game.varsChangedDeferred()
        },
    })

    if (PHYSICSNET) {
        addVarModifyListener((path, _oldPath, newValue) => {
            if (!shouldCollectStateData()) return
            if (!path.startsWith('map.') && !path.startsWith('tmp.') && !path.startsWith('menu.')) return
            ig.vars.varsChanged ??= {}
            ig.vars.varsChanged[path] = newValue
        })
    }

    if (REMOTE) {
        ig.Game.inject({
            varsChanged() {
                assert(!ig.ignoreEffectNetid)
                ig.ignoreEffectNetid = true
                this.parent()
                ig.ignoreEffectNetid = false
            },
        })
    }
})
