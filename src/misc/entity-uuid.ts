import { prestart } from '../plugin'
import { assert } from './assert'

interface EntityClass extends ImpactClass<any> {
    new (x: number, y: number, z: number, settings: any): any
}

export type EntityTypeId = string

declare global {
    namespace ig {
        namespace Entity {
            interface Settings {
                uuid?: string
            }
        }
        interface Entity {
            uuid: string

            createUuid(this: this, x: number, y: number, z: number, settings: ig.Entity.Settings): string | void
            setUuid(this: this, x: number, y: number, z: number, settings: ig.Entity.Settings): void
        }

        interface Game {
            entitiesByUUID: Record<string, ig.Entity>
        }

        var entityTypeIdToClass: Record<EntityTypeId, EntityClass>
        var entityClassIdToTypeId: Record<number, EntityTypeId>
        var entityApplyPriority: Record<EntityTypeId, number>
        function registerEntityTypeId(entityClass: EntityClass, prefix: EntityTypeId, applyPriority?: number): void
    }
}

prestart(() => {
    ig.entityTypeIdToClass = {}
    ig.entityClassIdToTypeId = {}
    ig.entityApplyPriority = {}

    ig.registerEntityTypeId = function (entityClass, typeId, applyPriority = 1000) {
        assert(!ig.entityTypeIdToClass[typeId], `entity typeId duplicate! ${typeId}`)
        ig.entityTypeIdToClass[typeId] = entityClass
        ig.entityClassIdToTypeId[entityClass.classId] = typeId
        ig.entityApplyPriority[typeId] = applyPriority
    }

    ig.Game.inject({
        init() {
            this.parent()
            this.entitiesByUUID = {}
        },
    })

    ig.Entity.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.setUuid(x, y, z, settings)
        },
        reset(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.setUuid(x, y, z, settings)
        },
        createUuid() {},
        setUuid(x, y, z, settings) {
            const uuid = settings.uuid ?? this.createUuid(x, y, z, settings)
            if (!uuid) return

            if (ig.game.entitiesByUUID[this.uuid]) {
                delete ig.game.entitiesByUUID[this.uuid]
            }

            assert(!ig.game.entitiesByUUID[uuid], 'Entity uuid overlap')
            this.uuid = uuid
            ig.game.entitiesByUUID[this.uuid] = this
        },
        onKill() {
            this.parent()
            if (this.uuid) delete ig.game.entitiesByUUID[this.uuid]
        },
    })
}, 0)
