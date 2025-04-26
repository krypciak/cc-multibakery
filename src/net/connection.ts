import { Client } from '../client/client'
import { assert } from '../misc/assert'
import { RemoteServerConnectionSettings } from '../server/remote-server'

export interface NetConnection {
    clients: Client[]
    onReceive?: (data: unknown) => void
    onClose?: () => void

    join(client: Client): void
    leave(client: Client): void
    isConnected(): boolean
    sendUpdate(data: unknown): void
    close(): void
}
export interface NetManagerPhysicsServer {
    connections: NetConnection[]

    start(): Promise<void>
    stop(): Promise<void>
    destroy(): Promise<void>
}

export async function getServerDetailsAndPing(connection: RemoteServerConnectionSettings) {
    const obj = await fetchUrlWithPing(`http://${connection.host}:${connection.port}/details`)
    if (!obj) return
    return {
        ping: obj.ping,
        details: await obj.res.json(),
    }
}

export async function getServerIcon(connection: RemoteServerConnectionSettings): Promise<HTMLImageElement> {
    const reqUrl = `http://${connection.host}:${connection.port}/icon`
    const res = await fetch(reqUrl)
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
    const started = Date.now()
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
        if (res.status == 200) {
            const ping = Date.now() - started
            return { ping, res }
        }
    } catch (e) {}
}
