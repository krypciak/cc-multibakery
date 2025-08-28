import { assert } from '../../misc/assert'
import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { resolveProxyFromType } from './proxy-util'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface Ball extends StateMemory.MapHolder<StateKey> {}
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
        dir: memory.onlyOnce(this.coll.vel),
        pos: memory.diffVec3(this.coll.pos),
    }
}
function setState(this: ig.ENTITY.Ball, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)
    this.update()
}

prestart(() => {
    const typeId: EntityTypeId = 'ba'
    let ballId = 0
    let ignoreNetidCall = false
    ig.ENTITY.Ball.inject({
        getState,
        setState,
        createNetid() {
            if (ignoreNetidCall) return
            return `${typeId}${ballId++}`
        },
        init(x, y, z, settings) {
            ignoreNetidCall = true
            this.parent(x, y, z, settings)
            ignoreNetidCall = false
            /* ig.ENTITY.Ball creates a new settings object so netid doesnt get set */
            this.setNetid(x, y, z, settings)
        },
    })

    ig.ENTITY.Ball.create = (netid: string, state: Return) => {
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

        assert(state.dir)

        const settings: ig.ENTITY.Ball.Settings = {
            dir: state.dir,
            ballInfo,
            params: combatant.params,
            party: combatant.party,
            combatant,
            netid,
        }

        const ball = ig.game.spawnEntity(ig.ENTITY.Ball, 0, 0, 0, settings)
        return ball
    }
    registerNetEntity({ entityClass: ig.ENTITY.Ball, typeId, sendEmpty: true })

    if (REMOTE) {
        ig.ENTITY.Ball.inject({
            update() {
                if (!(multi.server instanceof RemoteServer)) return this.parent()
                if (!ig.settingState) return

                this.parent()
            },
            onBounce(pos, collData) {
                if (!(multi.server instanceof RemoteServer)) this.parent(pos, collData)
            },
        })
    }
    if (PHYSICSNET) {
        ig.ENTITY.Ball.inject({
            setBallInfo(ballInfo, setFactors) {
                if (!(multi.server instanceof RemoteServer)) this.parent(ballInfo, setFactors)

                ig.ignoreEffectNetid = true
                this.parent(ballInfo, setFactors)
                ig.ignoreEffectNetid = false
            },
        })
    }
}, 2)
