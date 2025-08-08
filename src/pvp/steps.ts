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

declare global {
    namespace ig.EVENT_STEP {
        namespace CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS {
            interface Settings {
                selectionPrefix: string
            }
        }
        interface CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS extends ig.EventStepBase {
            selectionPrefix: string
        }
        interface CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS_CONSTRUCTOR
            extends ImpactClass<CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS> {
            new (
                settings: ig.EVENT_STEP.CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS.Settings
            ): CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS
        }
        var CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS: CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.CONSTRUCT_PVP_TEAMS_FROM_ENTITY_SELECTIONS = ig.EventStepBase.extend({
        init(settings) {
            this.selectionPrefix = settings.selectionPrefix
            assert(this.selectionPrefix)
        },
        start(_data, eventCall) {
            assert(multi.server)
            assert(eventCall)

            eventCall.runForSelection(this.selectionPrefix, true, name => {
                const entities = eventCall.getSelectedEntities(name)
                const players = entities.filter(entity => entity instanceof dummy.DummyPlayer) as dummy.DummyPlayer[]
                if (players.length == 0) return
                sc.pvp.addPvpTeam(name, players)
            })
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS {
            interface Settings {}
        }
        interface CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS extends ig.EventStepBase {}
        interface CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS_CONSTRUCTOR
            extends ImpactClass<CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS> {
            new (
                settings: ig.EVENT_STEP.CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS.Settings
            ): CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS
        }
        var CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS: CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.CONSTRUCT_ENTITY_SELECTIONS_FROM_PVP_TEAMS = ig.EventStepBase.extend({
        start(_data, eventCall) {
            assert(multi.server)
            assert(eventCall)

            for (const team of sc.pvp.teams) {
                const selectionName = team.name

                eventCall.selectEntities(team.players, selectionName)
            }
        },
    })
})
