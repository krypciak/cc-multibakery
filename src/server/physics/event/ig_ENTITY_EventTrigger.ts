import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../../loading-stages'
import { isPhysics } from '../physics-server-types'
import { setEventNextTriggeredBy, unsetEventNextTriggeredBy } from './event-manager'
import { findSetByEntityByVars, setNextSetBy, unsetNextSetBy } from './vars'

declare global {
    namespace ig.ENTITY {
        namespace EventTrigger {
            interface Settings {
                forceRunOnMap?: boolean
            }
        }
        interface EventTrigger {
            forceRunOnMap?: boolean
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.EventTrigger.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.forceRunOnMap = settings.forceRunOnMap
        },
        update() {
            if (!isPhysics(multi.server)) return this.parent()

            /* to fix calls from varsChanged */
            const inst = instanceinator.instances[this._instanceId]
            runTask(inst, () => {
                const entities = findSetByEntityByVars(this.startCondition.vars)
                if (entities.length > 0) {
                    const setBy = entities.find(e => e instanceof dummy.DummyPlayer) ?? entities[0]
                    setNextSetBy(setBy)
                }

                if (!this.forceRunOnMap) setEventNextTriggeredBy(this.startCondition)

                this.parent()

                unsetEventNextTriggeredBy()
                unsetNextSetBy()
            })
        },
    })
})
