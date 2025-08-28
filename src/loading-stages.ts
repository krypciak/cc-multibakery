let postloadFunctions: [() => void | Promise<void>, number][]
export function postload(func: () => void | Promise<void>, priority: number = 100) {
    postloadFunctions ??= []
    postloadFunctions.push([func, priority])
}
export async function executePostload() {
    await Promise.all((postloadFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))
}

let prestartFunctions: [() => void | Promise<void>, number][]
export function prestart(func: () => void | Promise<void>, priority: number = 100) {
    prestartFunctions ??= []
    prestartFunctions.push([func, priority])
}
export async function executePrestart() {
    await Promise.all((prestartFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))
}

let poststartFunctions: [() => void | Promise<void>, number][]
export function poststart(func: () => void | Promise<void>, priority: number = 100) {
    poststartFunctions ??= []
    poststartFunctions.push([func, priority])
}
export async function executePoststart() {
    await Promise.all((poststartFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))
}
