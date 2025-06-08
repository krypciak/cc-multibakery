import { assert } from '../../misc/assert'
import { EntityTypeId, registerEntityTypeId } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { isSameAsLast } from './entity'
import { TemporarySet } from './ig_ENTITY_Effect'

declare global {
    namespace ig.ENTITY {
        interface Ball {
            getState(this: this, full: boolean): Return
            setState(this: this, state: Return): void

            lastSent?: Return
        }
        interface BallConstructor {
            create(uuid: string, state: Return): ig.ENTITY.Ball | undefined
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Ball, full: boolean) {
    const combatant = this.getCombatantRoot()
    assert(combatant)
    return {
        ...(!(this as any).lastSent || full
            ? {
                  combatant: combatant.uuid,
                  proxyType: this.proxyType,
                  dir: this.coll.vel,
              }
            : {}),
        pos: isSameAsLast(this, full, this.coll.pos, 'pos'),
    }
}
function setState(this: ig.ENTITY.Ball, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)
    this.update()
}

prestart(() => {
    const typeId: EntityTypeId = 'ba'
    let ballId = 0
    ig.ENTITY.Ball.inject({
        getState,
        setState,
        createUuid() {
            return `${typeId}${ballId++}`
        },
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            /* ig.ENTITY.Ball creates a new settings object so uuid doesnt get set */
            this.setUuid(x, y, z, settings)
        },
    })

    const allBallsUuidSpawned = new TemporarySet<string>(200)
    ig.ENTITY.Ball.create = (uuid: string, state) => {
        if (allBallsUuidSpawned.has(uuid)) return
        allBallsUuidSpawned.push(uuid)

        assert(!ig.game.entitiesByUUID[uuid])

        assert(state.proxyType)
        const proxy = resolveProxyFromType(state.proxyType)
        assert(proxy instanceof sc.BallInfo)
        const ballInfo: sc.BallInfo.Data = proxy.data

        assert(state.combatant)
        const combatant = ig.game.entitiesByUUID[state.combatant]
        assert(combatant)
        assert(combatant instanceof ig.ENTITY.Combatant)

        assert(state.dir)

        const settings: ig.ENTITY.Ball.Settings = {
            dir: state.dir,
            ballInfo,
            params: combatant.params,
            party: combatant.party,
            combatant,
            uuid,
        }

        const ball = ig.game.spawnEntity(ig.ENTITY.Ball, 0, 0, 0, settings)
        return ball
    }
    registerEntityTypeId(ig.ENTITY.Ball, typeId, undefined, true)

    ig.ENTITY.Ball.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState) return

            this.parent()
        },
    })
}, 2)

declare global {
    namespace sc {
        interface ProxySpawnerBase {
            proxyType?: string
        }
    }
}

const proxyTypeToSpawner: Map<string, sc.ProxySpawnerBase> = new Map()
function addProxy(key: string, proxy: sc.ProxySpawnerBase) {
    proxy.proxyType = key
    proxyTypeToSpawner.set(key, proxy)
}

prestart(() => {
    for (const element of Object.values(sc.ELEMENT).map(Number) as sc.ELEMENT[]) {
        addProxy(`assault${element}`, sc.ASSAULT_PROJECTILES[element])
    }

    sc.PlayerConfig.inject({
        onload(data) {
            this.parent(data)
            for (const key in this.proxies) {
                addProxy(`${this.name}_${key}`, this.proxies[key])
            }
        },
    })
})

export function resolveProxyFromType(key: string): sc.ProxySpawnerBase {
    if (!key) throw new Error(`Proxy key undefined!`)
    const proxy = proxyTypeToSpawner.get(key)
    assert(proxy)
    return proxy
}

declare global {
    namespace ig.ENTITY {
        interface Ball {
            proxyType: string
        }
    }
}
prestart(() => {
    sc.BallInfo.inject({
        spawn(x, y, z, entity, dir) {
            const ball = this.parent(x, y, z, entity, dir)
            ball.proxyType = this.proxyType!
            if (!ball.proxyType) {
                console.warn('sc.BallInfo#proxyType is undefined!')
                debugger
            }
            return ball
        },
    })
})
