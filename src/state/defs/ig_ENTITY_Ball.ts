import { assert } from '../../misc/assert'
import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { TemporarySet } from '../../misc/temporary-set'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { isSameAsLast } from './entity'
import { resolveProxyFromType } from './proxy-util'

declare global {
    namespace ig.ENTITY {
        interface Ball {
            lastSent?: Return
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
                  combatant: combatant.netid,
                  proxyType: this.proxyType,
                  dir: this.coll.vel,
              }
            : {}),
        pos: isSameAsLast(this, full, this.coll.pos, 'pos', Vec3.equal, Vec3.create),
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

    const allBallsNetidSpawned = new TemporarySet<string>(200)
    ig.ENTITY.Ball.create = (netid: string, state: Return) => {
        if (allBallsNetidSpawned.has(netid)) return
        allBallsNetidSpawned.push(netid)

        assert(!ig.game.entitiesByNetid[netid])

        assert(state.proxyType)
        const proxy = resolveProxyFromType(state.proxyType)
        assert(proxy instanceof sc.BallInfo)
        const ballInfo: sc.BallInfo.Data = proxy.data

        assert(state.combatant)
        const combatant = ig.game.entitiesByNetid[state.combatant]
        assert(combatant)
        assert(combatant instanceof ig.ENTITY.Combatant)

        assert(state.dir)

        const settings: ig.ENTITY.Ball.Settings = {
            dir: state.dir,
            ballInfo,
            params: combatant.params,
            party: combatant.party,
            combatant,
            netid: netid,
        }

        const ball = ig.game.spawnEntity(ig.ENTITY.Ball, 0, 0, 0, settings)
        return ball
    }
    registerNetEntity({ entityClass: ig.ENTITY.Ball, typeId, sendEmpty: true })

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
}, 2)

