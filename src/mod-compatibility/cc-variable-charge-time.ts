import { runTasks } from 'cc-instanceinator/src/inst-util'

function listener(timings: number[]) {
    if (!multi.server) return
    runTasks(multi.server.getAllInstances(), () => {
        ig.setChargeTimings([...timings])
    })
}

export function registerChargeTimingsChangeListener() {
    ig.onChargeTimingsChange?.push(listener)
}
export function unregisterChargeTimingsChangeListener() {
    ig.onChargeTimingsChange?.erase(listener)
}
