import { assert } from '../misc/assert'
import type { NetConnection } from './net-connection'
import { type ClientLeaveData, type RemoteServerConnectionSettings } from '../server/remote/remote-server'
import { type ClientJoinAckData, type ClientJoinData } from '../server/server'
import { Opts } from '../options'
import { assertRemote } from '../server/remote/is-remote-server'
import { PacketMiddleware, type PacketEventType } from './packet'

export abstract class NetManagerRemoteServer {
    private stopFunc = () => this.stop()

    conn?: NetConnection
    timeOffset: number = 0

    constructor(public connectionSettings: RemoteServerConnectionSettings) {}

    protected abstract connect(): Promise<void>

    protected abstract createNetConnection(middleware: PacketMiddleware): NetConnection

    async start() {
        assert(REMOTE)
        if (!REMOTE) return

        process.on('exit', this.stopFunc)
        window.addEventListener('beforeunload', this.stopFunc)

        const server = multi.server
        assertRemote(server)

        await this.connect()

        const onData = async (type: PacketEventType, data: any, _callback?: (data: any) => void) => {
            if (type != 'update' || multi.server != server) return
            server.onNetReceive(this.conn!, data)
        }
        const middleware = new PacketMiddleware(buf => connection.send(buf), onData)

        const connection = this.createNetConnection(middleware)
        connection.ready = true
        this.conn = connection

        try {
            this.measureClockOffset()
        } catch (e) {}
    }

    protected onDisconnect() {
        this.stop()
        if (!multi.server || multi.server.destroyed) return
        assertRemote(multi.server)
        multi.server.onNetDisconnect()
    }

    private async probeTimeOffset(): Promise<{ timeTook: number; timeDiff: number }> {
        assert(this.conn)
        const clientDate = Date.now()
        const clientTimeStart = performance.now()
        const serverDate: number = await this.conn.middleware.sendWithAck('ping1')
        const clientTimeEnd = performance.now()

        const timeTook = clientTimeEnd - clientTimeStart

        return { timeTook, timeDiff: serverDate - clientDate }
    }

    private async measureClockOffset() {
        if (!Opts.serverTimeSynchronization) return

        const probeFor = 1e3
        const start = performance.now()

        let minTimeTook = 100000
        let minRawDiff = 100000

        while (true) {
            if (!this.conn || this.conn.closed) return

            const { timeTook, timeDiff: rawDiff } = await this.probeTimeOffset()
            minTimeTook = Math.min(minTimeTook, timeTook)
            minRawDiff = Math.min(minRawDiff, rawDiff)
            this.timeOffset = minRawDiff - minTimeTook / 2

            if (performance.now() - start >= probeFor) break
        }
    }

    calculatePing(serverTime: number): number {
        return Date.now() - serverTime + this.timeOffset
    }

    async sendJoin(data: ClientJoinData): Promise<ClientJoinAckData> {
        PROFILE && console.time('sendJoin')
        assert(this.conn)
        assertRemote(multi.server)
        const ack: ClientJoinAckData = await this.conn.middleware.sendWithAck('join', data)
        PROFILE && console.timeEnd('sendJoin')
        return ack
    }

    async sendReady() {
        this.conn?.middleware.send('ready')
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
