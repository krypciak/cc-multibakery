import { registerNetEntity } from '../../misc/entity-netid'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import { prestart } from '../../loading-stages'
import { isPhysics } from '../../server/physics/physics-server-types'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import * as igEntity from './ig_Entity-base'
import { isRemote } from '../../server/remote/remote-server-types'

declare global {
    namespace ig.ENTITY {
        interface Elevator extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Elevator': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.Elevator, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.Elevator, state: Return) {
    igEntity.setEntityState.call(this, state)
}

export function register() {
    ig.ENTITY.Elevator.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.Elevator.create = () => {
        throw new Error('ig.ENTITY.Elevator.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Elevator })
}

prestart(() => {
    ig.ENTITY.Elevator.inject({
        pressSwitch() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })
})

declare global {
    namespace ig.ENTITY {
        interface Elevator {
            preMoveZ?: number
            lastUsedPlayers?: string[]
        }
    }
}
prestart(() => {
    let noRecursve = false
    ig.ENTITY.Elevator.inject({
        moveToDestination(destinationIndex) {
            this.preMoveZ = this.coll.pos.z
            return this.parent(destinationIndex)
        },
        performTeleport(destination) {
            this.parent(destination)
            if (!multi.server || noRecursve) return

            const clients = ig.mapShared.ccmap.clients.filter(c => {
                const ground = c.dummy?.coll._collData.groundEntry
                return ground && ground.entity == this
            })

            for (const client of clients) {
                if (client == ig.client) continue
                try {
                    noRecursve = true
                    runTask(client.inst, () => this.performTeleport(destination))
                } finally {
                    noRecursve = false
                }
            }

            assert(ig.client)
            if (this.doTeleport) {
                this.lastUsedPlayers = clients.map(p => p.username)
                for (const client of clients) {
                    const relativePos = Vec2.sub(Vec2.create(this.getCenter()), client.dummy.getCenter())
                    relativePos.x = relativePos.x.limit(-this.coll.size.x / 2.2, this.coll.size.x / 2.2)
                    relativePos.y = relativePos.y.limit(-this.coll.size.y / 2, this.coll.size.y / 2)
                    client.teleportOverrides.pos = () => {
                        const newPos = Vec2.sub(Vec2.create(client.dummy.coll.pos), relativePos)
                        return newPos
                    }
                }
            }
        },
        update() {
            this.parent()
            if (!isPhysics(multi.server) || !this.lastUsedPlayers) return

            if (this.targetZ !== undefined && this.targetZ !== null && Math.abs(this.targetZ - this.coll.pos.z) < 1) {
                for (const username of this.lastUsedPlayers) {
                    const client = multi.server.clients.get(username)
                    if (!client) continue
                    runTask(client.inst, () => sc.elevatorModel.endMoveSound(this.sounds.end))
                }
                this.lastUsedPlayers = undefined
                this.coll.vel.z = 0
                this.targetZ = null
                this.setZPos(this.preMoveZ!)
                this.switchEntity.setMoving(false)
            }
        },
    })
})
