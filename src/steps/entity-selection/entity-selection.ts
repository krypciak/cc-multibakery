import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { runTaskInMapInst } from '../../client/client'

declare global {
    namespace ig {
        interface EventCall {
            entitySelections: Record<string, Set<ig.Entity>>

            selectEntities(this: this, entities: Iterable<ig.Entity>, selectionName?: string): void
            unselectEntities(this: this, entities: Iterable<ig.Entity>, selectionName?: string): void
            clearEntitySelection(this: this, selectionName?: string): void
            getSelectedEntities(this: this, selectionName?: string): ig.Entity[]
        }
    }
}
const defaultSelectionName = 'default'

prestart(() => {
    ig.EventCall.inject({
        selectEntities(entities, selectionName = defaultSelectionName) {
            this.entitySelections ??= {}
            const set = (this.entitySelections[selectionName] ??= new Set())
            for (const entity of entities) set.add(entity)
        },
        unselectEntities(entities, selectionName = defaultSelectionName) {
            this.entitySelections ??= {}
            const set = this.entitySelections[selectionName]
            if (!set) return

            for (const entity of entities) set.delete(entity)
        },
        clearEntitySelection(selectionName = defaultSelectionName) {
            this.entitySelections ??= {}
            this.entitySelections[selectionName] = new Set()
        },
        getSelectedEntities(selectionName = defaultSelectionName) {
            this.entitySelections ??= {}
            return [...(this.entitySelections[selectionName] ?? [])]
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace CLEAR_ENTITY_SELECTION {
            interface Settings {
                selectionName?: string
            }
        }
        interface CLEAR_ENTITY_SELECTION extends ig.EventStepBase {
            selectionName?: string
        }
        interface CLEAR_ENTITY_SELECTION_CONSTRUCTOR extends ImpactClass<CLEAR_ENTITY_SELECTION> {
            new (settings: ig.EVENT_STEP.CLEAR_ENTITY_SELECTION.Settings): CLEAR_ENTITY_SELECTION
        }
        var CLEAR_ENTITY_SELECTION: CLEAR_ENTITY_SELECTION_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.CLEAR_ENTITY_SELECTION = ig.EventStepBase.extend({
        init(settings) {
            this.selectionName = settings.selectionName
        },
        start(_data, eventCall) {
            assert(eventCall)

            eventCall.clearEntitySelection(this.selectionName)
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace SELECT_ENTITIES {
            interface Settings {
                entities: ig.Event.GetEntity[]
                selectionName?: string
            }
        }
        interface SELECT_ENTITIES extends ig.EventStepBase {
            entities: ig.Event.GetEntity[]
            selectionName?: string
        }
        interface SELECT_ENTITIES_CONSTRUCTOR extends ImpactClass<SELECT_ENTITIES> {
            new (settings: ig.EVENT_STEP.SELECT_ENTITIES.Settings): SELECT_ENTITIES
        }
        var SELECT_ENTITIES: SELECT_ENTITIES_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.SELECT_ENTITIES = ig.EventStepBase.extend({
        init(settings) {
            this.entities = settings.entities
            this.selectionName = settings.selectionName
            assert(this.entities, 'ig.EVENT_STEP.SELECT_ENTITIES "entities" missing!')
        },
        start(_data, eventCall) {
            assert(eventCall)

            eventCall.selectEntities(
                this.entities.map(config => ig.Event.getEntity(config)).filter(Boolean) as ig.Entity[],
                this.selectionName
            )
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace UNSELECT_ENTITIES {
            interface Settings {
                entities: ig.Event.GetEntity[]
                selectionName?: string
            }
        }
        interface UNSELECT_ENTITIES extends ig.EventStepBase {
            entities: ig.Event.GetEntity[]
            selectionName?: string
        }
        interface UNSELECT_ENTITIES_CONSTRUCTOR extends ImpactClass<UNSELECT_ENTITIES> {
            new (settings: ig.EVENT_STEP.UNSELECT_ENTITIES.Settings): UNSELECT_ENTITIES
        }
        var UNSELECT_ENTITIES: UNSELECT_ENTITIES_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.UNSELECT_ENTITIES = ig.EventStepBase.extend({
        init(settings) {
            this.entities = settings.entities
            this.selectionName = settings.selectionName
            assert(this.entities, 'ig.EVENT_STEP.UNSELECT_ENTITIES "entities" missing!')
        },
        start(_data, eventCall) {
            assert(eventCall)

            eventCall.unselectEntities(
                this.entities.map(config => ig.Event.getEntity(config)).filter(Boolean) as ig.Entity[],
                this.selectionName
            )
        },
    })
})

function findEntitiesOn(box: ig.Entity): ig.Entity[] {
    const { x, y, z } = box.coll.pos
    let { x: width, y: height, z: zHeight } = box.coll.size

    return ig.game.getEntitiesInRectangle(x, y, z + zHeight + 1, width, height, 64)
}

function findEntitiesWithNamePrefix(prefix: string): ig.Entity[] {
    return ig.game.entities.filter(entity => entity.name?.startsWith(prefix))
}

declare global {
    namespace ig.EVENT_STEP {
        namespace SELECT_ENTITIES_STANDING_ON {
            interface Settings {
                entityNamePrefix: string
                selectionName?: string
            }
        }
        interface SELECT_ENTITIES_STANDING_ON extends ig.EventStepBase {
            entityNamePrefix: string
            selectionName?: string
        }
        interface SELECT_ENTITIES_STANDING_ON_CONSTRUCTOR extends ImpactClass<SELECT_ENTITIES_STANDING_ON> {
            new (settings: ig.EVENT_STEP.SELECT_ENTITIES_STANDING_ON.Settings): SELECT_ENTITIES_STANDING_ON
        }
        var SELECT_ENTITIES_STANDING_ON: SELECT_ENTITIES_STANDING_ON_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.SELECT_ENTITIES_STANDING_ON = ig.EventStepBase.extend({
        init(settings) {
            this.entityNamePrefix = settings.entityNamePrefix
            this.selectionName = settings.selectionName
            assert(this.entityNamePrefix, 'ig.EVENT_STEP.SELECT_ENTITIES_STANDING_ON "entityNamePrefix" missing!')
        },
        start(_data, eventCall) {
            assert(eventCall)

            const allEntities = new Set<ig.Entity>()
            for (const box of findEntitiesWithNamePrefix(this.entityNamePrefix)) {
                const entities = findEntitiesOn(box)
                for (const entity of entities) {
                    allEntities.add(entity)
                }
            }
            eventCall.selectEntities(allEntities, this.selectionName)
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace SELECT_ALL_PLAYERS {
            interface Settings {
                selectionName?: string
            }
        }
        interface SELECT_ALL_PLAYERS extends ig.EventStepBase {
            selectionName?: string
        }
        interface SELECT_ALL_PLAYERS_CONSTRUCTOR extends ImpactClass<SELECT_ALL_PLAYERS> {
            new (settings: ig.EVENT_STEP.SELECT_ALL_PLAYERS.Settings): SELECT_ALL_PLAYERS
        }
        var SELECT_ALL_PLAYERS: SELECT_ALL_PLAYERS_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.SELECT_ALL_PLAYERS = ig.EventStepBase.extend({
        init(settings) {
            this.selectionName = settings.selectionName
        },
        start(_data, eventCall) {
            assert(eventCall)

            const players: ig.ENTITY.Player[] = []
            if (multi.server) {
                runTaskInMapInst(() => {
                    players.push(...ig.ccmap!.clients.map(client => client.dummy).filter(Boolean))
                })
            } else {
                players.push(ig.game.playerEntity)
            }

            eventCall.selectEntities(players, this.selectionName)
        },
    })
})
