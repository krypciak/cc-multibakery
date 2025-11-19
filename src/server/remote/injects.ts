import { prestart } from '../../loading-stages'
import { isParticleClass } from '../../state/entity/ig_ENTITY_Effect'
import { RemoteServer } from './remote-server'

prestart(() => {
    if (!REMOTE) return

    dummy.DummyPlayer.inject({
        setAction(action, keepState, noStateReset) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(action, keepState, noStateReset)
        },
    })

    ig.Game.inject({
        spawnEntity(entity, x, y, z, settings, showAppearEffects) {
            if (ASSERT) {
                if (multi.server instanceof RemoteServer && !ig.settingState && ig.ccmap?.ready) {
                    const isOk =
                        typeof entity === 'function'
                            ? isParticleClass(entity) ||
                              (entity == ig.ENTITY.Effect && ig.ignoreEffectNetid) ||
                              entity == dummy.DummyPlayer ||
                              entity == ig.ENTITY.Crosshair ||
                              entity == ig.ENTITY.CrosshairDot ||
                              entity == sc.NPCRunnerEntity
                            : false
                    if (!isOk) {
                        console.groupCollapsed('local entity spawn!', findClassName(entity))
                        console.log(settings)
                        console.trace()
                        console.groupEnd()
                    }
                }
            }
            return this.parent(entity, x, y, z, settings, showAppearEffects)
        },
    })

    ig.ENTITY.EventTrigger.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })

    ig.ENTITY.NPC.inject({
        onInteraction() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })

    sc.CommonEvents.inject({
        triggerEvent(type, data) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(type, data)
            return null
        },
    })

    ig.ENTITY.EnemySpawner.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })

    ig.ACTION_STEP.REMOVE_PROXIES.inject({
        start(target) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(target)
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
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 3)
