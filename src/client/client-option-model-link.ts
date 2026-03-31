import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { rehookObservers } from './client'
import { assert } from '../misc/assert'

export function linkClientOptionModel(mapInst: InstanceinatorInstance) {
    assert(ig.client)
    const msc = mapInst.sc

    ig.storage.unregister(sc.options)
    rehookObservers(msc.options, sc.options)
    sc.options = msc.options
}
