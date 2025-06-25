import { prestart } from '../../plugin'
import { RemoteServer } from './remote-server'

prestart(() => {
    if (!REMOTE) return

    ig.EventManager.inject({
        update() {
            // TEMP fix todo
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            this.clear()
        },
    })

    dummy.DummyPlayer.inject({
        setAction(action, keepState, noStateReset) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(action, keepState, noStateReset)
            /* TODO: figure this out when event stuff */
            console.log('blocking player action', action)
        },
    })

    ig.Game.inject({
        spawnEntity(entity, x, y, z, settings, showAppearEffects) {
            if (multi.server instanceof RemoteServer && !ig.settingState && ig.ccmap?.ready) {
                const isOk =
                    typeof entity === 'function'
                        ? entity == ig.ENTITY.CopyParticle ||
                          entity == ig.ENTITY.Particle ||
                          entity == ig.ENTITY.OffsetParticle ||
                          // @ts-expect-error
                          entity == ig.ENTITY.DebrisParticle
                        : false
                if (!isOk) {
                    console.groupCollapsed('local entity spawn!', findClassName(entity))
                    console.warn(settings)
                    console.trace()
                    console.groupEnd()
                }
            }
            return this.parent(entity, x, y, z, settings, showAppearEffects)
        },
    })
}, 3)
