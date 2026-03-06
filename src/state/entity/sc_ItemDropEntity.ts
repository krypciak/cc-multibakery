import { assert } from '../../misc/assert'
import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { createFakeEffectSheet } from '.././entity'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././states'
import type { u8 } from 'ts-binarifier/src/type-aliases'
import type { ItemType } from '../../net/binary/binary-types'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace sc {
        interface ItemDropEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.ItemDropEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.ItemDropEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    const dropType = Object.entriesT(sc.ITEM_DROP_TYPE).find(([_, v]) => v == this.dropType)![0]

    return {
        pos: memory.diffVec3(this.coll.pos),

        dropType: memory.onlyOnce(dropType),
        item: memory.onlyOnce(this.item as ItemType),
        target: memory.onlyOnce(this.target.netid),
        amount: memory.onlyOnce(this.amount) as u8,
    }
}

function setEntityState(this: sc.ItemDropEntity, state: Return) {
    if (state.pos) this.setPos(state.pos.x, state.pos.y, state.pos.z)
}

prestart(() => {
    sc.ItemDropEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.ItemDropEntity.create = (netid, state: Return) => {
        if (state.dropType === undefined) return
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
    registerNetEntity({ entityClass: sc.ItemDropEntity, ignoreDeath: true })

    sc.ItemDropEntity.forceRemotePhysics = true

    if (!REMOTE) return

    sc.ItemDropEntity.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            if (!isRemote(multi.server)) return
            this.effects = createFakeEffectSheet()
        },
        collectItem(count) {
            if (!isRemote(multi.server)) return this.parent(count)
            const backup = sc.model.player.addItem
            sc.model.player.addItem = () => {}
            this.parent(count)
            sc.model.player.addItem = backup
        },
    })
}, 2)
