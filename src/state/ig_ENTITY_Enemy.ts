import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { RemoteServer } from '../server/remote/remote-server'
import { createNetidStaticEntity } from './entity'
import { isSameAsLast } from './state-util'

declare global {
    namespace ig.ENTITY {
        interface Enemy {
            lastSent?: Return
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Enemy, full: boolean) {
    return {
        pos: isSameAsLast(this, full, this.coll.pos, 'pos', Vec3.equal, Vec3.create),
        currentAnim: isSameAsLast(this, full, this.currentAnim, 'currentAnim'),
        currentAnimTimer: this.animState.timer,
        face: isSameAsLast(this, full, this.face, 'face', Vec2.equal, Vec2.create),
        accelDir: isSameAsLast(this, full, this.coll.accelDir, 'accelDir', Vec2.equal, Vec2.create),
        animAlpha: isSameAsLast(this, full, this.animState.alpha, 'animAlpha'),
    }
}

function setState(this: ig.ENTITY.Enemy, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)

    if (state.currentAnim !== undefined && this.currentAnim != state.currentAnim) {
        this.currentAnim = state.currentAnim
    }
    this.animState.timer = state.currentAnimTimer

    if (state.face) this.face = state.face
    if (state.accelDir) this.coll.accelDir = state.accelDir
    if (state.animAlpha !== undefined) this.animState.alpha = state.animAlpha

    if (this.enemyType && !this.enemyTypeInitialized) this.enemyType.initEntity(this)
    this.updateAnim()
}

prestart(() => {
    const typeId: EntityTypeId = 'en'
    ig.ENTITY.Enemy.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStaticEntity(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.Enemy.create = () => {
        throw new Error('ig.ENTITY.Enemy.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Enemy, typeId })

    if (!REMOTE) return

    ig.ENTITY.Enemy.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 2)
