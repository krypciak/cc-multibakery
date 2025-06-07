import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import * as inputBackup from '../../dummy/dummy-input'
import { assert } from '../../misc/assert'

export {}
declare global {
    namespace ig.ENTITY {
        interface Crosshair {
            type: 'ig.ENTITY.Crosshair'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface CrosshairConstructor {
            priority: number
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
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
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)

    const active = !!state.active
    if (active != this.active) {
        this.setActive(active)
    }

    this.special = !!state.special
    this.controller.isAimingOverride = state.isAiming
    this.chargeActive = true
    this.currentCharge = state.currentCharge ?? 0
}

prestart(() => {
    ig.ENTITY.Crosshair.inject({ getState, setState })
    ig.ENTITY.Crosshair.priority = 3000

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
