import type { Server } from 'http'
import { NetServerInfoPhysics, ServerDetailsRemote } from '../client/menu/server-info'
import Multibakery from '../plugin'
import { RemoteServerConnectionSettings } from '../server/remote-server'
import { assert } from '../misc/assert'

export const DEFAULT_HTTP_PORT = 33405

export class PhysicsHttpServer {
    httpServer!: Server

    constructor(public netInfo: NetServerInfoPhysics) {}

    async start() {
        const http: typeof import('http') = (0, eval)('require("http")')

        let icon: ArrayBuffer | undefined
        if (this.netInfo.details.iconPath) {
            const fs: typeof import('fs') = (0, eval)('require("fs")')
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

        this.httpServer = http.createServer((req, res) => {
            if (req.url == '/') {
                res.writeHead(200, {
                    'Content-Type': 'text/plain',
                })
                res.write('hi')
                res.end()
            } else if (req.url == '/details') {
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
                res.writeHead(404)
                res.end()
            }
        })

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
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
        if (res.status == 200) {
            const ping = Date.now() - started
            return { ping, res }
        }
    } catch (e) {}
}
