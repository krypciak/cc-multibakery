import type { RemoteServerConnectionSettings } from '../server/remote/remote-server-types'
import { isServerDetailsRemote, type ServerDetailsRemote } from '../client/menu/server-info-types'
import { assert } from '../misc/assert'
import { wait } from '../misc/wait'

export function isPortValid(text: unknown) {
    const port = Number(text)
    if (Number.isNaN(port)) return false
    if (port > 65535 || port < 1024) return false
    return true
}

export function getServerUrl(connection: RemoteServerConnectionSettings) {
    return `http${connection.https ? 's' : ''}://${connection.host}:${connection.port}`
}

function getDetailsUrl(connection: RemoteServerConnectionSettings) {
    return `${getServerUrl(connection)}/details`
}
function getIconUrl(connection: RemoteServerConnectionSettings) {
    return `${getServerUrl(connection)}/icon`
}

const DETAILS_TIMEOUT = 5000

async function setHttps(connection: RemoteServerConnectionSettings): Promise<boolean> {
    connection.https = false
    try {
        await fetchWithTimeout(getDetailsUrl(connection), DETAILS_TIMEOUT)
        return false
    } catch (e) {}

    try {
        connection.https = true
        await fetchWithTimeout(getDetailsUrl(connection), DETAILS_TIMEOUT)
        return false
    } catch (e) {}
    connection.https = undefined
    return true
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response | void> {
    return Promise.race([
        //
        fetch(url, { signal: AbortSignal.timeout?.(timeout) }),
        wait(timeout + 100),
    ])
}

export async function getServerDetails(
    connection: RemoteServerConnectionSettings
): Promise<{ details: ServerDetailsRemote } | undefined> {
    if (connection.https === undefined && (await setHttps(connection))) return

    const obj = await fetchUrlWithPing(getDetailsUrl(connection))
    if (!obj) return
    const details: unknown = await obj.res.json()
    if (!isServerDetailsRemote(details)) return

    return { details }
}

export async function getServerIcon(connection: RemoteServerConnectionSettings): Promise<HTMLImageElement> {
    const res = await fetch(getIconUrl(connection))
    assert(res.status == 200)
    const blob = await res.blob()

    const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })

    const image = new Image()
    image.src = url
    return image
}

async function fetchUrlWithPing(url: string): Promise<{
    ping: number
    res: Response
} | void> {
    const started = performance.now()
    try {
        const res = await fetchWithTimeout(url, DETAILS_TIMEOUT)
        if (res?.status == 200) {
            const ping = Math.round(performance.now() - started)
            return { ping, res }
        }
    } catch (e) {}
}
