import { runTasks } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../loading-stages'
import { setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    ig.ENTITY.TouchTrigger.inject({
        update() {
            if (!multi.server || !ig.ccmap) return this.parent()

            runTasks(ig.ccmap.getAllInstances(), () => {
                this.parent()
            })
        },
        setOn() {
            if (!multi.server) return this.parent()
            setNextSetBy(ig.game.playerEntity)
            this.parent()
            unsetNextSetBy()
        },
        setOff() {
            if (!multi.server) return this.parent()
            setNextSetBy(ig.game.playerEntity)
            this.parent()
            unsetNextSetBy()
        },
    })
})
