import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { Client } from './client'

export function linkClientVars(client: Client, mapInst: InstanceinatorInstance) {
    const from = mapInst.ig.vars
    const to = client.inst.ig.vars

    to.currentLevelName = from.currentLevelName
    to.varsSetBy = from.varsSetBy

    const mapProxy = new Proxy((from.storage.map ??= {}), {
        get(target, p, receiver) {
            if (p == 'client') return ((from.storage.map.clients ??= {})[client.username] ??= {})
            return Reflect.get(target, p, receiver)
        },
    })
    const tmpProxy = new Proxy((from.storage.tmp ??= {}), {
        get(target, p, receiver) {
            if (p == 'client') return ((from.storage.tmp.clients ??= {})[client.username] ??= {})
            return Reflect.get(target, p, receiver)
        },
    })

    to.storage = new Proxy(from.storage, {
        get(target, p, receiver) {
            if (p == 'map') return mapProxy
            if (p == 'tmp') return tmpProxy

            return Reflect.get(target, p, receiver)
        },
    })
}
