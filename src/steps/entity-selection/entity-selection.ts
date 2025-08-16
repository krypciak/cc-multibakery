import { prestart } from '../../plugin'
import { assert } from '../../misc/assert'

declare global {
    namespace ig {
        interface EventCall {
            entitySelections: Record<string, ig.Entity[]>

            selectEntities(this: this, entities: ig.Entity[], selectionName?: string): void
            clearEntitySelection(this: this, selectionName?: string): void
            getSelectedEntities(this: this, selectionName?: string): ig.Entity[]
            getSelectionNamesStartingWith(this: this, prefix: string): string[]
            runForSelection(
                this: this,
                selectionName: string,
                bulk: boolean | undefined,
                task: (selName: string, suffix: string) => void
            ): void
        }
    }
}
export const defaultSelectionName = 'default'

prestart(() => {
    ig.EventCall.inject({
        selectEntities(entities, selectionName = defaultSelectionName) {
            this.entitySelections ??= {}
            ;(this.entitySelections[selectionName] ??= []).push(...entities)
        },
        clearEntitySelection(selectionName = defaultSelectionName) {
            this.entitySelections ??= {}
            this.entitySelections[selectionName] = []
        },
        getSelectedEntities(selectionName = defaultSelectionName) {
            this.entitySelections ??= {}
            return this.entitySelections[selectionName] ?? []
        },
        getSelectionNamesStartingWith(prefix) {
            return Object.keys(this.entitySelections ?? {}).filter(name => name.startsWith(prefix))
        },
        runForSelection(selectionName, bulk, task) {
            if (bulk) {
                for (const selName of this.getSelectionNamesStartingWith(selectionName)) {
                    const suffix = selName.substring(selectionName.length)
                    task(selName, suffix)
                }
            } else {
                task(selectionName, '')
            }
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace CLEAR_ENTITY_SELECTION {
            interface Settings {
                selectionName?: string
                bulk?: boolean
            }
        }
        interface CLEAR_ENTITY_SELECTION extends ig.EventStepBase {
            selectionName: string
            bulk?: boolean
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
            this.selectionName = settings.selectionName ?? defaultSelectionName
            this.bulk = settings.bulk
        },
        start(_data, eventCall) {
            assert(eventCall)

            eventCall.runForSelection(this.selectionName, this.bulk, name => {
                eventCall.clearEntitySelection(name)
            })
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
            this.selectionName = settings.selectionName ?? defaultSelectionName
            assert(this.entities)
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
                markerPrefix: string
                selectionName?: string
                bulk?: boolean
            }
        }
        interface SELECT_ENTITIES_STANDING_ON extends ig.EventStepBase {
            markerPrefix: string
            selectionName: string
            bulk?: boolean
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
            this.markerPrefix = settings.markerPrefix
            this.selectionName = settings.selectionName ?? defaultSelectionName
            this.bulk = settings.bulk
            assert(this.markerPrefix)
            assert(this.selectionName)
        },
        start(_data, eventCall) {
            assert(eventCall)

            for (const box of findEntitiesWithNamePrefix(this.markerPrefix)) {
                const suffix = box.name!.substring(this.markerPrefix.length)
                const groupId = !this.bulk
                    ? ''
                    : suffix.indexOf('_') == -1
                      ? suffix
                      : suffix.substring(suffix.indexOf('_') - 1)

                const on = findEntitiesOn(box)
                eventCall.selectEntities(on, this.selectionName + groupId)
            }
        },
    })
})
