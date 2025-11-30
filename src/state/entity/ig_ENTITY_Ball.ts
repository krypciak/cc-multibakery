import { assert } from '../../misc/assert'
import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { resolveProxyFromType } from './proxy-util'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace ig.ENTITY {
        interface Ball extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Ball': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Ball, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    const combatant = this.getCombatantRoot()
    assert(combatant)
    return {
        combatant: memory.onlyOnce(combatant.netid),
        proxyType: memory.onlyOnce(this.proxyType),
        vel: memory.diffVec3(this.coll.vel),
        pos: memory.diffVec3(this.coll.pos),
    }
}
function setState(this: ig.ENTITY.Ball, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)
    if (state.vel) Vec3.assign(this.coll.vel, state.vel)
}

prestart(() => {
    let ignoreNetidCall = false
    ig.ENTITY.Ball.inject({
        getState,
        setState,
        createNetid() {
            if (ignoreNetidCall) return
            return this.parent()
        },
        init(x, y, z, settings) {
            ignoreNetidCall = true
            this.parent(x, y, z, settings)
            ignoreNetidCall = false
            /* ig.ENTITY.Ball creates a new settings object so netid doesnt get set */
            this.setNetid(settings.netid)
        },
    })

    ig.ENTITY.Ball.create = (netid: EntityNetid, state: Return) => {
        assert(!ig.game.entitiesByNetid[netid])

        assert(state.proxyType)
        const proxy = resolveProxyFromType(state.proxyType)
        assert(proxy instanceof sc.BallInfo)
        const ballInfo: sc.BallInfo.Data = proxy.data

        assert(state.combatant)
        const combatant = ig.game.entitiesByNetid[state.combatant]
        assert(combatant)
        assert(combatant instanceof ig.ENTITY.Combatant)
        assert(combatant.params)

        assert(state.vel)

        const settings: ig.ENTITY.Ball.Settings = {
            dir: state.vel,
            ballInfo,
            params: combatant.params,
            party: combatant.party,
            combatant,
            netid,
        }

        const ball = ig.game.spawnEntity(ig.ENTITY.Ball, 0, 0, 0, settings)
        return ball
    }
    registerNetEntity({ entityClass: ig.ENTITY.Ball })

    if (REMOTE) {
        ig.ENTITY.Ball.inject({
            update() {
                if (!isRemote(multi.server)) return this.parent()

                ig.ENTITY.Projectile.prototype.update.call(this)
            },
            onBounce(pos, collData) {
                if (!isRemote(multi.server)) return this.parent(pos, collData)
            },
        })
    }
    if (PHYSICSNET) {
        ig.ENTITY.Ball.inject({
            setBallInfo(ballInfo, setFactors) {
                if (!isRemote(multi.server)) return this.parent(ballInfo, setFactors)

                ig.ignoreEffectNetid = true
                this.parent(ballInfo, setFactors)
                ig.ignoreEffectNetid = false
            },
        })
    }
}, 2)
