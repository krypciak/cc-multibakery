import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

/* client -> map */
prestart(() => {
    if (!PHYSICS) return

    function runOnMap<T extends ig.Class, ARGS extends unknown[], R>(
        this: T & { parent: (...args: ARGS) => R },
        ...args: ARGS
    ): R {
        if (!ig.client) return this.parent(...args)
        return runTask(ig.mapShared.ccmap.inst, () => this.parent(...args))
    }

    ig.EVENT_STEP.MANUAL_COMBATANT_KILL.inject({ start: runOnMap })
    ig.EVENT_STEP.HIDE_ENTITY.inject({ start: runOnMap })
    ig.Game.inject({ spawnEntity: runOnMap })
})

/* map -> client */
prestart(() => {
    dummy.DummyPlayer.inject({
        _removeTargetedBy(combatant) {
            if (!multi.server || !ig.ccmap) return this.parent(combatant)

            const client = this.getClient(true)
            if (client) runTask(client.inst, () => this.parent(combatant))
        },
    })
})

function findClientInst(this: ig.Class, ...args: unknown[]): InstanceinatorInstance | undefined {
    let inst: InstanceinatorInstance = instanceinator.instances[this._instanceId]
    if (inst?.ig?.client) return inst

    let arg = args[0]
    if (arg && typeof arg === 'object' && '_instanceId' in arg) {
        inst = instanceinator.instances[arg._instanceId as number]
        if (inst.ig.client) return inst
    }

    if (ig.ccmap && ig.ccmap.clients.length > 0) {
        inst = ig.ccmap.clients[0].inst
        return inst
    }
    console.warn(`universalFindClientInst: client not found!!`, this, ...args)
}

function universalPlayerEntityFix<T extends ig.Class, ARGS extends unknown[], R>(
    this: T & { parent: (...args: ARGS) => R },
    ...args: ARGS
): R {
    if (!multi.server || ig.client) return this.parent(...args)

    const inst = findClientInst.call(this, ...args)
    if (inst) return runTask(inst, () => this.parent(...args))

    return this.parent(...args)
}

prestart(() => {
    if (!PHYSICS) return

    sc.Combat.inject({ getPartyHpFactor: universalPlayerEntityFix })
    ig.EVENT_STEP.ADD_PARTY_MEMBER.inject({ start: universalPlayerEntityFix })
    sc.PlayerCameraFocusHandle.inject({ onActionEndDetach: universalPlayerEntityFix })
    ig.EVENT_STEP.ADD_PLAYER_CAMERA_TARGET.inject({ start: universalPlayerEntityFix })
    ig.EVENT_STEP.REMOVE_PLAYER_CAMERA_TARGET.inject({ start: universalPlayerEntityFix })
    ig.ACTION_STEP.REMOVE_PLAYER_CAMERA_TARGET.inject({ start: universalPlayerEntityFix })
    ig.ACTION_STEP.ADD_PLAYER_CAMERA_TARGET.inject({ start: universalPlayerEntityFix })
})
