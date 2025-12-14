import type { u16, u6 } from 'ts-binarifier/src/type-aliases'
import { prestart } from '../loading-stages'
import { assert } from './assert'
import { isRemote } from '../server/remote/is-remote-server'

interface EntityClass extends ImpactClass<any> {
    new (x: number, y: number, z: number, settings: any): any
}

export type EntityTypeId = u6

declare global {
    namespace ig {
        namespace Entity {
            interface Settings {
                netid?: EntityNetid
            }
        }
        interface Entity {
            netid: EntityNetid

            changeNetid(this: this, netid: EntityNetid): void
            createNetid(this: this): EntityNetid | void
            setNetid(this: this, override?: EntityNetid): void
        }

        interface Game {
            entitiesByNetid: Record<EntityNetid | string, ig.Entity>
            entityTypeIdCounterMap: Record<number, number>
        }
    }
}

export type EntityNetid = u16
// u1 for special bit
const typeidSizeBits = 6
const typeidSize = 64 // u6
export const entityNetidCounterSize = 512 // 9
const typeidShift = 16 - typeidSizeBits + 1
const specialBit = 1 << (typeidShift - 1)

let netidTypeCounter = 1
function nextNetidType(): number {
    assert(netidTypeCounter < typeidSize)
    return netidTypeCounter++
}

export function getEntityTypeId(netid: EntityNetid): EntityTypeId {
    return netid >> typeidShift
}

function baseNetidFromTypeId(typeid: EntityTypeId): EntityNetid {
    return typeid << typeidShift
}

function setEntityNetidSpecialBit(netid: EntityNetid): EntityNetid {
    return netid | specialBit
}

export function createNetidSpecialBit(this: ig.Class & { parent(): EntityNetid | void }): EntityNetid {
    let netid = this.parent()!
    if (isRemote(multi.server)) netid = setEntityNetidSpecialBit(netid)
    return netid
}

const classIdToTypeid: Record<number, EntityTypeId> = {}
export const entityTypeidToClass: Record<EntityTypeId, EntityClass> = {}
export const entityApplyPriority: Record<EntityTypeId, number> = {}
export const entityIgnoreDeath: Set<EntityTypeId> = new Set()
export const entityStatic: Set<EntityTypeId> = new Set()

interface RegisterNetEntitySettings {
    entityClass: EntityClass
    applyPriority?: number
    ignoreDeath?: boolean
    isStatic?: boolean
}

export function registerNetEntity({ entityClass, applyPriority, ignoreDeath, isStatic }: RegisterNetEntitySettings) {
    const typeid = nextNetidType()
    assert(!entityTypeidToClass[typeid], `entity typeid duplicate! ${typeid}`)
    entityTypeidToClass[typeid] = entityClass
    classIdToTypeid[entityClass.classId] = typeid
    entityApplyPriority[typeid] = applyPriority ?? 1000

    if (ignoreDeath) entityIgnoreDeath.add(typeid)
    if (isStatic) entityStatic.add(typeid)
}

prestart(() => {
    ig.Game.inject({
        init() {
            this.parent()
            this.entitiesByNetid = {}
            this.entityTypeIdCounterMap = {}
        },
    })

    ig.Entity.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.setNetid(settings.netid)
        },
        reset(x, y, z, settings) {
            assert(this._killed)
            this.parent(x, y, z, settings)
            this.setNetid(settings.netid)
        },
        createNetid() {
            const typeid = classIdToTypeid[this.classId]
            ig.game.entityTypeIdCounterMap[typeid] ??= 0
            let netid: EntityNetid = 0
            const baseId = baseNetidFromTypeId(typeid)
            let overflowCount = 0
            do {
                let add = ++ig.game.entityTypeIdCounterMap[typeid]
                if (add >= entityNetidCounterSize) {
                    add = 1
                    ig.game.entityTypeIdCounterMap[typeid] = 0
                    if (++overflowCount >= 2)
                        throw new Error(`Netid pool exsausted for typeid: ${typeid}, entity: ${fcn(this)}`)
                }
                netid = baseId + add
            } while (ig.game.entitiesByNetid[netid])
            return netid
        },
        setNetid(override) {
            if (!classIdToTypeid[this.classId]) return

            const netid = override ?? this.createNetid()
            // console.log(ig.game.mapName, fcn(this), netid)
            if (!netid) {
                this.netid = undefined as any
                return
            }

            assert(!ig.game.entitiesByNetid[netid], 'Entity netid overlap')
            this.netid = netid
            ig.game.entitiesByNetid[this.netid] = this
        },
        changeNetid(netid) {
            if (this.netid) delete ig.game.entitiesByNetid[this.netid]
            this.setNetid(netid)
        },
        onKill() {
            this.parent()
            if (this.netid) {
                // console.log(ig.game.mapName, fcn(this), this.netid, 'deleting')
                delete ig.game.entitiesByNetid[this.netid]
            }
        },
    })
}, 1)
