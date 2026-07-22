import { runTasks } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../../loading-stages'
import { setNextSetBy, unsetNextSetBy } from './vars'
import { isPhysics } from '../physics-server-types'

declare global {
    namespace ig.ENTITY {
        interface TouchTrigger {
            onFor: Record<number, boolean>
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.TouchTrigger.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.onFor = {}
        },
        update() {
            if (!isPhysics(multi.server) || !ig.ccmap) return this.parent()

            runTasks(ig.ccmap.getClientInstances(), () => {
                this.isOn = this.onFor[instanceinator.id] ??= false
                this.parent()
                this.onFor[instanceinator.id] = this.isOn
                this.isOn = false
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
