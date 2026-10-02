import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igActorEntity from './ig_ActorEntity-base'
import { assert } from '../../misc/assert'

declare global {
    namespace ig.ENTITY {
        namespace GhostActorEntity {
            interface Settings extends ig.ActorEntity.Settings {
                size: Vec3
                face: Vec2
                animSheetName?: string
                currentAnim?: string
            }
        }
        interface GhostActorEntity extends ig.ActorEntity {}
        interface ARBoxEntityConstructor extends ImpactClass<GhostActorEntity> {
            new (x: number, y: number, z: number, settings: ig.ENTITY.GhostActorEntity.Settings): GhostActorEntity

            settingsFromBaseEntity(baseEntity: ig.ActorEntity, noShow?: boolean): ig.ENTITY.GhostActorEntity.Settings
        }
        var GhostActorEntity: ARBoxEntityConstructor
    }
}
prestart(() => {
    ig.ENTITY.GhostActorEntity = ig.ActorEntity.extend({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)

            const { size, face, animSheetName, currentAnim } = settings
            this.setSize(size.x, size.y, size.z)
            this.coll.setType(ig.COLLTYPE.NONE)

            Vec2.assign(this.face, face)

            if (animSheetName) {
                const animSheet = new ig.AnimationSheet(animSheetName)
                this.animSheet = animSheet
                this.currentAnim = currentAnim ?? ''
                const sheet = animSheet.anims[currentAnim as string] as ig.MultiDirAnimationSet
                if (sheet) this.animState.setAnimation(this, sheet.getAnimations(this))
            }
        },
    })
    ig.ENTITY.GhostActorEntity.settingsFromBaseEntity = (baseEntity, noShow) => {
        return {
            size: Vec3.create(baseEntity.coll.size),
            face: Vec2.create(baseEntity.face),
            animSheetName: !noShow ? baseEntity.animSheet.path : undefined,
            currentAnim: !noShow && typeof baseEntity.currentAnim === 'string' ? baseEntity.currentAnim : undefined,
        }
    }
})

declare global {
    namespace ig.ENTITY {
        interface GhostActorEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.GhostActorEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.GhostActorEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igActorEntity.getEntityState.call(this, player, memory),
        size: memory.onlyOnce(this.coll.size),
        face: memory.onlyOnce(this.face),
        animSheetName: memory.onlyOnce(this.animSheet?.path),
    }
}

function setEntityState(this: ig.ENTITY.GhostActorEntity, state: Return) {
    igActorEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.GhostActorEntity.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.GhostActorEntity.create = (netid, state: Return) => {
        assert(state.pos)
        const { size, face, animSheetName, currentAnim } = state
        assert(size)
        assert(face)

        const { x, y, z } = state.pos
        const entity = ig.game.spawnEntity('GhostActorEntity', x, y, z, {
            netid,
            size,
            face,
            animSheetName,
            currentAnim,
        })
        return entity
    }
    registerNetEntity({ entityClass: ig.ENTITY.GhostActorEntity })
})
