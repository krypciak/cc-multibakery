import { runTasks } from 'cc-instanceinator/src/inst-util'
import { assert } from '../misc/assert'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { CCMap } from '../server/ccmap/ccmap'

export function getCCMap(): CCMap {
    if (ig.ccmap) return ig.ccmap
    if (ig.client) return ig.client.getMap()
    assert(false, 'getCCMap ran in server instance!')
}

