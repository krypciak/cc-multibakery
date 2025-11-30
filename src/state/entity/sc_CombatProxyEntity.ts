import { assert } from '../../misc/assert'
import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { addStateHandler } from '../states'
import { shouldCollectStateData, StateMemory } from '../state-util'
import { type StateKey } from '../states'
import { resolveProxyFromType } from './proxy-util'
import * as scActorEntity from './sc_ActorEntity-base'
import { runTaskInMapInst } from '../../client/client'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace sc {
        interface CombatProxyEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.CombatProxyEntity': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: sc.CombatProxyEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...scActorEntity.getState.call(this, memory),
        proxyType: memory.onlyOnce(this.proxyType),
        combatant: memory.onlyOnce(this.combatant.netid),
    }
}
function setState(this: sc.CombatProxyEntity, state: Return) {
    scActorEntity.setState.call(this, state)
}

prestart(() => {
    sc.CombatProxyEntity.inject({
        getState,
        setState,
    })

    sc.CombatProxyEntity.create = (netid: EntityNetid, state: Return) => {
        if (!state.proxyType) return
        assert(state.pos)
        assert(state.combatant)
        assert(state.face)

        const { x, y, z } = state.pos

        const combatant = ig.game.entitiesByNetid[state.combatant]
        assert(combatant, `target not found:  ${state.combatant}`)
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
    registerNetEntity({ entityClass: sc.CombatProxyEntity })

    if (REMOTE) {
        sc.CombatProxyEntity.inject({
            update() {
                if (!isRemote(multi.server)) return this.parent()
                ig.AnimatedEntity.prototype.update.call(this)
            },
        })
    }
}, 2)

declare global {
    interface StateUpdatePacket {
        destroyCombatProxies?: EntityNetid[]
    }
    namespace ig {
        var destroyCombatProxies: EntityNetid[] | undefined
    }
}
prestart(() => {
    addStateHandler({
        get(packet) {
            packet.destroyCombatProxies = ig.destroyCombatProxies
        },
        clear() {
            ig.destroyCombatProxies = undefined
        },
        set(packet) {
            if (!packet.destroyCombatProxies) return
            for (const netid of packet.destroyCombatProxies) {
                const entity = ig.game.entitiesByNetid[netid]
                if (!entity) {
                    continue
                }
                assert(entity instanceof sc.CombatProxyEntity)
                entity.destroy()
            }
        },
    })
    if (PHYSICSNET) {
        sc.CombatProxyEntity.inject({
            destroy(type) {
                if (shouldCollectStateData() && !this.destroyType) {
                    runTaskInMapInst(() => {
                        ig.destroyCombatProxies ??= []
                        ig.destroyCombatProxies.push(this.netid)
                    })
                }
                ig.ignoreEffectNetid = true
                this.parent(type)
                ig.ignoreEffectNetid = false
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
                if (!ig.settingState && !ig.lastStatePacket?.states?.[this.netid]) return

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
