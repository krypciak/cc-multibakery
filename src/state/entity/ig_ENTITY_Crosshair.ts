import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import { inputBackup } from '../../dummy/dummy-input'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace ig.ENTITY {
        interface Crosshair extends StateMemory.MapHolder<StateKey> {
            justThrown?: boolean
            justSetCircleGlow?: boolean
        }
    }
    interface EntityStates {
        'ig.ENTITY.Crosshair': Return
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

    const justSetCircleGlow = this.justSetCircleGlow
    this.justSetCircleGlow = false

    assert(this.thrower.netid)
    return {
        owner: memory.onlyOnce(this.thrower.netid),
        pos: this.active || this.circleGlow > 0 ? memory.diffVec3(this.coll.pos) : undefined,
        active: memory.diff(this.active),
        special: memory.diff(this.special),
        isAiming: memory.diff(isAiming),
        currentCharge: memory.diff(this.currentCharge),
        justThrown: memory.diff(justThrown),
        circleGlow: memory.diff(justSetCircleGlow),
    }
}
function setState(this: ig.ENTITY.Crosshair, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)

    if (state.active !== undefined) {
        if (this.thrower instanceof dummy.DummyPlayer) {
            inputBackup(this.thrower.inputManager, () => this.setActive(state.active!))
        } else {
            this.setActive(state.active)
        }
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

    if (
        state.circleGlow &&
        (!(this.thrower instanceof dummy.DummyPlayer) ||
            this.thrower.inputManager.input.currentDevice != ig.INPUT_DEVICES.GAMEPAD) &&
        sc.options.get('close-circle')
    ) {
        this.setCircleGlow()
    }
}

prestart(() => {
    ig.ENTITY.Crosshair.inject({
        getState,
        setState,
        createNetid() {
            if (isRemote(multi.server)) return
            return this.parent()
        },
    })
    ig.ENTITY.Crosshair.create = (netid: EntityNetid, state: Return) => {
        assert(state.owner)
        const player = ig.game.entitiesByNetid[state.owner]
        assert(player)
        assert(player instanceof dummy.DummyPlayer)

        const crosshair = player.gui.crosshair
        assert(crosshair)
        crosshair.changeNetid(netid)

        return crosshair
    }
    registerNetEntity({ entityClass: ig.ENTITY.Crosshair, applyPriority: 3000 })

    ig.ENTITY.Crosshair.forceRemotePhysics = true
    ig.ENTITY.CrosshairDot.forceRemotePhysics = true

    if (PHYSICS) {
        ig.ENTITY.Crosshair.inject({
            setThrown() {
                this.justThrown = true
                return this.parent()
            },
            setCircleGlow() {
                this.justSetCircleGlow = true
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
