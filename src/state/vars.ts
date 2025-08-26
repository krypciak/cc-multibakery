import { prestart } from '../plugin'
import { addStateHandler, StateKey } from './states'
import { addVarModifyListener } from '../misc/var-set-event'
import { assert } from '../misc/assert'
import { shouldCollectStateData } from './state-util'

type VarObj = Record<string, ig.VarValue>

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

prestart(() => {
    addStateHandler({
        get(packet, player) {
            ig.vars.everSent ??= new WeakSet()

            packet.vars = ig.vars.varsChanged

            if (!player || !ig.vars.everSent.has(player)) {
                if (player) ig.vars.everSent.add(player)

                packet.vars ??= {}
                for (const key in ig.vars.storage.map) packet.vars[`map.${key}`] = ig.vars.storage.map[key]
                for (const key in ig.vars.storage.tmp) packet.vars[`tmp.${key}`] = ig.vars.storage.tmp[key]
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
            if (!path.startsWith('map') && !path.startsWith('tmp')) return
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
