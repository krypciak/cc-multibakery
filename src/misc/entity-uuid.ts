import { prestart } from '../plugin'
import { assert } from './assert'
import getUuid from 'uuid-by-string'

declare global {
    namespace ig {
        namespace Entity {
            interface Settings {
                uuid?: string
            }
        }
        interface Entity {
            type: string
            uuid: string
        }
        interface EntityConstructor {
            entityUuidCodeInitialized: boolean
        }

        interface Game {
            entitiesByUUID: Record<string, ig.Entity>

            getEntityClassByPath<T extends EntityTypes>(this: this, path: T): CCPathToEntityClass<T>
        }
        var entityPathToClass: Record<EntityTypes, CCPathToEntityClass<EntityTypes>>
        function registerEntityPath<T extends EntityTypes>(entityClass: CCPathToEntityClass<T>, path: T): void
    }

    interface EntityTypesInterface {
        'sc.CombatProxyEntity': never
    }
}
const scEntities = ['CombatProxyEntity'] as const satisfies (keyof typeof sc)[]

type FilterEntities<P extends string> = IsEntityClass<CCDeepType<P>> extends never ? never : P

export type EntityTypes =
    | FilterEntities<`ig.ENTITY.${keyof typeof ig.ENTITY}`>
    | FilterEntities<keyof EntityTypesInterface>

type DeepType<T, P extends string> = P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
        ? DeepType<T[K], Rest>
        : never
    : P extends keyof T
      ? T[P]
      : never

// prettier-ignore
export type CCDeepType<P extends string> =
      P extends `ig.${infer Rest}` ? DeepType<typeof ig, Rest>
    : P extends `sc.${infer Rest}` ? DeepType<typeof sc, Rest>
    : P extends `dummy.${infer Rest}` ? DeepType<typeof dummy, Rest>
    : never

type EntityClass = new (x: number, y: number, z: number, settings: any /*ig.Entity.Settings*/) => ig.Entity
type IsEntityClass<T> = T extends EntityClass ? T : never
export type CCPathToEntityClass<P extends string> = IsEntityClass<CCDeepType<P>>

export function setUuid(this: ig.Entity, x: number, y: number, z: number, settings: ig.Entity.Settings) {
    if (ig.game.entitiesByUUID[this.uuid]) {
        delete ig.game.entitiesByUUID[this.uuid]
    }

    if (settings.uuid) {
        this.uuid = settings.uuid
        assert(!ig.game.entitiesByUUID[this.uuid], 'Entity uuid overlap')
    } else {
        do {
            this.uuid = getUuid(`${this.type}-${settings.name}-${x},${y},${z}`)
            x++
        } while (ig.game.entitiesByUUID[this.uuid])
    }
    ig.game.entitiesByUUID[this.uuid] = this
}

prestart(() => {
    if (!ig.Entity.entityUuidCodeInitialized) {
        ig.Entity.entityUuidCodeInitialized = true

        ig.entityPathToClass = {} as any
        ig.registerEntityPath = function (entityClass, path) {
            ig.entityPathToClass[path] = entityClass
            entityClass.prototype.type = path
        }
        for (const key of Object.keysT(ig.ENTITY)) {
            ig.registerEntityPath(ig.ENTITY[key], `ig.ENTITY.${key}`)
        }

        for (const key of scEntities) {
            ig.registerEntityPath(sc[key], `sc.${key}`)
        }

        ig.Game.inject({
            init() {
                this.parent()
                this.entitiesByUUID = {}
            },
            getEntityClassByPath(path) {
                return ig.entityPathToClass[path]
            },
        })

        ig.Entity.inject({
            init(x, y, z, settings) {
                this.parent(x, y, z, settings)
                setUuid.call(this, x, y, z, settings)
            },
            reset(x, y, z, settings) {
                this.parent(x, y, z, settings)
                setUuid.call(this, x, y, z, settings)
            },
            onKill() {
                this.parent()
                delete ig.game.entitiesByUUID[this.uuid]
            },
        })
    }
}, 0)
