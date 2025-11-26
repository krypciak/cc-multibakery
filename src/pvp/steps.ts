import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import { MultiParty } from '../party/party'

declare global {
    namespace ig.EVENT_STEP {
        namespace START_MULTIPLAYER_PVP_BATTLE {
            interface Settings {
                winPoints: ig.Event.NumberExpression
            }
        }
        interface START_MULTIPLAYER_PVP_BATTLE extends ig.EventStepBase {
            winPoints: ig.Event.NumberExpression
        }
        interface START_MULTIPLAYER_PVP_BATTLE_CONSTRUCTOR extends ImpactClass<START_MULTIPLAYER_PVP_BATTLE> {
            new (settings: ig.EVENT_STEP.START_MULTIPLAYER_PVP_BATTLE.Settings): START_MULTIPLAYER_PVP_BATTLE
        }
        var START_MULTIPLAYER_PVP_BATTLE: START_MULTIPLAYER_PVP_BATTLE_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.START_MULTIPLAYER_PVP_BATTLE = ig.EventStepBase.extend({
        init(settings) {
            this.winPoints = settings.winPoints
        },
        start(_data, _eventCall) {
            assert(multi.server)
            const winPoints = Number(ig.Event.getExpressionValue(this.winPoints))
            assert(winPoints)
            sc.pvp.startMultiplayerPvp(winPoints)
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace CLEAR_MULTIPLAYER_PVP_PARTIES {
            interface Settings {}
        }
        interface CLEAR_MULTIPLAYER_PVP_PARTIES extends ig.EventStepBase {}
        interface CLEAR_MULTIPLAYER_PVP_PARTIES_CONSTRUCTOR extends ImpactClass<CLEAR_MULTIPLAYER_PVP_PARTIES> {
            new (settings: ig.EVENT_STEP.CLEAR_MULTIPLAYER_PVP_PARTIES.Settings): CLEAR_MULTIPLAYER_PVP_PARTIES
        }
        var CLEAR_MULTIPLAYER_PVP_PARTIES: CLEAR_MULTIPLAYER_PVP_PARTIES_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.CLEAR_MULTIPLAYER_PVP_PARTIES = ig.EventStepBase.extend({
        start(_data, _eventCall) {
            assert(multi.server)

            sc.pvp.clearParties()
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace ADD_SELECTED_PARTIES_TO_PVP_PARTIES {
            interface Settings {
                selectionName?: string
            }
        }
        interface ADD_SELECTED_PARTIES_TO_PVP_PARTIES extends ig.EventStepBase {
            selectionName?: string
        }
        interface ADD_SELECTED_PARTIES_TO_PVP_PARTIES_CONSTRUCTOR
            extends ImpactClass<ADD_SELECTED_PARTIES_TO_PVP_PARTIES> {
            new (
                settings: ig.EVENT_STEP.ADD_SELECTED_PARTIES_TO_PVP_PARTIES.Settings
            ): ADD_SELECTED_PARTIES_TO_PVP_PARTIES
        }
        var ADD_SELECTED_PARTIES_TO_PVP_PARTIES: ADD_SELECTED_PARTIES_TO_PVP_PARTIES_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.ADD_SELECTED_PARTIES_TO_PVP_PARTIES = ig.EventStepBase.extend({
        init(settings) {
            this.selectionName = settings.selectionName
        },
        start(_data, eventCall) {
            assert(multi.server)
            assert(eventCall)

            const parties = new Set<MultiParty>()
            const entities = eventCall.getSelectedEntities(this.selectionName)
            for (const party of entities.map(entity => multi.server.party.getPartyOfEntity(entity))) {
                if (party) parties.add(party)
            }
            for (const party of parties) {
                sc.pvp.addParty(party)
            }
        },
    })
})
