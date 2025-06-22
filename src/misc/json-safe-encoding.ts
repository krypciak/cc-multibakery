const charset = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()-_=+[]{}|;:,.<>?/`~'
export function encodeJsonSafeNumber(num: number) {
    if (num === 0) return charset[0]
    const base = charset.length
    let str = ''
    while (num > 0) {
        str = charset[num % base] + str
        num = Math.floor(num / base)
    }
    return str
}
