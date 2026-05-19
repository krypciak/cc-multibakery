import { runTasks } from 'cc-instanceinator/src/inst-util'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

let broadcasting = false
export function setIsBroadcasting(value: boolean) {
    broadcasting = value
}
export function isBroadcasting(): boolean {
    return broadcasting
}
export function broadcastAcrossInstances(instances: InstanceinatorInstance[], func: () => void) {
    if (broadcasting) return
    setIsBroadcasting(true)
    runTasks(instances, func)
    setIsBroadcasting(false)
}
