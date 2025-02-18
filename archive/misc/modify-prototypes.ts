export {}
declare global {
    interface Object {
        keysT<K extends string | number | symbol, V>(object: Record<K, V>): K[]
        entriesT<K extends string | number | symbol, V>(object: { [key in K]?: V }): [K, V][]
        fromEntries<T, K extends string | number | symbol>(entries: [K, T][]): Record<K, T>
    }
}

Object.keysT = Object.keys as any
Object.entriesT = Object.entries as any
if (!Object.fromEntries) {
    Object.fromEntries = function <T, K extends string | number | symbol>(entries: [K, T][]): Record<K, T> {
        return entries.reduce(
            (acc: Record<K, T>, e: [K, T]) => {
                acc[e[0]] = e[1]
                return acc
            },
            {} as Record<K, T>
        )
    }
}
