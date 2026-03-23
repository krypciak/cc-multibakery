import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { Client } from './client'

export function linkClientVars(client: Client, mapInst: InstanceinatorInstance) {
    const from = mapInst.ig.vars
    const to = client.inst.ig.vars

    to.currentLevelName = from.currentLevelName
    to.varsSetBy = from.varsSetBy
    to.entityAccessors = from.entityAccessors

    to.storage = from.storage
}
