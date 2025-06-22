import { assert } from '../misc/assert'
import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { PhysicsServer } from '../server/physics/physics-server'
import { RemoteServer } from '../server/remote/remote-server'
import { addStateHandler } from './states'
import { isSameAsLast } from './state-util'
import { resolveProxyFromType } from './proxy-util'

declare global {
    namespace sc {
        interface CombatProxyEntity {
            lastSent?: Return
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: sc.CombatProxyEntity, full: boolean) {
    /* TODO: uhhhhhhh pos is probably set in update call */
    return {
        ...(!(this as any).lastSent || full
            ? {
                  proxyType: this.proxyType,
                  combatant: this.combatant.netid,
              }
            : {}),
        pos: isSameAsLast(this, true, this.coll.pos, 'pos', Vec3.equal, Vec3.create),
        dir: isSameAsLast(this, true, this.face, 'dir', Vec2.equal, Vec2.create),
    }
}
function setState(this: sc.CombatProxyEntity, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)
    if (state.dir) Vec2.assign(this.face, state.dir)

    this.update()
}

prestart(() => {
    const typeId: EntityTypeId = 'cp'
    let proxyId = 0
    sc.CombatProxyEntity.inject({
        getState,
        setState,
        createNetid() {
            return `${typeId}${multi.server instanceof PhysicsServer ? 'P' : 'R'}${proxyId++}`
        },
    })

    sc.CombatProxyEntity.create = (netid: string, state: Return) => {
        assert(state.pos)
        assert(state.combatant)
        assert(state.proxyType)
        assert(state.dir)

        const { x, y, z } = state.pos

        const combatant = ig.game.entitiesByNetid[state.combatant]
        assert(combatant, `target not found:  ${state.combatant}`)
        assert(combatant instanceof sc.BasicCombatant)

        const proxy = resolveProxyFromType(state.proxyType)
        assert(proxy instanceof sc.PROXY_TYPE.GENERIC)
        const data: sc.CombatProxyEntity.Data = proxy.data

        const settings: sc.CombatProxyEntity.Settings = {
            netid,
            dir: state.dir,
            combatant,
            data,
        }
        assert(!ig.game.entitiesByNetid[netid])
        const entity = ig.game.spawnEntity(sc.CombatProxyEntity, x, y, z, settings)
        assert(ig.game.entitiesByNetid[netid])

        return entity
    }
    registerNetEntity({ entityClass: sc.CombatProxyEntity, typeId, sendEmpty: true })
}, 2)

declare global {
    interface StateUpdatePacket {
        destroyCombatProxies?: string[]
    }
    namespace ig {
        var destroyCombatProxies: string[] | undefined
    }
}
prestart(() => {
    addStateHandler({
        get(packet) {
            packet.destroyCombatProxies = ig.destroyCombatProxies
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
    let ignoreDestroy = false
    sc.CombatProxyEntity.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState && !ig.lastStatePacket?.states?.[this.netid]) return

            ignoreDestroy = true
            this.parent()
            ignoreDestroy = false
        },
        destroy(type) {
            if (multi.server instanceof PhysicsServer && !this.destroyType) {
                ig.destroyCombatProxies ??= []
                ig.destroyCombatProxies.push(this.netid)
            } else if (multi.server instanceof RemoteServer) {
                if (ignoreDestroy) return
            }
            this.parent(type)
        },
    })
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
        spawn(x, y, z, entity, dir, noAddStats) {
            const proxy = this.parent(x, y, z, entity, dir, noAddStats)
            proxy.proxyType = this.proxyType!
            if (!proxy.proxyType) {
                console.warn('sc.PROXY_TYPE.GENERIC#proxyType is undefined!')
                debugger
            }
            return proxy
        },
    })
})

prestart(() => {
    ig.ACTION_STEP.SHOW_EFFECT.inject({
        start(actor: ig.ActorEntity) {
            /* dont spawn proxies on remote server because ig.ENTITY.Effect is already being handled */
            if (!(multi.server instanceof RemoteServer)) return this.parent(actor)
        },
    })
})
