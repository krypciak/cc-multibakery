import { entityIgnoreDeath } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { getEntityTypeId } from '../entity'
import { shouldCollectStateData } from '../state-util'
import { addStateHandler } from '../states'

declare global {
    interface StateUpdatePacket {
        entityDeaths?: string[]
    }
    namespace ig {
        var entityDeaths: string[] | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet) {
            packet.entityDeaths = ig.entityDeaths
        },
        clear() {
            ig.entityDeaths = undefined
        },
        set(packet) {
            if (!packet.entityDeaths) return

            for (const netid of packet.entityDeaths) {
                const entity = ig.game.entitiesByNetid[netid]
                if (!entity) {
                    // console.warn('tried to kill entity', netid, 'but not found!')
                    continue
                }
                entity.kill()
            }
        },
    })

    if (!PHYSICSNET) return

    ig.Entity.inject({
        kill(levelChange) {
            this.parent(levelChange)
            if (!this.netid || !shouldCollectStateData()) return
            if (entityIgnoreDeath.has(getEntityTypeId(this.netid))) return

            ig.entityDeaths ??= []
            ig.entityDeaths.push(this.netid)
        },
    })
}, 3)
