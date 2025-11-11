import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { prestart } from '../../loading-stages'

declare global {
    namespace ig {
        interface Vars {
            linkedTo?: ig.Vars
        }
    }
}

prestart(() => {
    ig.Vars.inject({
        clear() {
            this.parent()
            if (this.linkedTo) {
                link(this, this.linkedTo)
            }
        },
    })
})

const regularKeys = ['map', 'session', 'tmp']

function link(to: ig.Vars, from: ig.Vars) {
    to.linkedTo = from

    to.storage = new Proxy(to.storage, {
        get(target, p, _receiver) {
            const key = p as string
            if (regularKeys.includes(key)) {
                return target[key]
            } else {
                return from.storage[key]
            }
        },
        set(target, p, newValue, _receiver) {
            const key = p as string
            if (regularKeys.includes(key)) {
                target[key] = newValue
            } else {
                from.storage[key] = newValue
            }
            return true
        },
        getOwnPropertyDescriptor(_target, p) {
            return Reflect.getOwnPropertyDescriptor(from.storage, p)
        },
        ownKeys(_target) {
            return Reflect.ownKeys(from.storage)
        },
    })
}

export function linkVars(toInst: InstanceinatorInstance, fromInst: InstanceinatorInstance) {
    link(toInst.ig.vars, fromInst.ig.vars)
}
