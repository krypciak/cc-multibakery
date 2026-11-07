import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { universalPlayerEntityFix } from '../../server/instance-redirect-fixes'
import { addProxy } from './proxy-util'

declare global {
    namespace ig.ENTITY {
        interface KeyPanel extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.KeyPanel': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.KeyPanel, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}
function setEntityState(this: ig.ENTITY.KeyPanel, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

export function register() {
    ig.ENTITY.KeyPanel.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.KeyPanel.create = () => {
        throw new Error('ig.ENTITY.KeyPanel.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.KeyPanel })
}

prestart(() => {
    ig.ENTITY.KeyPanel.inject({
        collideWith: universalPlayerEntityFix(),
        update: universalPlayerEntityFix(function () {
            return [this.throwerEntity]
        }),
    })

    const keyTypes: Record<string, ig.ENTITY.KeyPanel.KeyTypeConfig> = (ig.ENTITY.KeyPanel.prototype._wm._data as any)
        .attributes.keyType._select
    for (const keyType in keyTypes) {
        const config = keyTypes[keyType]
        addProxy(`keyball-${keyType}`, config.ballInfo)
    }
}, 2)
