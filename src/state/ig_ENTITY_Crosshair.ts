import { prestart } from '../plugin'
import { assert } from '../misc/assert'
import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { StateMemory } from './state-util'
import { StateKey } from './states'
import { inputBackup } from '../dummy/dummy-input'

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

            lastSent?: WeakMap<StateKey, StateMemory>
            justThrown?: boolean
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Crosshair, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    let isAiming = false
    if (this.thrower instanceof dummy.DummyPlayer) {
        assert(this.thrower instanceof dummy.DummyPlayer)
        inputBackup(this.thrower.inputManager, () => {
            isAiming = this.controller.isAiming()
        })
    }
    const justThrown = this.justThrown
    this.justThrown = false

    return {
        pos: memory.diffVec3(this.coll.pos),
        active: memory.diff(this.active),
        special: memory.diff(this.special),
        isAiming: memory.diff(isAiming),
        currentCharge: memory.diff(this.currentCharge),
        justThrown: memory.diff(justThrown),
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
