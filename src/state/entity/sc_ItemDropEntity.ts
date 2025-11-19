import { assert } from '../../misc/assert'
import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { createFakeEffectSheet } from '.././entity'
import { StateMemory } from '.././state-util'
import { StateKey } from '.././states'
import { u10, u8 } from 'ts-binarifier/src/type-aliases'

declare global {
    namespace sc {
        interface ItemDropEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.ItemDropEntity': Return
    }
}

export type ItemType = u10

type Return = ReturnType<typeof getState>
function getState(this: sc.ItemDropEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    const dropType = Object.entriesT(sc.ITEM_DROP_TYPE).find(([_, v]) => v == this.dropType)![0]

    return {
        pos: memory.diffVec3(this.coll.pos),

        dropType: memory.onlyOnce(dropType),
        item: memory.onlyOnce(this.item) as ItemType,
        target: memory.onlyOnce(this.target.netid),
        amount: memory.onlyOnce(this.amount) as u8,
    }
}

function setState(this: sc.ItemDropEntity, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)
}

prestart(() => {
    sc.ItemDropEntity.inject({
        getState,
        setState,
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
    registerNetEntity({ entityClass: sc.ItemDropEntity, ignoreDeath: true })

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
