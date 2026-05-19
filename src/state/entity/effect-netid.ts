import { prestart } from '../../loading-stages'
import { createNetidSpecialBit } from '../../misc/entity-netid'
import { assert } from '../../misc/assert'

let ignoreEffectNetid: boolean = false
export function wrapIgnoreEffectNetid<R>(func: () => R) {
    assert(!ignoreEffectNetid)
    ignoreEffectNetid = true
    const ret = func()
    ignoreEffectNetid = false
    return ret
}

prestart(() => {
    ig.ENTITY.Effect.inject({
        createNetid() {
            if (ignoreEffectNetid) return
            return createNetidSpecialBit.call(this)
        },
    })
})
