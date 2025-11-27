import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { MultiPartyId } from '../../party/party'

declare global {
    namespace ig.EVENT_STEP {
        namespace PARTY_TO_SELECTION {
            interface Settings {
                partyId: ig.Event.VarExpression<MultiPartyId>
                selectionName?: string
            }
        }
        interface PARTY_TO_SELECTION extends ig.EventStepBase {
            partyId: ig.Event.VarExpression<MultiPartyId>
            selectionName?: string
        }
        interface PARTY_TO_SELECTION_CONSTRUCTOR extends ImpactClass<PARTY_TO_SELECTION> {
            new (settings: ig.EVENT_STEP.PARTY_TO_SELECTION.Settings): PARTY_TO_SELECTION
        }
        var PARTY_TO_SELECTION: PARTY_TO_SELECTION_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.PARTY_TO_SELECTION = ig.EventStepBase.extend({
        init(settings) {
            this.partyId = settings.partyId
            this.selectionName = settings.selectionName
            assert(this.partyId, 'ig.EVENT_STEP.PARTY_TO_SELECTION "partyId" missing!')
        },
        start(_data, eventCall) {
            assert(multi.server, 'ig.EVENT_STEP.PARTY_TO_SELECTION ran in a non multiplayer context!')
            assert(eventCall)

            const partyId: MultiPartyId = ig.Event.getExpressionValue(this.partyId)
            const party = multi.server.party.parties[partyId]
            assert(party, `ig.EVENT_STEP.PARTY_TO_SELECTION party: ${partyId} not found!`)

            const entities = multi.server.party.getPartyCombatants(party)

            eventCall.selectEntities(entities, this.selectionName)
        },
    })
})
