export function checkAndCutPrefix(keys: string[], index: number, prefix: string): boolean {
    if (!keys[index].startsWith(prefix)) return false
    keys[index] = keys[index].substring(prefix.length)
    return true
}
export function checkAndCutSuffix(keys: string[], index: number, suffix: string): boolean {
    if (!keys[index].endsWith(suffix)) return false
    keys[index] = keys[index].slice(0, -suffix.length)
    return true
}
