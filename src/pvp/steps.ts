import { assert } from '../misc/assert'
import { prestart } from '../plugin'

declare global {
    namespace ig.EVENT_STEP {
        namespace START_MULTIPLAYER_PVP_BATTLE {
            interface Settings {
                winPoints: ig.Event.NumberExpression
            }
        }
        interface START_MULTIPLAYER_PVP_BATTLE extends ig.EventStepBase {
            winPoints: ig.Event.NumberExpression
            // entity: unknown
            // enemies: ig.Event.GetEntity[]
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
        namespace ADD_MULTIPLAYER_PVP_TEAM {
            interface Settings {
                name: ig.Event.StringExpression
                players: ig.Event.GetEntity[]
            }
        }
        interface ADD_MULTIPLAYER_PVP_TEAM extends ig.EventStepBase {
            name: ig.Event.StringExpression
            players: ig.Event.GetEntity[]
        }
        interface ADD_MULTIPLAYER_PVP_TEAM_CONSTRUCTOR extends ImpactClass<ADD_MULTIPLAYER_PVP_TEAM> {
            new (settings: ig.EVENT_STEP.ADD_MULTIPLAYER_PVP_TEAM.Settings): ADD_MULTIPLAYER_PVP_TEAM
        }
        var ADD_MULTIPLAYER_PVP_TEAM: ADD_MULTIPLAYER_PVP_TEAM_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.ADD_MULTIPLAYER_PVP_TEAM = ig.EventStepBase.extend({
        init(settings) {
            this.name = settings.name
            this.players = settings.players
        },
        start(_data, eventCall) {
            assert(multi.server)

            const name = ig.Event.getExpressionValue(this.name)
            const players = this.players.map(player => {
                const entity = ig.Event.getEntity(player, eventCall)
                assert(entity instanceof dummy.DummyPlayer)
                return entity
            })
            sc.pvp.addPvpTeam(name, players)
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace CLEAR_MULTIPLAYER_PVP_TEAMS {
            interface Settings {}
        }
        interface CLEAR_MULTIPLAYER_PVP_TEAMS extends ig.EventStepBase {}
        interface CLEAR_MULTIPLAYER_PVP_TEAMS_CONSTRUCTOR extends ImpactClass<CLEAR_MULTIPLAYER_PVP_TEAMS> {
            new (settings: ig.EVENT_STEP.CLEAR_MULTIPLAYER_PVP_TEAMS.Settings): CLEAR_MULTIPLAYER_PVP_TEAMS
        }
        var CLEAR_MULTIPLAYER_PVP_TEAMS: CLEAR_MULTIPLAYER_PVP_TEAMS_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.CLEAR_MULTIPLAYER_PVP_TEAMS = ig.EventStepBase.extend({
        start(_data, _eventCall) {
            assert(multi.server)

            sc.pvp.clearPvpTeams()
        },
    })
})
