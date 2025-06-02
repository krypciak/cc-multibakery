export function isUsernameValid(username: string): boolean {
    return username.length <= 20 && /^[a-zA-Z0-9-_ ]+$/.test(username)
}

export function generateRandomUsername(): string {
    const numberSuffix = (10 + 90 * Math.randomOrig()).floor()

    let randomPrefix: string

    do {
        const obj = ig.database.data.names[(Math.randomOrig() * ig.database.data.names.length).floor()]
        randomPrefix = typeof obj.name == 'string' ? obj.name : obj.name.en_US!
    } while (!isUsernameValid(randomPrefix))

    return `${randomPrefix}${numberSuffix}`
}
