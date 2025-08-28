import { prestart } from '../../loading-stages'
import { RemoteServer } from './remote-server'

declare global {
    interface ImpactClass<Instance> {
        forceRemotePhysics?: boolean
    }
}

prestart(() => {
    if (!REMOTE) return

    function shouldUpdatePhysicsOn(entity: ig.Entity): boolean | undefined {
        if (!(multi.server instanceof RemoteServer)) return true

        const clazz = ig.classIdToClass[entity.classId]
        return clazz.forceRemotePhysics
    }
    ig.CollEntry.inject({
        update() {
            if (!shouldUpdatePhysicsOn(this.entity)) return
            this.parent()
        },
    })
    ig.Physics.inject({
        moveEntity(coll, collisionList) {
            if (!shouldUpdatePhysicsOn(coll.entity)) return
            this.parent(coll, collisionList)
        },
    })
})
