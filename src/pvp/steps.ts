import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import { type MultiParty } from '../party/party'

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
        namespace ADD_PLAYERS_TO_PVP {
            interface Settings {
                players: ig.Event.ArrayExpression<dummy.DummyPlayer>
            }
        }
        interface ADD_PLAYERS_TO_PVP extends ig.EventStepBase {
            players: ig.Event.ArrayExpression<dummy.DummyPlayer>
        }
        interface ADD_PLAYERS_TO_PVP_CONSTRUCTOR extends ImpactClass<ADD_PLAYERS_TO_PVP> {
            new (settings: ig.EVENT_STEP.ADD_PLAYERS_TO_PVP.Settings): ADD_PLAYERS_TO_PVP
        }
        var ADD_PLAYERS_TO_PVP: ADD_PLAYERS_TO_PVP_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.ADD_PLAYERS_TO_PVP = ig.EventStepBase.extend({
        init(settings) {
            this.players = settings.players
            assert(this.players, 'ig.EVENT_STEP.ADD_PLAYERS_TO_PVP "players" missing!')
        },
        start() {
            assert(multi.server)
            assert(!sc.pvp.multiplayerPvp, 'Called ig.EVENT_STEP.ADD_PLAYERS_TO_PVP while pvp is running!')

            const parties = new Set<MultiParty>()
            const entities = ig.Event.getArray(this.players).filter(entity => entity instanceof dummy.DummyPlayer)
            for (const party of entities.map(entity => multi.server.party.getPartyOfEntity(entity))) {
                if (party) parties.add(party)
            }
            for (const party of parties) {
                sc.pvp.addParty(party)
            }
        },
    })
})
