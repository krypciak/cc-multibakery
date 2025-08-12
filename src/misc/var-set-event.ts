import { prestart } from '../plugin'

export type VarModifyEventListener = (path: string, oldValue: ig.VarValue, newValue: ig.VarValue) => void
const listeners: VarModifyEventListener[] = []

export function addVarModifyListener(func: VarModifyEventListener): void {
    listeners.push(func)
}

function inject(this: ig.Vars & { parent(path: string, value: unknown): void }, path: string, value: unknown): void {
    if (!path) return this.parent(path, value)
    const oldValue = this.get(path)
    this.parent(path, value)
    if (oldValue !== value) {
        for (const listener of listeners) listener(path, oldValue, value as ig.VarValue)
    }
}

prestart(() => {
    ig.Vars.inject({
        setDefault: inject,
        set: inject,
        add: inject,
        sub: inject,
        mul: inject,
        div: inject,
        mod: inject,
        and: inject,
        or: inject,
        xor: inject,
        append: inject,
        prepend: inject,
    })
})
