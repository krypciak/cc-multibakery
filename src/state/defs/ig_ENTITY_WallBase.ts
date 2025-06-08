import { EntityTypeId, registerEntityTypeId } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { createUuidStaticEntity, isSameAsLast } from './entity'

declare global {
    namespace ig.ENTITY {
        interface WallBase {
            getState(this: this, full: boolean): Return
            setState(this: this, state: Return): void

            lastSent?: Return
        }
        interface WallBaseConstructor {
            create(uuid: string, state: Return): ig.ENTITY.WallBase
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.WallBase, full: boolean) {
    const timer = this.wallBlockers[0]?.timer
    return {
        active: isSameAsLast(this, full, this.active, 'active'),
        timer: isSameAsLast(this, full, timer, 'timer'),
    }
}
function setState(this: ig.ENTITY.WallBase, state: Return) {
    if (state.timer !== undefined) {
        for (const wallBlocker of this.wallBlockers) {
            wallBlocker.timer = state.timer
        }
    }
    if (state.active !== undefined && this.active != state.active) {
        this.active = state.active
        this.updateWallBlockers()
    }
}

prestart(() => {
    const typeId: EntityTypeId = 'wb'
    ig.ENTITY.WallBase.inject({
        getState,
        setState,
        createUuid(x, y, z, settings) {
            return createUuidStaticEntity(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.WallBase.create = () => {
        throw new Error('ig.ENTITY.WallBase.create not implemented')
    }
    registerEntityTypeId(ig.ENTITY.WallBase, typeId)

    ig.ENTITY.WallBlocker.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            /* prevent this.timer from ticking */
        },
        setActive(isBaseActive, isActive) {
            if (!ig.settingStateImmediately) return this.parent(isBaseActive, isActive)

            const soundsBackup = this.sounds
            this.sounds = undefined
            this.parent(isBaseActive, isActive)
            this.sounds = soundsBackup
        },
    })
}, 2)
