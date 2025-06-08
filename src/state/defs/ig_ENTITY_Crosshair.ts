import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import * as inputBackup from '../../dummy/dummy-input'
import { assert } from '../../misc/assert'
import { EntityTypeId } from '../../misc/entity-uuid'

declare global {
    namespace ig.ENTITY {
        interface Crosshair {
            getState(this: this): Return
            setState(this: this, state: Return): void
            createUuid(this: this, x: number, y: number, z: number, settings: ig.ENTITY.Crosshair.Settings): string
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Crosshair) {
    assert(this.thrower instanceof dummy.DummyPlayer)
    inputBackup.apply(this.thrower.inputManager)
    const isAiming = this.controller.isAiming()
    inputBackup.restore()

    return {
        pos: this.coll.pos,
        active: this.active ? true : undefined,
        special: this.special ? true : undefined,
        isAiming: isAiming ? true : undefined,
        currentCharge: this.currentCharge != 0 ? this.currentCharge : undefined,
    }
}
function setState(this: ig.ENTITY.Crosshair, state: Return) {
    Vec3.assign(this.coll.pos, state.pos)

    const active = !!state.active
    if (active != this.active) this.setActive(active)

    this.special = !!state.special
    this.controller.isAimingOverride = state.isAiming
    this.chargeActive = true
    this.currentCharge = state.currentCharge ?? 0
}

prestart(() => {
    const typeId: EntityTypeId = 'cr'
    ig.ENTITY.Crosshair.inject({
        getState,
        setState,
        createUuid(_x, _y, _z, settings) {
            return `${typeId}${settings.thrower.uuid}`
        },
    })
    ig.registerEntityTypeId(ig.ENTITY.Crosshair, typeId, 3000)

    ig.ENTITY.Crosshair.inject({
        deferredUpdate() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()

            const backup = this.controller.updatePos
            this.controller.updatePos = () => {}

            this.parent()

            this.controller.updatePos = backup
        },
    })
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
