import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { arrayVarAccess } from './array'

function findEntitiesOn(box: ig.Entity): ig.Entity[] {
    const { x, y, z } = box.coll.pos
    let { x: width, y: height, z: zHeight } = box.coll.size

    return ig.game.getEntitiesInRectangle(x, y, z + zHeight + 1, width, height, 64)
}

function findEntitiesWithNamePrefix(prefix: string): ig.Entity[] {
    return ig.game.entities.filter(entity => entity.name?.startsWith(prefix))
}

type EntityTypeName = keyof typeof ig.ENTITY | keyof typeof sc
function entityTypeNameToClass(typeName: EntityTypeName) {
    // @ts-expect-error
    const clazz = ig.ENTITY[typeName] ?? sc[typeName]
    assert(clazz, `Entity type: "${typeName}" does not exist!`)
    return clazz
}

prestart(() => {
    ig.Game.inject({
        onVarAccess(path, keys) {
            if (keys[1] == 'entities') {
                if (keys[2] == 'all') return arrayVarAccess([...this.entities], keys.slice(3))
                if (keys[2] == 'allShown') return arrayVarAccess([...this.shownEntities], keys.slice(3))
                if (keys[2] == 'type') {
                    const entityTypeName = keys[3] as EntityTypeName
                    const clazz = entityTypeNameToClass(entityTypeName)
                    const entities = ig.game.entities.filter(entity => entity instanceof clazz)
                    return arrayVarAccess(entities, keys.slice(4))
                }
                if (keys[2] == 'standingOn') {
                    const entityNamePrefix = keys[3]

                    const allEntities = new Set<ig.Entity>()
                    for (const box of findEntitiesWithNamePrefix(entityNamePrefix)) {
                        const entities = findEntitiesOn(box)
                        for (const entity of entities) {
                            allEntities.add(entity)
                        }
                    }
                    return arrayVarAccess([...allEntities], keys.slice(4))
                }
            }
            return this.parent(path, keys)
        },
    })
})

function removeClassesRec(obj: any) {
    for (const k in obj) {
        const v = obj[k]
        if (typeof v === 'object') {
            if (v instanceof ig.Class) {
                delete obj[k]
            } else {
                removeClassesRec(v)
            }
        }
    }
}
prestart(() => {
    ig.Vars.inject({
        getJson() {
            const json = this.parent()
            removeClassesRec(json.storage)
            return json
        },
    })
})
