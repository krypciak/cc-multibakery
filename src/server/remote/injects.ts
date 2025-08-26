import { prestart } from '../../plugin'
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
                        ig.ignoreEffectNetid ||
                        (typeof entity === 'function'
                            ? isParticleClass(entity) ||
                              entity == dummy.DummyPlayer ||
                              entity == ig.ENTITY.Crosshair ||
                              entity == ig.ENTITY.CrosshairDot
                            : false)
                    if (!isOk) {
                        console.groupCollapsed('local entity spawn!', findClassName(entity))
                        console.warn(settings)
                        console.trace()
                        console.groupEnd()
                    }
                }
                // if (entity == ig.ENTITY.Effect || entity == 'Effect') {
                //     const set = settings as ig.ENTITY.Effect.Settings
                //     console.groupCollapsed(set.effect?.effectName, set.netid)
                //     console.trace()
                //     console.groupEnd()
                // }
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
}, 3)
