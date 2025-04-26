import type { Server as _Server, Socket as _Socket } from 'socket.io'
import type * as ioclient from 'socket.io-client'
import { assert } from '../misc/assert'
import { NetConnection, NetManagerPhysicsServer } from './connection'
import { isClientJoinData, PhysicsServer } from '../server/physics-server'
import { RemoteServer } from '../server/remote-server'
import { Client } from '../client/client'

type SocketData = never

type ClientToServerEvents = {
    update(data: unknown): void
    join(data: unknown): void
}
type ServerToClientEvents = {
    update(data: unknown): void
    error(msg: string): void
}
type InterServerEvents = {}
type Socket = _Socket //<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type SocketServer = _Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type ClientSocket = ioclient.Socket //<ServerToClientEvents, ClientToServerEvents>

export const DEFAULT_SOCKETIO_PORT = 33405

function setIntervalWorkaround() {
    const origSetInterval = window.setInterval
    // @ts-expect-error
    window.setInterval = (...args) => {
        const id = origSetInterval(...args)
        return { unref: () => {}, ref: () => {}, id }
    }

    const origClearInterval = window.clearInterval
    window.clearInterval = id => {
        if (id === undefined || id === null) return
        if (typeof id === 'number') {
            origClearInterval(id)
        } else {
            origClearInterval(id.id)
        }
    }
}

export class SocketNetManagerPhysicsServer implements NetManagerPhysicsServer {
    connections: SocketNetConnection[] = []
    io!: SocketServer

    constructor(public port: number) {
        setIntervalWorkaround()
    }

    async start() {
        process.on('exit', () => this.stop())
        window.addEventListener('beforeunload', () => this.stop())

        // const fs = await import('fs')
        // const { createServer } = await import('http')
        // const crypto = await import('crypto')
        // const htm = await fs.promises.readFile(
        //     '/home/krypek/Programming/crosscode/instances/cc-bundle-inst/ccbundler/dist.html',
        //     'utf8'
        // )
        // const etag = 'W/' + crypto.createHash('sha256').update(htm).digest('hex')
        //
        // const hs = createServer(function (req, res) {
        //     const ifNoneMatch = req.headers['if-none-match']
        //     if (ifNoneMatch === etag) {
        //         res.writeHead(304)
        //         res.end()
        //         return
        //     }
        //
        //     res.writeHead(200, {
        //         'Content-Type': 'text/html',
        //         'Cache-Control': 'public, max-age=31536000, immutable',
        //         'Last-Modified': 'Tue, 22 Feb 2022 20:20:20 GMT',
        //         Expires: 'Sun, 15 Feb 2028 20:47:38 GMT',
        //         Vary: 'Accept-Encoding',
        //         'Content-Length': Buffer.byteLength(htm, 'utf8'),
        //         ETag: etag,
        //     })
        //     res.write(htm)
        //     res.end()
        // })
        // hs.listen(DEFAULT_SOCKETIO_PORT)

        const { Server } = await import('socket.io')
        this.io = new Server(this.port, {
            connectionStateRecovery: {},
            cors: {
                origin: `http://localhost:${DEFAULT_SOCKETIO_PORT}`,
            },
        })

        const server = multi.server
        assert(server instanceof PhysicsServer)
        this.io.on('connection', async socket => {
            const connection = new SocketNetConnection(
                socket,
                data => {
                    server.onNetReceive(connection, data)
                },
                () => {
                    this.connections.erase(connection)
                    server.onNetDisconnect(connection)
                }
            )
            this.connections.push(connection)

            socket.on('join', async data => {
                function err(msg: string) {
                    socket.emit('error', msg)
                }
                if (!isClientJoinData(data)) return err('invalid join data')
                const { client, error } = await server.onNetJoin(data)
                if (error) return err(error)

                connection.join(client!)
            })
        })
    }

    async stop() {
        await this.io.close()
    }

    async destroy() {
        await this.stop()
    }
}

export class SocketNetManagerRemoteServer {
    conn?: SocketNetConnection

    constructor(
        public host: string,
        public port: number
    ) {}

    async connect() {
        process.on('exit', () => this.stop())
        window.addEventListener('beforeunload', () => this.stop())

        const server = multi.server
        assert(server instanceof RemoteServer)

        let ioclient: typeof import('socket.io-client')
        if (ig.platform == ig.PLATFORM_TYPES.BROWSER) {
            // @ts-expect-error
            ioclient = window.io
        } else if (ig.platform == ig.PLATFORM_TYPES.DESKTOP) {
            ioclient = await import('socket.io-client')
        } else assert(false, 'Unsupported platform')

        const socket = ioclient.io(`ws://${this.host}:${this.port}`) as ClientSocket
        socket.on('connect', () => {
            const conn = new SocketNetConnection(
                socket,
                data => {
                    server.onNetReceive(conn, data)
                },
                () => {
                    // close
                }
            )
            this.conn = conn

            server.onNetConnected()
        })
        socket.on('disconnect', () => {
            this.stop()
            server.onNetDisconnect()
        })
    }

    async sendJoin(data: unknown, client: Client) {
        assert(this.conn)
        assert(multi.server instanceof RemoteServer)
        this.conn.join(client)
        this.conn.socket.emit('join', data)
    }

    async stop() {
        this.conn?.close()
    }

    async destroy() {
        await this.stop()
    }
}

class SocketNetConnection implements NetConnection {
    clients: Client[] = []
    closed: boolean = false

    constructor(
        public socket: ClientSocket | Socket,
        public onReceive?: (data: unknown) => void,
        public onClose?: () => void
    ) {
        this.socket.on('update', data => {
            if (this.onReceive) this.onReceive(data)
        })
        socket.on('disconnect', () => this.close())
    }

    join(client: Client) {
        this.clients.push(client)
        // client.inst.ig.netConnection = this
    }
    leave(client: Client) {
        this.clients.erase(client)
        // client.inst.ig.netConnection = undefined
    }

    isConnected() {
        return this.socket.connected
    }

    sendUpdate(data: unknown): void {
        this.socket.emit('update', data)
    }
    close(): void {
        if (this.closed) return
        this.closed = true
        if (!this.socket.disconnected) this.socket.disconnect()

        if (this.onClose) this.onClose()

        for (const client of this.clients) {
            this.leave(client)
        }
    }
}
