import { prestart } from '../../loading-stages'
import { isRemote } from './is-remote-server'

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
            ig.ignoreEffectNetid = true
            this.parent(enter, exit, waypoints, partyIdx)
            ig.ignoreEffectNetid = false
        },
    })

    ig.ENTITY.TeleportField.inject({
        onInteraction() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })
}, 3)
