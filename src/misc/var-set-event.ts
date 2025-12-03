import { prestart } from '../loading-stages'

export type VarModifyEventListener = (path: string, newValue: ig.VarValue) => void
const listeners: VarModifyEventListener[] = []

export function addVarModifyListener(func: VarModifyEventListener): void {
    listeners.push(func)
}

function createInject(isSet: boolean = false) {
    return function inject(
        this: ig.Vars & { parent(path: string, value: unknown): void },
        path: string,
        value: unknown
    ): void {
        if (!path) return this.parent(path, value)

        const changedBackup = ig.game._deferredVarChanged
        ig.game._deferredVarChanged = false
        this.parent(path, value)
        if (ig.game._deferredVarChanged) {
            const currentValue = isSet ? value : this.get(path)
            for (const listener of listeners) listener(path, currentValue as ig.VarValue)
        }
        ig.game._deferredVarChanged = ig.game._deferredVarChanged || changedBackup
    }
}

prestart(() => {
    ig.Vars.inject({
        setDefault: createInject(true),
        set: createInject(true),
        add: createInject(),
        sub: createInject(),
        mul: createInject(),
        div: createInject(),
        mod: createInject(),
        and: createInject(),
        or: createInject(),
        xor: createInject(),
        append: createInject(),
        prepend: createInject(),
    })
})
