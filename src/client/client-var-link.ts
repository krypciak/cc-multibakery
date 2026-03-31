import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../misc/assert'

export function linkClientVars(mapInst: InstanceinatorInstance) {
    assert(ig.client)
    const from = mapInst.ig.vars
    const to = ig.vars

    to.currentLevelName = from.currentLevelName
    to.varsSetBy = from.varsSetBy
    to.entityAccessors = from.entityAccessors

    to.storage = from.storage
}
