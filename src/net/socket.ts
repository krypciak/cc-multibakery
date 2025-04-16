import { Server as _Server, Socket as _Socket } from 'socket.io'
import * as ioclient from 'socket.io-client'
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
    const setInterval = window.setInterval
    // @ts-expect-error
    window.setInterval = (...args) => {
        const id = setInterval(...args)
        return { unref: () => {}, ref: () => {}, id }
    }

    const clearInterval = window.clearInterval
    window.clearInterval = id => {
        if (id === undefined || id === null) return
        if (typeof id === 'number') {
            clearInterval(id)
        } else {
            clearInterval(id.id)
        }
    }
}

export class SocketNetManagerPhysicsServer implements NetManagerPhysicsServer {
    connections: SocketNetConnection[] = []
    openListeners: ((conn: NetConnection) => void)[] = []
    closeListeners: ((conn: NetConnection) => void)[] = []
    io!: SocketServer

    constructor(public port: number) {
        setIntervalWorkaround()
        this.closeListeners.push(conn => {
            this.connections.erase(conn as SocketNetConnection)
        })
        this.openListeners.push(conn => {
            this.connections.push(conn as SocketNetConnection)
        })
    }

    async start() {
        process.on('exit', () => this.stop())
        window.addEventListener('beforeunload', () => this.stop())

        this.io = new _Server(this.port, {
            connectionStateRecovery: {},
            cors: {
                origin: `http://localhost:5173`,
            },
        })
        console.log('Listening for connections...')
        this.io.on('connection', async socket => {
            socket.on('join', async data => {
                function err(msg: string) {
                    socket.emit('error', msg)
                    socket.disconnect()
                }
                if (!isClientJoinData(data)) return err('invalid join data')
                assert(multi.server instanceof PhysicsServer)
                const { id, error } = await multi.server.onNetJoin(data)
                if (error) return err(error)
                assert(id !== undefined)

                const connection = new SocketNetConnection(
                    id,
                    socket,
                    multi.server.onNetReceive.bind(multi.server),
                    multi.server.onNetClose.bind(multi.server)
                )
                for (const func of this.openListeners) func(connection)
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
    socket?: ioclient.Socket

    constructor(
        public host: string,
        public port: number
    ) {}

    async connect() {
        process.on('exit', () => this.stop())
        window.addEventListener('beforeunload', () => this.stop())

        const socket = ioclient.io(`ws://${this.host}:${this.port}`) as ClientSocket
        socket.on('connect', () => {
            assert(multi.server instanceof RemoteServer)
            multi.server.onNetConnected()
        })
        socket.on('disconnect', () => {
            assert(multi.server instanceof RemoteServer)
            this.stop()
            multi.server.onNetDisconnect()
        })
        this.socket = socket
    }

    async sendJoin(data: unknown, client: Client) {
        assert(this.socket)
        assert(multi.server instanceof RemoteServer)
        this.socket.emit('join', data)
        this.conn = new SocketNetConnection(client.inst.id, this.socket, multi.server.onNetReceive.bind(multi.server))
    }

    async stop() {
        this.socket?.disconnect()
        this.conn?.close()
    }

    async destroy() {
        await this.stop()
    }
}

class SocketNetConnection implements NetConnection {
    closed: boolean = false

    constructor(
        public instanceId: number,
        public socket: ClientSocket | Socket,
        public onReceive?: (conn: NetConnection, data: unknown) => void,
        public onClose?: (conn: NetConnection) => void
    ) {
        const inst = instanceinator.instances[instanceId]
        assert(inst)
        inst.ig.netConnection = this
        this.socket.on('update', data => {
            if (this.onReceive) this.onReceive(this, data)
        })
        socket.on('disconnect', () => this.close())
    }

    isConnected() {
        return this.socket.connected
    }
    sendUpdate(data: unknown): void {
        this.socket.emit('update', data)
        // console.log('sending update', data)
    }
    close(): void {
        if (this.closed) return
        this.closed = true
        if (!this.socket.disconnected) this.socket.disconnect()

        const inst = instanceinator.instances[this.instanceId]
        assert(inst)
        inst.ig.netConnection = undefined

        if (this.onClose) this.onClose(this)
    }
}
