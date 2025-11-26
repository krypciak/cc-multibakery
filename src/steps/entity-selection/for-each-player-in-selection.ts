import { runTasks } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { PhysicsServer } from '../../server/physics/physics-server'
import { runEvent } from '../event-steps-run'

declare global {
    namespace ig.EVENT_STEP {
        namespace FOR_EACH_PLAYER_IN_SELECTION {
            interface Settings {
                steps: ig.EventStepBase.Settings[]
                selectionName?: string
                noWait?: boolean
            }
            interface Data {
                eventCalls: ig.EventCall[]
            }
        }
        interface FOR_EACH_PLAYER_IN_SELECTION extends ig.EventStepBase {
            selectionName?: string
            event: ig.Event
            noWait?: boolean

            start(this: this, data: ig.EVENT_STEP.FOR_EACH_PLAYER_IN_SELECTION.Data, eventCall?: ig.EventCall): void
            run(this: this, data: ig.EVENT_STEP.FOR_EACH_PLAYER_IN_SELECTION.Data): boolean
        }
        interface FOR_EACH_PLAYER_IN_SELECTION_CONSTRUCTOR extends ImpactClass<FOR_EACH_PLAYER_IN_SELECTION> {
            new (settings: ig.EVENT_STEP.FOR_EACH_PLAYER_IN_SELECTION.Settings): FOR_EACH_PLAYER_IN_SELECTION
        }
        var FOR_EACH_PLAYER_IN_SELECTION: FOR_EACH_PLAYER_IN_SELECTION_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.FOR_EACH_PLAYER_IN_SELECTION = ig.EventStepBase.extend({
        init(settings) {
            this.selectionName = settings.selectionName
            this.noWait = settings.noWait

            assert(settings.steps, 'ig.EVENT_STEP.FOR_EACH_PLAYER_IN_SELECTION "steps" missing!')
            this.event = new ig.Event({ steps: settings.steps })
        },
        getBranchNames() {
            /* only for when multi is not running */
            return ['steps']
        },
        start(data, eventCall) {
            assert(eventCall)

            if (!multi.server) return
            assert(multi.server instanceof PhysicsServer)

            const players = eventCall
                .getSelectedEntities(this.selectionName)
                .filter(entity => entity instanceof dummy.DummyPlayer) as dummy.DummyPlayer[]

            const clients = players.map(player => player.getClient())
            const eventCalls = runTasks(
                clients.map(client => client.inst),
                () =>
                    runEvent(
                        this.event,
                        ig.EventRunType.PARALLEL,
                        ig.game.playerEntity,
                        { ...data },
                        true,
                        newEventCall => {
                            newEventCall.entitySelections = eventCall.entitySelections
                        }
                    )
            )
            data.eventCalls = eventCalls
        },
        run({ eventCalls }) {
            return this.noWait || eventCalls.every(call => call.done)
        },
        getNext() {
            if (!multi.server) return this.branches!['steps']
            return this.parent()
        },
    })
})
