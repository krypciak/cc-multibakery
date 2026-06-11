import { prestart } from '../../loading-stages'
import { createNetidSpecialBit } from '../../misc/entity-netid'
import { assert } from '../../misc/assert'

let ignoreEffectNetidCount = 0
export function wrapIgnoreEffectNetid<R>(func: () => R) {
    assert(ignoreEffectNetidCount >= 0)
    ignoreEffectNetidCount++
    const ret = func()
    ignoreEffectNetidCount--
    return ret
}

prestart(() => {
    ig.ENTITY.Effect.inject({
        createNetid() {
            if (ignoreEffectNetidCount > 0) return
            return createNetidSpecialBit.call(this)
        },
    })
})
