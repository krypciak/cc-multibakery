import { runTasks } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../../loading-stages'
import { setNextSetBy, unsetNextSetBy } from './vars'
import { PhysicsServer } from '../physics-server'

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.TouchTrigger.inject({
        update() {
            if (!(multi.server instanceof PhysicsServer) || !ig.ccmap) return this.parent()

            runTasks(ig.ccmap.getAllInstances(), () => {
                this.parent()
            })
        },
        setOn() {
            if (!(multi.server instanceof PhysicsServer)) return this.parent()
            setNextSetBy(ig.game.playerEntity)
            this.parent()
            unsetNextSetBy()
        },
        setOff() {
            if (!(multi.server instanceof PhysicsServer)) return this.parent()
            setNextSetBy(ig.game.playerEntity)
            this.parent()
            unsetNextSetBy()
        },
    })
})
