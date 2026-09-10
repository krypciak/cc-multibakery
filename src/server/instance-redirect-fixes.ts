import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

/* any -> any */
prestart(() => {
    ig.GuiHook.inject({
        onAttach(hook) {
            const inst = instanceinator.instances[this._instanceId]
            return runTask(inst, () => this.parent(hook))
        },
        doStateTransition(...args) {
            const inst = instanceinator.instances[this._instanceId]
            return runTask(inst, () => this.parent(...args))
        },
    })
})

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

export function findClientInst(this: ig.Class, ...args: unknown[]): InstanceinatorInstance | undefined {
    let inst: InstanceinatorInstance | undefined = instanceinator.instances[this._instanceId]
    if (inst?.ig?.client) return inst

    for (const arg of args) {
        if (arg && typeof arg === 'object') {
            if (arg instanceof dummy.DummyPlayer) {
                inst = arg.getClient(true)?.inst
                if (inst) return inst
            }
            if ('_instanceId' in arg) {
                inst = instanceinator.instances[arg._instanceId as number]
                if (inst.ig.client) return inst
            }
        }
    }

    if (ig.ccmap && ig.ccmap.clients.length > 0) {
        inst = ig.ccmap.clients[0].inst
        return inst
    }
    console.warn(`universalFindClientInst: client not found!!`, this, ...args)
}

export function universalPlayerEntityFix<T extends ig.Class, ARGS extends unknown[], R>(
    extraFindClientInstArgs: (this: T, ...args: ARGS) => unknown[] = () => []
) {
    return function universalPlayerEntityFix(this: T & { parent: (...args: ARGS) => R }, ...args: ARGS): R {
        if (!multi.server || ig.client) return this.parent(...args)

        const inst = findClientInst.call(this, ...extraFindClientInstArgs.call(this, ...args), ...args)
        if (inst) return runTask(inst, () => this.parent(...args))

        return this.parent(...args)
    }
}

prestart(() => {
    if (!PHYSICS) return

    sc.Combat.inject({ getPartyHpFactor: universalPlayerEntityFix() })
    ig.EVENT_STEP.ADD_PARTY_MEMBER.inject({ start: universalPlayerEntityFix() })
    sc.PlayerCameraFocusHandle.inject({ onActionEndDetach: universalPlayerEntityFix() })
    ig.EVENT_STEP.ADD_PLAYER_CAMERA_TARGET.inject({ start: universalPlayerEntityFix() })
    ig.EVENT_STEP.REMOVE_PLAYER_CAMERA_TARGET.inject({ start: universalPlayerEntityFix() })
    ig.ACTION_STEP.REMOVE_PLAYER_CAMERA_TARGET.inject({ start: universalPlayerEntityFix() })
    ig.ACTION_STEP.ADD_PLAYER_CAMERA_TARGET.inject({ start: universalPlayerEntityFix() })
})
