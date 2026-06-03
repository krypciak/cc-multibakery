import type { Server as HttpServer, RequestListener } from 'http'
import { isServerDetailsRemote, type NetServerInfoPhysics, type ServerDetailsRemote } from '../client/menu/server-info'
import type { RemoteServerConnectionSettings } from '../server/remote/remote-server'
import { assert } from '../misc/assert'
import { getCrosscodeWebHttpModules } from './crosscode-web-http-modules'
import { getModCompatibilityList } from '../server/mod-compatibility-list'
import { createChain } from 'crosscode-web/src/http-server/http-misc'
import { convertNetTransportServerSettingsToClientSettings } from './net-transport'

type HttpHandler = RequestListener

export class PhysicsHttpServer {
    private stopFunc = () => this.stop()

    serverDetails!: ServerDetailsRemote

    httpServer!: HttpServer

    constructor(private netInfo: NetServerInfoPhysics) {}

    async start() {
        assert(PHYSICS)
        assert(PHYSICSNET)
        if (!PHYSICS || !PHYSICSNET) return

        const fs: typeof import('fs') = (0, eval)('require("fs")')

        let icon: Buffer | undefined
        if (this.netInfo.details.iconPath) {
            icon = await fs.promises.readFile(this.netInfo.details.iconPath)
        }

        this.serverDetails = {
            title: this.netInfo.details.title,
            description: this.netInfo.details.description,
            transport: convertNetTransportServerSettingsToClientSettings(this.netInfo.connection.transport),
            forceJsonCommunication: this.netInfo.details.forceJsonCommunication,

            hasIcon: !!icon,
            globalTps: multi.server.settings.tps,
            forceConsistentTickTimes: multi.server.settings.forceConsistentTickTimes,
            modCompatibility: getModCompatibilityList(),
            mapSwitchDelay: multi.server.settings.mapSwitchDelay,
        }
        assert(isServerDetailsRemote(this.serverDetails))
        const serverDetailsString: string = JSON.stringify(this.serverDetails)

        const serverHandle: HttpHandler = (req, res) => {
            if (req.url == '/details') {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                })
                res.write(serverDetailsString)
                res.end()
            } else if (req.url == '/icon' && icon) {
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                })
                res.write(icon)
                res.end()
            } else {
                if (this.netInfo.connection.crosscodeWeb?.httpRoot) res.emit('next')
                else if (req.url == '/') {
                    res.writeHead(200)
                    res.write('crosscode server')
                    res.end()
                } else {
                    res.writeHead(404)
                    res.end()
                }
            }
        }

        const respFunc = createChain(
            serverHandle,
            ...(await getCrosscodeWebHttpModules(this.netInfo.connection.crosscodeWeb))
        )

        if (this.netInfo.connection.https) {
            const https: typeof import('https') = (0, eval)('require("https")')
            const [cert, key] = await Promise.all([
                fs.promises.readFile(this.netInfo.connection.https.cert),
                fs.promises.readFile(this.netInfo.connection.https.key),
            ])
            this.httpServer = https.createServer({ cert, key }, respFunc)
        } else {
            const http1: typeof import('http') = (0, eval)('require("http")')
            const server = http1.createServer({}, respFunc as any)
            this.httpServer = server
        }

        process.on('exit', this.stopFunc)
        window.addEventListener('beforeunload', this.stopFunc)

        console.log('http server listening to', this.netInfo.connection.httpPort)
        this.httpServer.listen(this.netInfo.connection.httpPort)
    }

    stop() {
        process.off('exit', this.stopFunc)
        this.httpServer?.close()
    }

    destroy() {
        this.stop()
        window.removeEventListener('beforeunload', this.stopFunc)
    }
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

async function setHttps(connection: RemoteServerConnectionSettings): Promise<boolean> {
    try {
        connection.https = true
        await fetch(getDetailsUrl(connection))
        return false
    } catch (e) {
        try {
            connection.https = false
            await fetch(getDetailsUrl(connection))
            return false
        } catch (e) {
            connection.https = undefined
            return true
        }
    }
}

export async function getServerDetailsAndPing(
    connection: RemoteServerConnectionSettings
): Promise<{ ping: number; details: ServerDetailsRemote } | undefined> {
    if (connection.https === undefined && (await setHttps(connection))) return

    const obj = await fetchUrlWithPing(getDetailsUrl(connection))
    if (!obj) return
    const details: unknown = await obj.res.json()
    if (!isServerDetailsRemote(details)) return

    return {
        ping: obj.ping,
        details,
    }
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
        const timeout = 3000
        const res = await Promise.race([
            fetch(url, { signal: AbortSignal.timeout?.(3000) }),
            /* AbortSignal.timeout is not available in older nwjs versions */
            new Promise<{ status: 408 }>(resolve => setTimeout(() => resolve({ status: 408 }), timeout + 100)),
        ])
        if (res.status == 200) {
            const ping = Math.round(performance.now() - started)
            return { ping, res }
        }
    } catch (e) {}
}
