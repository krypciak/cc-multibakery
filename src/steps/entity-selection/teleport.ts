import { prestart } from '../../loading-stages'
import { defaultSelectionName } from './entity-selection'
import { MarkerLike } from '../../server/ccmap/teleport-fix'
import { assert } from '../../misc/assert'

declare global {
    namespace ig.EVENT_STEP {
        namespace TELEPORT_SELECTED_ENTITIES {
            interface Settings {
                marker: string
                selectionName?: string
                bulk?: boolean
            }
        }
        interface TELEPORT_SELECTED_ENTITIES extends ig.EventStepBase {
            marker: string
            selectionName: string
            bulk?: boolean
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
            this.selectionName = settings.selectionName ?? defaultSelectionName
            this.bulk = settings.bulk
            assert(this.marker)
        },
        start(_data, eventCall) {
            assert(eventCall)

            eventCall.runForSelection(this.selectionName, this.bulk, (name, suffix) => {
                const markerName = `${this.marker}${suffix}`
                const marker = ig.game.namedEntities[markerName] as MarkerLike
                assert(marker)
                assert(marker.applyMarkerPosition)
                const entities = eventCall.getSelectedEntities(name)

                for (const entity of entities) {
                    marker.applyMarkerPosition(entity)
                }
            })
        },
    })
})
