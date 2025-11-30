import { runTasks } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../../loading-stages'
import { setNextSetBy, unsetNextSetBy } from './vars'
import { isPhysics } from '../is-physics-server'

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.TouchTrigger.inject({
        update() {
            if (!isPhysics(multi.server) || !ig.ccmap) return this.parent()

            runTasks(ig.ccmap.getAllInstances(), () => {
                this.parent()
            })
        },
        setOn() {
            if (!isPhysics(multi.server)) return this.parent()
            setNextSetBy(ig.game.playerEntity)
            this.parent()
            unsetNextSetBy()
        },
        setOff() {
            if (!isPhysics(multi.server)) return this.parent()
            setNextSetBy(ig.game.playerEntity)
            this.parent()
            unsetNextSetBy()
        },
    })
})
