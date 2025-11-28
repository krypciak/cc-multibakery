import { runTasks } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { PhysicsServer } from '../server/physics/physics-server'
import { runEvent } from './event-steps-run'

declare global {
    namespace ig.EVENT_STEP {
        namespace FOR_EACH_PLAYER {
            interface Settings {
                players: ig.Event.ArrayExpression
                steps: ig.EventStepBase.Settings[]
                indexVarName?: ig.Event.VariableExpression
                noWait?: boolean
            }
            interface Data {
                eventCalls: ig.EventCall[]
            }
        }
        interface FOR_EACH_PLAYER extends ig.EventStepBase {
            players: ig.Event.ArrayExpression
            event: ig.Event
            indexVarName?: ig.Event.VariableExpression
            noWait?: boolean

            start(this: this, data: ig.EVENT_STEP.FOR_EACH_PLAYER.Data, eventCall?: ig.EventCall): void
            run(this: this, data: ig.EVENT_STEP.FOR_EACH_PLAYER.Data): boolean
        }
        interface FOR_EACH_PLAYER_CONSTRUCTOR extends ImpactClass<FOR_EACH_PLAYER> {
            new (settings: ig.EVENT_STEP.FOR_EACH_PLAYER.Settings): FOR_EACH_PLAYER
        }
        var FOR_EACH_PLAYER: FOR_EACH_PLAYER_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.FOR_EACH_PLAYER = ig.EventStepBase.extend({
        init(settings) {
            this.players = settings.players
            this.noWait = settings.noWait
            this.indexVarName = settings.indexVarName

            assert(settings.players, 'ig.EVENT_STEP.FOR_EACH_PLAYER "players" missing!')
            assert(settings.steps, 'ig.EVENT_STEP.FOR_EACH_PLAYER "steps" missing!')
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

            const indexVarName = ig.Event.getVarName(this.indexVarName)

            const entities = ig.Event.getArray(this.players)
            const players = entities.filter(entity => entity instanceof dummy.DummyPlayer) as dummy.DummyPlayer[]

            const clients = players.map(player => player.getClient())
            const eventCalls = runTasks(
                clients.map(client => client.inst),
                i => {
                    if (indexVarName) ig.vars.set(indexVarName, i)
                    return runEvent(this.event, ig.EventRunType.PARALLEL, ig.game.playerEntity, { ...data }, true)
                }
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
