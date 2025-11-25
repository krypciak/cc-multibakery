import { prestart } from '../loading-stages'
import { addStateHandler, StateKey } from './states'
import { StateMemory } from './state-util'
import { AreaName } from '../net/binary/binary-types'

type AreasObj = Record<AreaName, /* landmarks */ Record<string, true>>

declare global {
    interface StateUpdatePacket {
        areas?: AreasObj
    }
    namespace ig {
        var areasStatePlayerMemory: StateMemory.MapHolder<StateKey> | undefined
    }
}

function fromCamel(str: string) {
    return str.replace(/[A-Z]/g, a => '-' + a.toLowerCase())
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            if (packet.areas) return

            ig.areasStatePlayerMemory ??= {}
            const memory = StateMemory.getBy(ig.areasStatePlayerMemory, client)

            const obj: AreasObj = Object.fromEntries(
                Object.keys(sc.map.areasVisited)
                    .map(fromCamel)
                    .map(areaName => [
                        areaName,
                        Object.fromEntries(
                            Object.entries(sc.map.activeLandmarks[areaName] ?? {})
                                .filter(([_, v]) => v.active)
                                .map(([k]) => [k, true])
                        ),
                    ])
            )
            packet.areas = memory.diffRecord2Deep(obj)
        },
        set(packet) {
            if (!packet.areas) return

            for (const areaName in packet.areas) {
                sc.map.areasVisited[areaName.toCamel()] ??= {}
                const landmarks = packet.areas[areaName]
                for (const landmarkName in landmarks) {
                    ;((sc.map.activeLandmarks[areaName] ??= {})[landmarkName] ??= { active: true }).active = true
                }
            }
        },
    })
})
