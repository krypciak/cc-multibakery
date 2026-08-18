import type { Server as HttpServer, RequestListener } from 'http'
import {
    isServerDetailsRemote,
    type NetServerInfoPhysics,
    type ServerDetailsRemote,
} from '../client/menu/server-info-types'
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

            gameTps: multi.server.settings.gameTps,
            forceConsistentTickTimes: multi.server.settings.forceConsistentTickTimes,
            gameLoopIntervalTps: multi.server.settings.gameLoopIntervalTps,

            modCompatibility: getModCompatibilityList(),
            mapSwitchDelay: multi.server.settings.mapSwitchDelay,
        }
        assert(isServerDetailsRemote(this.serverDetails))
        const serverDetailsString: string = JSON.stringify(this.serverDetails)

        const serverHandle: HttpHandler = (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*')

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

        return new Promise<void>((resolve, reject) => {
            let port = this.netInfo.connection.httpPort
            this.httpServer.on('error', e => {
                let error: string
                if ('code' in e && e.code === 'EADDRINUSE') {
                    error = `http server port ${port} already in use!`
                } else {
                    error = 'unknown http server error'
                }
                console.error(error)
                this.destroy()
                reject(e)
            })
            this.httpServer.listen(port, () => {
                const obj = this.httpServer.address()
                if (obj && typeof obj === 'object') {
                    port = this.netInfo.connection.httpPort = obj.port
                }
                console.log('http server listening to', port)
                resolve()
            })
        })
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
