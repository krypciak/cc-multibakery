import type { Server, IncomingMessage, ServerResponse } from 'http'
import { NetServerInfoPhysics, ServerDetailsRemote } from '../client/menu/server-info'
import Multibakery from '../plugin'
import { RemoteServerConnectionSettings } from '../server/remote/remote-server'
import { assert } from '../misc/assert'

export const DEFAULT_HTTP_PORT = 33405

export class PhysicsHttpServer {
    httpServer!: Server

    constructor(public netInfo: NetServerInfoPhysics) {}

    async start() {
        const fs: typeof import('fs') = (0, eval)('require("fs")')

        let icon: ArrayBuffer | undefined
        if (this.netInfo.details.iconPath) {
            icon = await fs.promises.readFile(this.netInfo.details.iconPath)
        }

        const serverDetails: ServerDetailsRemote = {
            title: this.netInfo.details.title,
            description: this.netInfo.details.description,
            hasIcon: !!icon,
            multibakeryVersion: Multibakery.mod.version!.toString(),
            globalTps: multi.server.settings.globalTps,
        }
        const serverDetailsString: string = JSON.stringify(serverDetails)

        const httpRoot = this.netInfo.connection.httpRoot

        const { createServer } = await import('http-server')
        const httpServer = createServer({
            root: httpRoot,
            cache: 60 * 60 * 24,
            cors: true,
            showDotfiles: false,
            showDir: 'false',
            gzip: true,
            before: [
                (req: IncomingMessage, res: ServerResponse) => {
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
                },
            ],
        })
        // @ts-expect-error for some reason http-server typedefs are wrong
        this.httpServer = httpServer.server

        process.on('exit', () => this.stop())
        window.addEventListener('beforeunload', () => this.stop())

        console.log('http server listening to', this.netInfo.connection.httpPort)
        this.httpServer.listen(this.netInfo.connection.httpPort)
    }

    async stop() {
        this.httpServer.close()
    }

    async destroy() {
        this.stop()
    }
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
        const timeout = 3000
        const res = await Promise.race([
            fetch(url, { signal: AbortSignal.timeout?.(3000) }),
            /* AbortSignal.timeout is not available in older nwjs versions */
            new Promise<{ status: 408 }>(resolve => setTimeout(() => resolve({ status: 408 }), timeout + 100)),
        ])
        if (res.status == 200) {
            const ping = Date.now() - started
            return { ping, res }
        }
    } catch (e) {}
}
