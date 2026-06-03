import type { Socket } from 'dgram'
import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { assertPhysics } from '../server/physics/is-physics-server'
import { isNetServerInfoRemote, type NetServerInfoRemote } from '../client/menu/server-info'

const dgram: typeof import('dgram') | undefined = (0, eval)('require("dgram")')

const DISCOVERY_PORT = 33404
const MESSAGE_ID = 'DISCOVER_MULTIBAKERY_SERVER'

type ServerDiscoveryMessage = NetServerInfoRemote
export interface ServerDiscoveryListener {
    serverDiscoveryUpdateCondition(this: this): boolean
    onServerDiscoveryUpdate(this: this, servers: ServerDiscoveryMessage[]): void
}

class SocketWrapper {
    socket?: Socket
    private stopFunc = () => this.destroy()

    create() {
        assert(dgram)
        assert(!this.socket)
        this.socket = dgram.createSocket('udp4')

        process.on('exit', this.stopFunc)
        window.addEventListener('beforeunload', this.stopFunc)
    }

    destroy() {
        if (!this.socket) return
        this.socket.close()
        this.socket = undefined

        process.off('exit', this.stopFunc)
        window.removeEventListener('beforeunload', this.stopFunc)
    }
}

export class ServerDiscoveryServer {
    wrapper = new SocketWrapper()

    start() {
        assertPhysics(multi.server)
        assert(multi.server.httpServer)
        if (!dgram) return
        this.wrapper.create()

        const netInfo = multi.server.settings.netInfo
        assert(netInfo)

        const response = JSON.stringify({
            connection: {
                host: '',
                port: netInfo.connection.httpPort,
                https: !!netInfo.connection.https,
            },
            details: multi.server.httpServer.serverDetails,
        } satisfies NetServerInfoRemote)

        this.wrapper.socket!.on('message', (msg, rinfo) => {
            const text = msg.toString()

            if (text == MESSAGE_ID) {
                this.wrapper.socket!.send(response, rinfo.port, rinfo.address)
            }
        })

        this.wrapper.socket!.bind(DISCOVERY_PORT, () => {
            console.log(`discovery server listening to`, DISCOVERY_PORT)
        })
    }

    destroy() {
        this.wrapper.destroy()
    }
}

export class ServerDiscoveryClient {
    private static wrapper = new SocketWrapper()
    private static listeners = new Set<ServerDiscoveryListener>()

    private static messageInterval = 5000
    private static lastSent = 0
    private static reportedInInvertal: Record<string, NetServerInfoRemote> = {}
    private static reportedInLastInvertal: Record<string, NetServerInfoRemote> = {}

    static addListener(listener: ServerDiscoveryListener) {
        assert(!multi.server)
        this.listeners.add(listener)
        this.update()
    }

    static removeListener(listener: ServerDiscoveryListener) {
        assert(!multi.server)
        this.listeners.delete(listener)
    }

    private static getActiveListeners() {
        return [...this.listeners].filter(l => l.serverDiscoveryUpdateCondition())
    }

    private static serverToId(server: ServerDiscoveryMessage) {
        return server.connection.host + ':' + server.connection.port
    }

    private static onServerDiscovered(data: ServerDiscoveryMessage) {
        this.reportedInInvertal[this.serverToId(data)] = data

        const uniqueServersRecord = { ...this.reportedInLastInvertal }
        let changed = false
        for (const [id, server] of Object.entries(this.reportedInInvertal)) {
            if (!uniqueServersRecord[id]) changed = true
            uniqueServersRecord[id] = server
        }

        if (changed) {
            const uniqueServers = Object.values(uniqueServersRecord)
            this.notifyListeners(uniqueServers)
        }
    }

    private static notifyListeners(servers: ServerDiscoveryMessage[]) {
        for (const listener of this.listeners) listener.onServerDiscoveryUpdate(servers)
    }

    private static start() {
        if (!dgram) return
        this.wrapper.create()

        this.wrapper.socket!.bind(() => {
            this.wrapper.socket!.setBroadcast(true)
        })

        this.wrapper.socket!.on('message', (msg, rinfo) => {
            const data = JSON.parse(msg.toString())
            if (!isNetServerInfoRemote(data)) return
            data.connection.host = rinfo.address

            this.onServerDiscovered(data)
        })
    }

    private static stop() {
        this.reportedInInvertal = {}
        this.reportedInLastInvertal = {}
        this.wrapper.destroy()
    }

    static update() {
        const activeListeners = this.getActiveListeners()
        if (activeListeners.length == 0) {
            if (this.wrapper.socket) this.stop()
        } else {
            if (!this.wrapper.socket) this.start()
        }

        if (!this.wrapper.socket) return

        const now = Date.now()
        if (now > this.lastSent + this.messageInterval) {
            this.lastSent = now

            let changed = Object.keys(this.reportedInLastInvertal).some(oldId => !this.reportedInInvertal[oldId])
            this.reportedInLastInvertal = this.reportedInInvertal
            if (changed) this.notifyListeners(Object.values(this.reportedInInvertal))
            this.reportedInInvertal = {}

            this.broadcastMessage()
        }
    }

    private static broadcastMessage() {
        const message = Buffer.from(MESSAGE_ID)
        this.wrapper.socket!.send(message, DISCOVERY_PORT, '255.255.255.255')
    }
}

prestart(() => {
    ig.Game.inject({
        update() {
            this.parent()
            ServerDiscoveryClient.update()
        },
    })
})
