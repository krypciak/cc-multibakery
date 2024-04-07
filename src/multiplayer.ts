import { CCServer } from './server'
import { Player } from './player'

import { Server, Socket } from 'socket.io'
import {
    ClientToServerEvents,
    InterServerEvents,
    PlayerJoinResponse,
    ServerToClientEvents,
    ToClientUpdatePacket,
} from './api'

export const DEFAULT_PORT = 33405

type SocketData = Player | undefined

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
    sockets!: Record<string, Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>>
    usernameToSocketId!: Record<string, string>

    constructor() {
        import('./game-loop')
        import('./update-loop')
        import('./dummy-player')
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
                console.log('disconnect', socket.data)
            })
            socket.on('join', async (username, callback) => {
                const player = await Player.new(username)
                const data: PlayerJoinResponse = await this.server.joinPlayer(player)
                socket.data = player
                this.usernameToSocketId[player.name] = socket.id
                callback(data)
            })
            socket.on('leave', () => {
                if (socket.data) {
                    this.kick(socket.data.name, 'left')
                }
            })
            socket.on('update', packet => {
                if (socket.data) {
                    this.server.playerUpdate(socket.data, packet)
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

    kick(username: string, message: string) {
        console.log(`kick "${username}": ${message}`)
    }

    sendOutUpdatePackets(packets: Record<string, ToClientUpdatePacket>) {
        for (const mapName in packets) {
            const packet = packets[mapName]
            const map = this.server.maps[mapName]
            for (const player of map.players) {
                const socket = this.sockets[this.usernameToSocketId[player.name]]
                socket.emit('update', packet)
            }
        }
    }
}
