import { prestart } from '../plugin'

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

    interface EntityTypesInterface {}
}

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
    : never

type EntityClass = new (x: number, y: number, z: number, settings: any /*ig.Entity.Settings*/) => ig.Entity
type IsEntityClass<T> = T extends EntityClass ? T : never
export type CCPathToEntityClass<P extends string> = IsEntityClass<CCDeepType<P>>

prestart(() => {
    if (!ig.Entity.entityUuidCodeInitialized) {
        ig.Entity.entityUuidCodeInitialized = true

        ig.entityPathToClass = {} as any
        ig.registerEntityPath = function (entityClass, path) {
            ig.entityPathToClass[path] = entityClass
            entityClass.prototype.type = path
        }
        ig.Game.inject({
            init() {
                this.parent()
                for (const key of Object.keysT(ig.ENTITY)) {
                    ig.registerEntityPath(ig.ENTITY[key], `ig.ENTITY.${key}`)
                }
                this.entitiesByUUID = {}
            },
            getEntityClassByPath(path) {
                return ig.entityPathToClass[path]
            },
        })

        const crypto: typeof import('crypto') = (0, eval)('require("crypto")')

        ig.Entity.inject({
            init(x, y, z, settings) {
                this.parent(x, y, z, settings)
                this.uuid =
                    settings.uuid ??
                    crypto.createHash('sha256').update(`${this.type}-${settings.name}-${x},${y}`).digest('hex')
                ig.game.entitiesByUUID[this.uuid] = this
            },
            onKill() {
                this.parent()
                delete ig.game.entitiesByUUID[this.uuid]
            },
        })
    }
}, 0)
