import { prestart } from '../loading-stages'
import { addGlobalStateHandler, type GlobalStateKey } from './states'
import { StateMemory } from './state-util'
import type { AreaName } from '../net/binary/binary-types'
import { fromCamel } from '../misc/from-camel'

type AreasObj = Record<AreaName, /* landmarks */ Record<string, true>>

declare global {
    interface GlobalStateUpdatePacket {
        areas?: AreasObj
    }
}

prestart(() => {
    let areaObj: AreasObj | undefined
    const areaStateMemory: StateMemory.MapHolder<GlobalStateKey> = {}
    addGlobalStateHandler({
        get(packet, conn) {
            const memory = StateMemory.getBy(areaStateMemory, conn)

            areaObj ??= Object.fromEntries(
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

            packet.areas = memory.diffRecord2Deep(areaObj)
        },
        clear() {
            areaObj = undefined
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
