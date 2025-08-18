import { prestart } from '../plugin'
import { addStateHandler, StateKey } from './states'
import { PhysicsServer } from '../server/physics/physics-server'
import { addVarModifyListener } from '../misc/var-set-event'
import { assert } from '../misc/assert'

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
        get(packet, player, cache) {
            ig.vars.everSent ??= new WeakSet()

            packet.vars ??= cache?.vars ?? ig.vars.varsChanged
            ig.vars.varsChanged = undefined

            if (!player || !ig.vars.everSent.has(player)) {
                if (player) ig.vars.everSent.add(player)

                packet.vars ??= {}
                for (const key in ig.vars.storage.map) packet.vars[`map.${key}`] = ig.vars.storage.map[key]
                for (const key in ig.vars.storage.tmp) packet.vars[`tmp.${key}`] = ig.vars.storage.tmp[key]
            }
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
            if (!(multi.server instanceof PhysicsServer) || !multi.server.httpServer) return
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
