import { prestart } from '../../loading-stages'
import { MarkerLike } from '../../server/ccmap/teleport-fix'
import { assert } from '../../misc/assert'

declare global {
    namespace ig.EVENT_STEP {
        namespace TELEPORT_SELECTED_ENTITIES {
            interface Settings {
                marker: string
                selectionName?: string
            }
        }
        interface TELEPORT_SELECTED_ENTITIES extends ig.EventStepBase {
            marker: string
            selectionName?: string
        }
        interface TELEPORT_SELECTED_ENTITIES_CONSTRUCTOR extends ImpactClass<TELEPORT_SELECTED_ENTITIES> {
            new (settings: ig.EVENT_STEP.TELEPORT_SELECTED_ENTITIES.Settings): TELEPORT_SELECTED_ENTITIES
        }
        var TELEPORT_SELECTED_ENTITIES: TELEPORT_SELECTED_ENTITIES_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.TELEPORT_SELECTED_ENTITIES = ig.EventStepBase.extend({
        init(settings) {
            this.marker = settings.marker
            this.selectionName = settings.selectionName
            assert(this.marker, 'ig.EVENT_STEP.TELEPORT_SELECTED_ENTITIES marker missing!')
        },
        start(_data, eventCall) {
            assert(eventCall)

            const marker = ig.game.namedEntities[this.marker] as MarkerLike
            assert(marker)
            assert(marker.applyMarkerPosition)
            const entities = eventCall.getSelectedEntities(this.selectionName)

            for (const entity of entities) {
                if (!(entity instanceof ig.ActorEntity)) continue
                marker.applyMarkerPosition(entity)
            }
        },
    })
})
