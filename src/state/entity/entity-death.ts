import { entityIgnoreDeath, entityNetidStatic } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { getEntityTypeId } from '../entity'
import { shouldCollectStateData } from '../state-util'
import { addStateHandler, StateKey } from '../states'

declare global {
    interface StateUpdatePacket {
        entityDeaths?: string[]
    }
    namespace ig {
        var entityDeaths: string[] | undefined
        var entityDeathsStatic: string[]
        var entityDeathsStaticEverSent: Set<StateKey>
    }
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            packet.entityDeaths = ig.entityDeaths

            ig.entityDeathsStaticEverSent ??= new Set()
            if (ig.entityDeathsStatic && (!player || !ig.entityDeathsStaticEverSent.has(player))) {
                if (player) ig.entityDeathsStaticEverSent.add(player)

                packet.entityDeaths ??= []
                packet.entityDeaths.push(...ig.entityDeathsStatic)
            }
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
            if (!this.netid) return
            const typeId = getEntityTypeId(this.netid)
            if (entityIgnoreDeath.has(typeId)) return

            if (shouldCollectStateData()) {
                ig.entityDeaths ??= []
                ig.entityDeaths.push(this.netid)
            }

            if (entityNetidStatic.has(typeId)) {
                ig.entityDeathsStatic ??= []
                ig.entityDeathsStatic.push(this.netid)
            }
        },
    })
}, 3)
