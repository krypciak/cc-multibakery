import type { Username } from '../net/binary/binary-types'

export function isUsernameValid(username: Username): boolean {
    return (
        username.length >= 3 &&
        username.length <= 12 &&
        /^[a-zA-Z0-9-_ ]+$/.test(username) &&
        (!sc.party || !sc.party.models[username])
    )
}

export function generateRandomUsername(): Username {
    const numberSuffix = (10 + 90 * Math.random()).floor()

    let username: string
    do {
        const obj = ig.database.data.names[(Math.random() * ig.database.data.names.length).floor()]
        const randomPrefix = typeof obj.name == 'string' ? obj.name : obj.name.en_US!
        username = `${randomPrefix}${numberSuffix}`
    } while (!isUsernameValid(username))

    return username
}
