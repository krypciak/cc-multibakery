import { prestart } from '../plugin'
import { RemoteServer } from '../server/remote/remote-server'
import * as inputBackup from '../dummy/dummy-input'
import { assert } from '../misc/assert'
import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { isSameAsLast } from './state-util'

declare global {
    namespace ig.ENTITY {
        interface Crosshair {
            createNetid(
                this: this,
                x: number,
                y: number,
                z: number,
                settings: ig.ENTITY.Crosshair.Settings
            ): string | undefined

            lastSent?: Return
            justThrown?: boolean
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Crosshair, full: boolean) {
    let isAiming = false
    if (this.thrower instanceof dummy.DummyPlayer) {
        assert(this.thrower instanceof dummy.DummyPlayer)
        inputBackup.apply(this.thrower.inputManager)
        isAiming = this.controller.isAiming()
        inputBackup.restore()
    }
    const justThrown = this.justThrown
    this.justThrown = false

    return {
        pos: isSameAsLast(this, full, this.coll.pos, 'pos', Vec3.equal, Vec3.create),
        active: isSameAsLast(this, full, this.active, 'active'),
        special: isSameAsLast(this, full, this.special, 'special'),
        isAiming: isSameAsLast(this, full, isAiming, 'isAiming'),
        currentCharge: isSameAsLast(this, full, this.currentCharge, 'currentCharge'),
        justThrown: isSameAsLast(this, full, justThrown, 'thrown'),
    }
}
function setState(this: ig.ENTITY.Crosshair, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)

    if (state.active !== undefined) {
        this.setActive(state.active)
    }

    if (state.special !== undefined) this.special = state.special
    if (state.isAiming !== undefined) this.controller.isAimingOverride = state.isAiming
    this.chargeActive = true
    if (state.currentCharge !== undefined) {
        this.currentCharge = state.currentCharge
    }

    if (state.justThrown) {
        this.doBlink = true
    }
}

prestart(() => {
    const typeId: EntityTypeId = 'cr'
    ig.ENTITY.Crosshair.inject({
        getState,
        setState,
        createNetid(_x, _y, _z, settings) {
            if (!(settings.thrower instanceof dummy.DummyPlayer)) return
            return `${typeId}${settings.thrower.data.username}`
        },
    })
    registerNetEntity({ entityClass: ig.ENTITY.Crosshair, typeId, applyPriority: 3000 })

    ig.ENTITY.Crosshair.forceRemotePhysics = true
    ig.ENTITY.CrosshairDot.forceRemotePhysics = true

    if (REMOTE) {
        ig.ENTITY.Crosshair.inject({
            deferredUpdate() {
                if (!(multi.server instanceof RemoteServer)) return this.parent()

                const backup = this.controller.updatePos
                this.controller.updatePos = () => {}

                this.parent()

                this.controller.updatePos = backup
            },
        })
    }
    if (PHYSICS) {
        ig.ENTITY.Crosshair.inject({
            setThrown() {
                this.justThrown = true
                return this.parent()
            },
        })
    }
}, 2)

declare global {
    namespace sc {
        interface PlayerCrossHairController {
            isAimingOverride?: boolean
        }
    }
}
prestart(() => {
    sc.PlayerCrossHairController.inject({
        isAiming() {
            return this.isAimingOverride || this.parent()
        },
    })
})
