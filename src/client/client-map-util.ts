import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { assert } from '../misc/assert'

export function runTaskInMapInst<T>(task: () => T): T {
    if (ig.client) {
        return runTask(ig.client.getMap().inst, task)
    } else if (ig.ccmap) {
        return task()
    } else assert(false, 'runTaskInMapInst ran in server instance!')
}

