import { prestart } from '../loading-stages'
import { addGlobalStateHandler, addStateHandler, type GlobalStateKey, type StateKey } from './states'
import { addVarModifyListener } from '../misc/var-set-event'
import { assert } from '../misc/assert'
import { shouldCollectStateData } from './state-util'
import type { RecordSize, u16 } from 'ts-binarifier/src/type-aliases'
import { runTaskInMapInst } from '../client/client'
import { runTasks } from 'cc-instanceinator/src/inst-util'
import type { MapName } from '../net/binary/binary-types'
import { fromCamel } from '../misc/from-camel'

type VarObj = Record<string, unknown> & RecordSize<u16>

declare global {
    interface StateUpdatePacket {
        vars?: VarObj
    }
    interface GlobalStateUpdatePacket {
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
            if (value instanceof ig.Class) continue
            flattenRecursive(value as any, newPath, into)
        } else if (typeof value !== 'function') {
            into[newPath] = value
        }
    }
}

function extractMapNameOutOfMapsVar(path: string): MapName {
    let map = path.substring(5)
    const index = map.indexOf('.')
    map = map.substring(0, index == -1 ? undefined : index)
    return fromCamel(map)
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            ig.vars.everSent ??= new WeakSet()

            packet.vars = ig.vars.varsChanged

            if (!client || !ig.vars.everSent.has(client)) {
                if (client) ig.vars.everSent.add(client)

                packet.vars ??= {}
                flattenRecursive(ig.vars.storage.tmp, 'tmp', packet.vars)
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

    const globalEverSent = new WeakSet<GlobalStateKey>()
    let globalVarsChanged: VarObj | undefined = undefined

    addGlobalStateHandler({
        get(packet, conn) {
            packet.vars = globalVarsChanged

            if (!globalEverSent.has(conn)) {
                globalEverSent.add(conn)

                packet.vars ??= {}
                flattenRecursive(ig.vars.storage.menu ?? {}, 'menu', packet.vars)

                for (const map in ig.vars.storage.maps) packet.vars[`maps.${map}`] ??= {}
                flattenRecursive(ig.vars.storage.maps ?? {}, 'maps', packet.vars)
            }
        },
        clear() {
            globalVarsChanged = undefined
        },
        set(packet) {
            if (!packet.vars) return

            const mapsToNotify = new Set<MapName>()
            for (const path in packet.vars) {
                const value = packet.vars[path]

                const obj = ig.vars._getAccessObject(path)
                assert(obj)
                obj.obj[obj.key] = value
                if (path.startsWith('maps')) {
                    mapsToNotify.add(extractMapNameOutOfMapsVar(path))
                }
            }
            runTasks(
                [...mapsToNotify]
                    .map(mapName => multi.server.maps.get(mapName))
                    .filter(Boolean)
                    .map(map => map!.inst),
                () => ig.game.varsChangedDeferred()
            )
        },
    })

    if (PHYSICSNET) {
        addVarModifyListener((path, newValue) => {
            if (
                !shouldCollectStateData() ||
                newValue instanceof ig.Class ||
                (Array.isArray(newValue) && newValue.some(v => v instanceof ig.Class))
            )
                return

            if (path.startsWith('map.')) {
                path = 'maps.' + ig.vars.currentLevelName + path.substring(3)
            }
            if (path.startsWith('maps.') || path.startsWith('menu.')) {
                globalVarsChanged ??= {}
                globalVarsChanged[path] = newValue
            } else if (path.startsWith('tmp.')) {
                runTaskInMapInst(() => {
                    ig.vars.varsChanged ??= {}
                    ig.vars.varsChanged[path] = newValue
                })
            }
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
