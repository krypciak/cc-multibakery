export function fromCamel(str: string) {
    return str.replace(/[A-Z]/g, a => '-' + a.toLowerCase())
}
