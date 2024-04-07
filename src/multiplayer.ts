import { CCServer } from './server'
import { Player } from './player'

import { Server, Socket } from 'socket.io'
import { ClientToServerEvents, InterServerEvents, PlayerJoinResponse, ServerToClientEvents } from './api'

export const DEFAULT_PORT = 33405

interface SocketData {
    username: string
}

function setIntervalWorkaround() {
    const setInterval = window.setInterval
    // @ts-expect-error
    window.setInterval = (...args) => {
        const id = setInterval(...args)
        return { unref: () => {}, ref: () => {}, id }
    }

    const clearInterval = window.clearInterval
    window.clearInterval = id => {
        if (id === undefined) return
        if (typeof id === 'number') {
            clearInterval(id)
        } else {
            // @ts-expect-error
            clearInterval(id.id)
        }
    }
}

export class Multiplayer {
    headless: boolean = false

    servers: Record<string, CCServer> = {}
    /* current processed server */
    server!: CCServer

    io!: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
    sockets!: Record<string, Socket>
    usernameToSocketId!: Record<string, string>

    constructor() {
        import('./game-loop')
        import('./update-loop')
    }

    appendServer(server: CCServer) {
        ig.multiplayer.servers[server.s.name] = server
    }

    start() {
        this.server = Object.values(this.servers)[0]
        this.server.start()

        setIntervalWorkaround()
        this.io = new Server(this.server.s.port, { connectionStateRecovery: {} })
        window.addEventListener('beforeunload', () => {
            this.io.close()
        })

        this.sockets = {}
        this.usernameToSocketId = {}
        this.io.on('connection', socket => {
            this.sockets[socket.id] = socket

            socket.on('getPlayerUsernames', callback => {
                const usernames = this.server.getPlayers().map(p => p.name)
                callback(usernames)
            })

            socket.on('disconnect', () => {
                this.disconnectSocket(socket)
            })
            socket.on('join', async (username, callback) => {
                callback(await this.playerJoin(username))
            })
            socket.on('leave', () => {
                if (socket.data) {
                    this.kick(socket.data.username, 'left')
                }
            })
        })
    }

    private disconnectSocket(socket: Socket) {
        delete this.sockets[socket.id]
        if (socket.data) {
            delete this.usernameToSocketId[socket.data.username]
        }
    }

    public kick(username: string, message: string) {
        console.log(`kick "${username}": ${message}`)
    }

    private async playerJoin(username: string): Promise<PlayerJoinResponse> {
        const player = await Player.new(username)
        return this.server.joinPlayer(player)
    }
}
