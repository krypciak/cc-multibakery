import { assert } from '../../misc/assert'
import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { shouldCollectStateData, StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import { resolveProxyFromType } from './proxy-util'
import * as scActorEntity from './sc_ActorEntity-base'
import { isRemote } from '../../server/remote/remote-server-types'
import { wrapIgnoreEffectNetid } from './effect-netid'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'

declare global {
    namespace sc {
        interface CombatProxyEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.CombatProxyEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.CombatProxyEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...scActorEntity.getEntityState.call(this, player, memory),
        proxyType: memory.onlyOnce(this.proxyType),
        sourceEntity: memory.onlyOnce(this.sourceEntity.netid),
    }
}
function setEntityState(this: sc.CombatProxyEntity, state: Return) {
    scActorEntity.setEntityState.call(this, state)
}

prestart(() => {
    sc.CombatProxyEntity.inject({
        getEntityState,
        setEntityState,
    })

    sc.CombatProxyEntity.create = (netid: EntityNetid, state: Return) => {
        if (!state.proxyType) return
        assert(state.pos)
        assert(state.sourceEntity)
        assert(state.face)

        const { x, y, z } = state.pos

        const combatant = ig.game.entitiesByNetid[state.sourceEntity]
        assert(combatant, `sc.CombatantProxyEntity#create target not found:  ${state.sourceEntity}`)
        assert(combatant instanceof sc.BasicCombatant)

        const proxy = resolveProxyFromType(state.proxyType)
        assert(proxy instanceof sc.PROXY_TYPE.GENERIC)
        const data: sc.CombatProxyEntity.Data = proxy.data

        const settings: sc.CombatProxyEntity.Settings = {
            netid,
            dir: state.face,
            combatant,
            data,
        }
        assert(!ig.game.entitiesByNetid[netid])
        const entity = ig.game.spawnEntity(sc.CombatProxyEntity, x, y, z, settings)
        assert(ig.game.entitiesByNetid[netid])

        return entity
    }
    registerNetEntity({
        entityClass: sc.CombatProxyEntity,
        applyPriority: 1500 /* after ig.ENTITY.Enemy */,
        temporary: true,
    })

    if (REMOTE) {
        sc.CombatProxyEntity.inject({
            init(x, y, z, settings) {
                if (!isRemote(multi.server) || !('collaboration' in settings.combatant))
                    return this.parent(x, y, z, settings)

                settings.combatant.collaboration = { addCollabAttached() {} }
                this.parent(x, y, z, settings)
                settings.combatant.collaboration = undefined
            },
            update() {
                if (!isRemote(multi.server)) return this.parent()
                ig.AnimatedEntity.prototype.update.call(this)
            },
        })
    }
}, 2)

declare global {
    interface MapStateOrderedEvents {
        destroyCombatProxies: {
            type: 'destroyCombatProxies'
            netid: EntityNetid
        }
    }
}
registerOrderedEvent('destroyCombatProxies', {
    set({ netid }) {
        const entity = ig.game.entitiesByNetid[netid]
        if (!entity) {
            console.warn('destroyCombatProxies entity:', netid, 'not found!')
            return
        }
        assert(entity instanceof sc.CombatProxyEntity)
        entity.destroy()
    },
})

prestart(() => {
    if (PHYSICSNET) {
        sc.CombatProxyEntity.inject({
            destroy(type) {
                if (shouldCollectStateData() && !this.destroyType) {
                    pushOrderedEvent({ type: 'destroyCombatProxies', netid: this.netid })
                }
                wrapIgnoreEffectNetid(() => this.parent(type))
            },
        })
    }
    if (REMOTE) {
        let ignoreDestroy = false
        sc.CombatProxyEntity.inject({
            destroy(type) {
                if (isRemote(multi.server)) {
                    if (ignoreDestroy) return
                }
                this.parent(type)
            },
            update() {
                if (!isRemote(multi.server)) return this.parent()
                if (!ig.shared.settingState && !ig.mapShared.lastStatePacket?.states?.[this.netid]) return

                ignoreDestroy = true
                this.parent()
                ignoreDestroy = false
            },
        })
    }
})

declare global {
    namespace sc {
        interface CombatProxyEntity {
            proxyType: string
        }
    }
}
prestart(() => {
    sc.PROXY_TYPE.GENERIC.inject({
        spawn(...args) {
            const proxy = this.parent(...args)
            if (multi.server) {
                proxy.proxyType = this.proxyType!
                if (!proxy.proxyType) {
                    console.warn('sc.PROXY_TYPE.GENERIC#proxyType is undefined!')
                    debugger
                }
            }
            return proxy
        },
    })
})

prestart(() => {
    if (!REMOTE) return
    ig.ACTION_STEP.SHOW_EFFECT.inject({
        start(actor: ig.ActorEntity) {
            /* dont spawn proxies on remote server because ig.ENTITY.Effect is already being handled */
            if (!isRemote(multi.server)) return this.parent(actor)
        },
    })
})
