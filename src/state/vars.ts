import { prestart } from '../plugin'
import { addStateHandler, StateKey } from './states'
import { PhysicsServer } from '../server/physics/physics-server'
import { addVarModifyListener } from '../misc/var-set-event'
import { assert } from '../misc/assert'

type VarObj = [string, ig.VarValue]

declare global {
    interface StateUpdatePacket {
        vars?: VarObj[]
    }
    namespace ig {
        interface Vars {
            varsChanged?: VarObj[]
            everSent?: WeakSet<StateKey>
        }
    }
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            ig.vars.everSent ??= new WeakSet()
            if (!player || !ig.vars.everSent.has(player)) {
                if (player) ig.vars.everSent.add(player)

                ig.vars.varsChanged = []
                for (const key in ig.vars.storage.map)
                    ig.vars.varsChanged.push([`map.${key}`, ig.vars.storage.map[key]])
                for (const key in ig.vars.storage.tmp)
                    ig.vars.varsChanged.push([`tmp.${key}`, ig.vars.storage.tmp[key]])
            }
            packet.vars = ig.vars.varsChanged
            ig.vars.varsChanged = undefined
        },
        set(packet) {
            if (!packet.vars) return

            for (const [path, value] of packet.vars) {
                const obj = ig.vars._getAccessObject(path)
                assert(obj)
                obj.obj[obj.key] = value
            }
            ig.game.varsChangedDeferred()
        },
    })

    if (!PHYSICSNET) return

    addVarModifyListener((path, _oldPath, newValue) => {
        if (!(multi.server instanceof PhysicsServer) || !multi.server.httpServer) return
        if (!path.startsWith('map') && !path.startsWith('tmp')) return
        ig.vars.varsChanged ??= []
        ig.vars.varsChanged.push([path, newValue])
    })
})
