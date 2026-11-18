import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { wrapCollectSounds } from '../state/entity/sound-collector'

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

function findClientInst(
    this: ig.Class,
    noWarning: boolean | undefined,
    ...args: unknown[]
): InstanceinatorInstance | undefined {
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
    if (!noWarning) console.warn(`universalFindClientInst: client not found!!`, this, ...args)
}

export function universalPlayerEntityFix<T extends ig.Class, ARGS extends unknown[], R>(
    extraFindClientInstArgs: (this: T, ...args: ARGS) => unknown[] = () => [],
    noWarning?: boolean
) {
    return function universalPlayerEntityFix(this: T & { parent: (...args: ARGS) => R }, ...args: ARGS): R {
        if (!multi.server || ig.client) return this.parent(...args)

        const inst = findClientInst.call(this, noWarning, ...extraFindClientInstArgs.call(this, ...args), ...args)
        if (!inst) return this.parent(...args)

        try {
            inst.ig.ENTITY_KILL_CALL = ig.ENTITY_KILL_CALL
            return runTask(inst, () => this.parent(...args))
        } finally {
            ig.ENTITY_KILL_CALL = inst.ig.ENTITY_KILL_CALL
        }
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

prestart(() => {
    if (!PHYSICS) return

    const playerEntityFixFunc = universalPlayerEntityFix<ig.Class, [ig.BallLike], boolean>(ballLike => [
        ballLike.getCombatantRoot(),
    ])

    const ballHit = function <T extends ig.Class, ARGS extends [ig.BallLike]>(
        this: T & { parent: (...args: ARGS) => boolean },
        ...args: ARGS
    ): boolean {
        return wrapCollectSounds(() => playerEntityFixFunc.call(this as any, ...args))
    }

    ig.ENTITY.Prop.inject({ ballHit })
    ig.ENTITY.ScalableProp.inject({ ballHit })
    sc.CombatProxyEntity.inject({ ballHit })
    sc.BombEntity.inject({ ballHit })
    sc.WaterBubbleEntity.inject({ ballHit })
    ig.ENTITY.Compressor.inject({ ballHit })
    sc.CompressedBaseEntity.inject({ ballHit })
    ig.ENTITY.AntiCompressor.inject({ ballHit })
    ig.ENTITY.CompressorBouncer.inject({ ballHit })
    ig.ENTITY.WaterBlock.inject({ ballHit })
    sc.IceDiskEntity.inject({ ballHit })
    ig.ENTITY.BallChanger.inject({ ballHit })
    ig.ENTITY.FerroSpot.inject({ ballHit })
    ig.ENTITY.FerroRespawner.inject({ ballHit })
    sc.FerroEntity.inject({ ballHit })
    ig.ENTITY.OneTimeSwitch.inject({ ballHit })
    sc.ElementShieldBallEntity.inject({ ballHit })
    ig.ENTITY.Magnet.inject({ ballHit })
    ig.ENTITY.MultiHitSwitch.inject({ ballHit })
    ig.ENTITY.BounceSwitch.inject({ ballHit })
    ig.ENTITY.BounceBlock.inject({ ballHit })
    ig.ENTITY.ElementPole.inject({ ballHit })
    ig.ENTITY.WavePushPullBlock.inject({ ballHit })
    ig.ENTITY.SlidingBlock.inject({ ballHit })
    ig.ENTITY.Switch.inject({ ballHit })
    ig.ENTITY.Destructible.inject({ ballHit })
    ig.ENTITY.ItemDestruct.inject({ ballHit })
    ig.ENTITY.RegenDestruct.inject({ ballHit })
    ig.ENTITY.GroupSwitch.inject({ ballHit })
    ig.ENTITY.TeslaCoil.inject({ ballHit })
    ig.ENTITY.WaveTeleport.inject({ ballHit })
    ig.ENTITY.RotateBlocker.inject({ ballHit })
}, 2000)
