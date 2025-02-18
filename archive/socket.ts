import { ClientToServerEvents, InterServerEvents, ServerToClientEvents } from './api'

import { Server as _Server, Socket as _Socket } from 'socket.io'
import { Player } from './player'

type SocketData = Player | undefined
type Socket = _Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type Server = _Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

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

class das {
    io!: Server
    sockets!: Record<string, Socket>
    usernameToSocketId!: Record<string, string>

    private disconnectSocket(socket: Socket) {
        delete this.sockets[socket.id]
        if (socket.data && socket.data instanceof Player) {
            this.disconnectPlayer(socket.data)
        }
    }
    private disconnectPlayer(player: Player) {
        delete this.usernameToSocketId[player.name]
        multi.server.leavePlayer(player)
    }

    start() {
        multi.server.start()

        setIntervalWorkaround()
        this.io = new _Server(this.server.s.port, { connectionStateRecovery: {} })
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
                const player = await Player.new(username)
                this.usernameToSocketId[player.name] = socket.id
                socket.data = player

                const data: PlayerJoinResponse = await this.server.joinPlayer(player)
                callback(data)
            })
            socket.on('leave', () => {
                if (socket.data && socket.data instanceof Player) {
                    this.kick(socket.data, 'left')
                }
            })
            socket.on('update', packet => {
                if (socket.data && socket.data instanceof Player) {
                    this.server.playerUpdate(socket.data, packet)
                }
            })
        })
    }

    kick(player: Player, message: string) {
        console.log(`kick "${player.name}": ${message}`)
        this.disconnectPlayer(player)
    }

    sendOutUpdatePackets(state: ReturnType<UpdatePacketGather['pop']>) {
        for (const map of this.server.getActiveMaps()) {
            const mapName = map.mapName
            const mapPacket: ToClientUpdatePacket | undefined = state[mapName]

            for (const player of map.players) {
                // const playerPacket: ToClientUpdatePacket | undefined = statePlayer[player.name]

                let finalPacket: ToClientUpdatePacket | undefined = mapPacket
                // if (finalPacket && playerPacket) ig.merge(finalPacket, playerPacket)
                // if (!finalPacket) finalPacket = playerPacket
                if (!finalPacket) continue

                const socket = this.sockets[this.usernameToSocketId[player.name]]
                socket.emit('update', finalPacket)
            }
        }
    }
}
