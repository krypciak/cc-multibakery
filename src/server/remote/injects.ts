import { prestart } from '../../loading-stages'
import { wrapIgnoreEffectNetid } from '../../state/entity/effect-netid'
import { isRemote } from './remote-server-types'

prestart(() => {
    if (!REMOTE) return

    dummy.DummyPlayer.inject({
        setAction(action, keepState, noStateReset) {
            if (!isRemote(multi.server)) return this.parent(action, keepState, noStateReset)
        },
    })

    ig.ENTITY.EventTrigger.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })

    ig.ENTITY.NPC.inject({
        onInteraction() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })

    sc.CommonEvents.inject({
        triggerEvent(type, data) {
            if (!isRemote(multi.server)) return this.parent(type, data)
            return null
        },
    })

    ig.ENTITY.EnemySpawner.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })

    ig.ACTION_STEP.REMOVE_PROXIES.inject({
        start(target) {
            if (!isRemote(multi.server)) return this.parent(target)
        },
    })

    sc.NPCRunnerEntity.forceRemotePhysics = true
    sc.NPCRunnerEntity.inject({
        initAction(enter, exit, waypoints, partyIdx) {
            return wrapIgnoreEffectNetid(() => this.parent(enter, exit, waypoints, partyIdx))
        },
        onTouchGround(zVel) {
            return wrapIgnoreEffectNetid(() => this.parent(zVel))
        },
    })

    ig.ENTITY.TeleportField.inject({
        onInteraction() {
            if (!isRemote(multi.server)) return this.parent()
            return false
        },
    })

    sc.PropInteract.inject({
        onInteraction() {
            if (!isRemote(multi.server)) return this.parent()
            return false
        },
    })

    let ignoreEffectSpawn = 0
    ig.EffectSheet.inject({
        spawnOnTarget(name, target, settings) {
            if (ignoreEffectSpawn == 0) return this.parent(name, target, settings)
            return null
        },
    })

    ig.Game.inject({
        requestEntityHide(entity) {
            if (!isRemote(multi.server) || !ig.mapShared.ccmap.noStateAppliedYet) return this.parent(entity)
            try {
                ignoreEffectSpawn++
                return this.parent(entity)
            } finally {
                ignoreEffectSpawn--
                if (!entity._hidden) entity.hide()
            }
        },
    })
}, 3)
