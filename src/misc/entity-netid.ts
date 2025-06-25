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
                netid?: string
            }
        }
        interface Entity {
            netid: string

            createNetid(this: this, x: number, y: number, z: number, settings: ig.Entity.Settings): string | void
            setNetid(this: this, x: number, y: number, z: number, settings: ig.Entity.Settings): void
        }

        interface Game {
            entitiesByNetid: Record<string, ig.Entity>
        }
    }
}

export const entityTypeIdToClass: Record<EntityTypeId, EntityClass> = {}
export const entityApplyPriority: Record<EntityTypeId, number> = {}
export const entitySendEmpty: Set<EntityTypeId> = new Set()
export const entityIgnoreDeath: Set<EntityTypeId> = new Set()
export const entityNetidStatic: Set<EntityTypeId> = new Set()

interface RegisterNetEntitySettings {
    entityClass: EntityClass
    typeId: EntityTypeId
    applyPriority?: number
    sendEmpty?: boolean
    ignoreDeath?: boolean
    netidStatic?: boolean
}

export function registerNetEntity({
    entityClass,
    typeId,
    applyPriority,
    sendEmpty,
    ignoreDeath,
    netidStatic,
}: RegisterNetEntitySettings) {
    assert(!entityTypeIdToClass[typeId], `entity typeId duplicate! ${typeId}`)
    entityTypeIdToClass[typeId] = entityClass
    entityApplyPriority[typeId] = applyPriority ?? 1000

    if (sendEmpty) entitySendEmpty.add(typeId)
    if (ignoreDeath) entityIgnoreDeath.add(typeId)
    if (netidStatic) entityNetidStatic.add(typeId)
}

prestart(() => {
    ig.Game.inject({
        init() {
            this.parent()
            this.entitiesByNetid = {}
        },
    })

    ig.Entity.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.setNetid(x, y, z, settings)
        },
        reset(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.setNetid(x, y, z, settings)
        },
        createNetid() {},
        setNetid(x, y, z, settings) {
            const netid = settings.netid ?? this.createNetid(x, y, z, settings)
            if (!netid) return

            if (ig.game.entitiesByNetid[this.netid]) {
                delete ig.game.entitiesByNetid[this.netid]
            }

            assert(!ig.game.entitiesByNetid[netid], 'Entity netid overlap')
            this.netid = netid
            ig.game.entitiesByNetid[this.netid] = this
        },
        onKill() {
            this.parent()
            if (this.netid) delete ig.game.entitiesByNetid[this.netid]
        },
    })
}, 1)
