import type { ClientLeaveData, RemoteServerConnectionSettings } from '../server/remote/remote-server-types'
import type { ClientJoinAckData, ClientJoinData } from '../server/server-types'
import { assert } from '../misc/assert'
import { NetConnection } from './net-connection'
import type { NetTransport, NetTransportListenerFunctions } from './net-transport'
import { assertRemote } from '../server/remote/remote-server-types'
import { PacketMiddleware, type NetPacket } from './packet'
import { profile } from '../misc/performance-profiling'

export interface NetTransportClient {
    connect(connectionSettings: RemoteServerConnectionSettings): Promise<void>
    createNetTransport(listeners: NetTransportListenerFunctions): NetTransport
}

export class NetManagerRemoteServer {
    private stopFunc = () => this.stop()

    conn?: NetConnection

    constructor(
        public connectionSettings: RemoteServerConnectionSettings,
        private transportClient: NetTransportClient,
        private pingTimeout: number
    ) {}

    async start() {
        assert(REMOTE)
        if (!REMOTE) return

        process.on('exit', this.stopFunc)
        window.addEventListener('beforeunload', this.stopFunc)

        const server = multi.server
        assertRemote(server)

        await this.transportClient.connect(this.connectionSettings)

        const sendData = (buf: Uint8Array<ArrayBuffer>) => connection.transport.send(buf)
        const onData = async (packet: NetPacket, _callback?: (data: any) => void) => {
            if (multi.server != server) return
            server.onNetReceiveUpdate(this.conn!, packet)
        }
        const middleware = new PacketMiddleware(
            { sendData, onData },
            {
                timeout: this.pingTimeout,
                onTimeout: timeoutTimeMs => this.onDisconnect(`Timeout ${timeoutTimeMs.round(0)} ms`),
            }
        )

        const transport = this.transportClient.createNetTransport({
            onReceive: data => middleware.receive(data),
            onBytesReceived: bytes => connection.onBytesReceived(bytes),
            onBytesSent: bytes => connection.onBytesSent(bytes),
            onClose: reason => this.onDisconnect(`Connection closed: ${reason}`),
        })

        const connection = new NetConnection(middleware, transport)
        connection.readyForSendingUpdate = true
        this.conn = connection
    }

    private onDisconnect(reason: string) {
        this.stop()
        if (!multi.server || multi.server.destroyed) return
        assertRemote(multi.server)
        multi.server.onNetDisconnect(reason)
    }

    calculatePing(): number {
        return this.conn?.middleware.heartbeat.getPing() ?? 0
    }

    @profile()
    async sendJoin(data: ClientJoinData): Promise<ClientJoinAckData> {
        assert(this.conn)
        assertRemote(multi.server)
        const ack: ClientJoinAckData = await this.conn.middleware.sendWithAck('join', data)
        return ack
    }

    async sendReady() {
        assert(this.conn)
        this.conn.middleware.send('ready')
    }

    async sendLeave(data: ClientLeaveData): Promise<void> {
        assert(this.conn)
        assertRemote(multi.server)
        this.conn.middleware.send('leave', data)
    }

    stop() {
        process.off('exit', this.stopFunc)
        this.conn?.close()
    }

    destroy() {
        this.stop()
        window.removeEventListener('beforeunload', this.stopFunc)
    }
}
