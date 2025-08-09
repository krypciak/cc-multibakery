import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'

declare global {
    namespace ig {
        interface Vars {
            nextSetBy?: ig.Entity
            varsSetBy: Record</* var */ string, ig.Entity>
        }
    }
}

function varsNextSetByInject(
    this: ig.Vars & { parent(path: string, value: unknown): void },
    path: string,
    value: unknown
): void {
    this.parent(path, value)
    if (this.nextSetBy) {
        this.varsSetBy[path] = this.nextSetBy
        this.nextSetBy = undefined
    }
}

prestart(() => {
    ig.Vars.inject({
        onLevelChange(mapName) {
            this.parent(mapName)
            this.varsSetBy = {}
        },
        set: varsNextSetByInject,
        add: varsNextSetByInject,
    })
})

export function setNextSetBy(entity: ig.Entity) {
    assert(!ig.vars.nextSetBy)
    assert(entity)
    ig.vars.nextSetBy = entity
}
export function unsetNextSetBy() {
    ig.vars.nextSetBy = undefined
}
export function findSetByEntityByVars(vars: string[]): ig.Entity | undefined {
    return ig.vars.varsSetBy[vars.find(varName => ig.vars.varsSetBy[varName]) ?? -1]
}
