import type { GlobalStateHandler } from './global-state-handlers'
import type { GlobalStateKey } from './global-state-handlers'
import { StateMemory } from './state-util'
import type { AreaName } from '../net/binary/binary-types'
import { fromCamel } from '../misc/from-camel'

declare global {
    interface GlobalStateUpdatePacket {
        areas?: PartialRecord<AreaName, /* landmarks */ PartialRecord<string, boolean>>
    }
}

let areaObj: Record<string, Record<string, true>> | undefined
const areaStateMemory: StateMemory.MapHolder<GlobalStateKey> = {}
export const areasGlobalStateHandler: GlobalStateHandler = {
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
}
