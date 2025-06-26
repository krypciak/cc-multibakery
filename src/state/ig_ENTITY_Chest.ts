import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { createNetidStatic } from './entity'
import { isSameAsLast } from './state-util'

declare global {
    namespace ig.ENTITY {
        interface Chest {
            lastSent?: Return
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Chest, full: boolean) {
    return {
        isOpen: isSameAsLast(this, full, this.isOpen, 'isOpen'),
    }
}

function setState(this: ig.ENTITY.Chest, state: Return) {
    if (state.isOpen !== undefined) {
        if (state.isOpen) {
            this.isOpen = true
            this.setCurrentAnim('open', true, null, true, true)
            this.coll.float.height = 0
            this.coll.shadow.size = 0
            sc.mapInteract.removeEntry(this.interactEntry)
        }
    }
}

prestart(() => {
    const typeId: EntityTypeId = 'ch'
    ig.ENTITY.Chest.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.Chest.create = () => {
        throw new Error('ig.ENTITY.Chest.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Chest, typeId })
    ig.ENTITY.Chest.forceRemotePhysics = true
}, 2)
