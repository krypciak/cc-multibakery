import { prestart } from '../../plugin'
import { isParticleClass } from '../../state/ig_ENTITY_Effect'
import { RemoteServer } from './remote-server'

prestart(() => {
    if (!REMOTE) return

    ig.EventManager.inject({
        update() {
            // TODO: TEMP fix
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            this.clear()
        },
    })

    dummy.DummyPlayer.inject({
        setAction(action, keepState, noStateReset) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(action, keepState, noStateReset)
        },
    })

    ig.Game.inject({
        spawnEntity(entity, x, y, z, settings, showAppearEffects) {
            if (multi.server instanceof RemoteServer && !ig.settingState && ig.ccmap?.ready) {
                const isOk = typeof entity === 'function' ? isParticleClass(entity) : false
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
            return this.parent(entity, x, y, z, settings, showAppearEffects)
        },
    })
}, 3)
