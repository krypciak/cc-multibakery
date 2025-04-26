import type { Server } from 'http'
import { NetServerInfoPhysics, ServerDetailsRemote } from '../client/menu/server-info'
import Multibakery from '../plugin'

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
