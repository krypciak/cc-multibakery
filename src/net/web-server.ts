import type { Server, IncomingMessage, ServerResponse } from 'http'
import { NetServerInfoPhysics, ServerDetailsRemote } from '../client/menu/server-info'
import { RemoteServerConnectionSettings } from '../server/remote/remote-server'
import { assert } from '../misc/assert'
import { getCCBundlerHttpModules } from './cc-bundler-http-modules'
import { getModCompatibilityList } from '../server/mod-compatibility-list'

export const DEFAULT_HTTP_PORT = 33405

export class PhysicsHttpServer {
    private stopFunc = () => this.stop()

    httpServer!: Server

    constructor(public netInfo: NetServerInfoPhysics) {}

    async start() {
        assert(PHYSICS)
        assert(PHYSICSNET)
        if (!PHYSICS || !PHYSICSNET) return

        const fs: typeof import('fs') = (0, eval)('require("fs")')

        let icon: Buffer | undefined
        if (this.netInfo.details.iconPath) {
            icon = await fs.promises.readFile(this.netInfo.details.iconPath)
        }

        const serverDetails: ServerDetailsRemote = {
            title: this.netInfo.details.title,
            description: this.netInfo.details.description,
            forceJsonCommunication: this.netInfo.details.forceJsonCommunication,

            hasIcon: !!icon,
            globalTps: multi.server.settings.tps,
            forceConsistentTickTimes: multi.server.settings.forceConsistentTickTimes,
            modCompatibility: getModCompatibilityList(),
        }
        const serverDetailsString: string = JSON.stringify(serverDetails)

        const httpRoot = this.netInfo.connection.httpRoot

        const { createServer } = PHYSICSNET && (await import('http-server'))

        const serverHandleFunction = (req: IncomingMessage, res: ServerResponse) => {
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
                if (httpRoot) res.emit('next')
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

        const httpServer = createServer({
            root: httpRoot,
            cache: -1,
            cors: true,
            showDotfiles: false,
            showDir: 'false',
            https: this.netInfo.connection.https,
            before: [
                //
                ...(await getCCBundlerHttpModules(this.netInfo.connection.ccbundler)),
                serverHandleFunction,
            ],
        })
        // @ts-expect-error for some reason http-server typedefs are wrong
        this.httpServer = httpServer.server

        process.on('exit', this.stopFunc)
        window.addEventListener('beforeunload', this.stopFunc)

        console.log('http server listening to', this.netInfo.connection.httpPort)
        this.httpServer.listen(this.netInfo.connection.httpPort)
    }

    stop() {
        this.httpServer.close()
    }

    destroy() {
        this.stop()
        process.off('exit', this.stopFunc)
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

export async function getServerDetailsAndPing(connection: RemoteServerConnectionSettings) {
    if (connection.https === undefined && (await setHttps(connection))) return

    const obj = await fetchUrlWithPing(getDetailsUrl(connection))
    if (!obj) return
    return {
        ping: obj.ping,
        details: await obj.res.json(),
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
