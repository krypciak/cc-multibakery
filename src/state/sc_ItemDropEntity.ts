import { assert } from '../misc/assert'
import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { RemoteServer } from '../server/remote/remote-server'
import { createFakeEffectSheet } from './entity'
import { isSameAsLast } from './state-util'

declare global {
    namespace sc {
        interface ItemDropEntity {
            lastSent?: Return
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: sc.ItemDropEntity, full: boolean) {
    if (!this.lastSent || full) {
        return {
            pos: this.coll.pos,
            dropType: Object.entriesT(sc.ITEM_DROP_TYPE).find(([_, v]) => v == this.dropType)![0],
            item: this.item,
            target: this.target.netid,
            amount: this.amount,
        }
    } else {
        return {
            pos: isSameAsLast(this, full, this.coll.pos, 'pos', Vec3.equal, Vec3.create),
        }
    }
}

function setState(this: sc.ItemDropEntity, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)
}

prestart(() => {
    const typeId: EntityTypeId = 'it'
    let counter = 0
    sc.ItemDropEntity.inject({
        getState,
        setState,
        createNetid() {
            return `${typeId}${counter++}`
        },
    })
    sc.ItemDropEntity.create = (netid, state: Return) => {
        assert(state.dropType !== undefined)
        assert(state.item !== undefined)
        assert(state.amount !== undefined)
        assert(state.target)
        const target = ig.game.entitiesByNetid[state.target]
        assert(target)

        const settings: sc.ItemDropEntity.Settings = {
            netid,
            dropType: sc.ITEM_DROP_TYPE[state.dropType],
            item: state.item,
            target,
            amount: state.amount,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.ItemDropEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.ItemDropEntity, typeId })

    sc.ItemDropEntity.forceRemotePhysics = true

    if (!REMOTE) return

    sc.ItemDropEntity.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            if (!(multi.server instanceof RemoteServer)) return
            this.effects = createFakeEffectSheet()
        },
        collectItem(count) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(count)
            const backup = sc.model.player.addItem
            sc.model.player.addItem = () => {}
            this.parent(count)
            sc.model.player.addItem = backup
        },
    })
}, 2)
