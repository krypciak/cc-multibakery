import { Server as _Server, Socket as _Socket } from 'socket.io'
import { assert } from '../misc/assert'
import { NetConnection, NetManagerLocalServer } from './connection'
import { isClientJoinData, Server } from '../server/server'

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
type Socket = _Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type SocketServer = _Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

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

export class SocketNetManagerLocalServer implements NetManagerLocalServer {
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
        assert(multi.server instanceof Server)
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
                assert(multi.server instanceof Server)
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

class SocketNetConnection implements NetConnection {
    closed: boolean = false

    constructor(
        public instanceId: number,
        public socket: Socket,
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
    send(data: unknown): void {
        this.socket.emit('update', data)
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
