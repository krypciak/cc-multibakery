export function assert(v: any, msg?: string): asserts v {
    if (!v) {
        throw new Error(`Assertion error${msg ? `: ${msg}` : ''}`)
    }
}
