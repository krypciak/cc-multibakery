import { type LabelDrawClass, ValueAverageOverTime } from 'cc-instanceinator/src/label-draw'
import type { Client } from './client'
import { Opts } from '../options'
import { assertRemote, isRemote } from '../server/remote/remote-server-types'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../misc/assert'

abstract class BasicLabelDrawClass implements LabelDrawClass {
    abstract condition(): boolean
    abstract getText(): string

    draw(y: number) {
        if (!this.condition()) return y
        const str = this.getText()
        const text = new ig.TextBlock(sc.fontsystem.font, `${str}`, {})
        text.draw(ig.system.width - text.size.x - 5, y)
        y += text.size.y
        return y
    }
}

export function createClientConnectionPingLabel(client: Client) {
    function getPing(): number {
        if (isRemote(multi.server)) {
            return multi.server.netManager.conn?.wrapper.heartbeat.lastPingRTT ?? 0
        } else {
            return 0
        }
    }
    class MsConnectionPingLabelDrawClass extends BasicLabelDrawClass {
        condition = () => Opts.showClientMsPing
        getText(): string {
            const ping = getPing()
            const pingStr = Math.round(ping)
            return `hRTT: ${pingStr}ms`
        }
    }
    client.inst.labelDrawClasses.push(new MsConnectionPingLabelDrawClass())
}

export function createClientInputLatencyPingLabel(client: Client) {
    if (!PROFILE) return
    class MsConnectionPingLabelDrawClass extends BasicLabelDrawClass {
        condition = () => Opts.showClientMsPing
        getText(): string {
            const client = ig.client
            assert(client)
            const stats = multi.perf.printStatsToString('player input latency total', client.username, {
                precision: 0,
                keys: ['count', 'min', 'p50', 'p95', 'p99'],
            })
            return 'pil: ' + stats
        }
    }
    client.inst.labelDrawClasses.push(new MsConnectionPingLabelDrawClass())
}

export function createClientTransportInfoLabel(client: Client) {
    assertRemote(multi.server)
    const server = multi.server

    class TransportInfoLabelDrawClass extends BasicLabelDrawClass {
        condition = () => Opts.showClientTransportInfo
        getText(): string {
            return server.netManager?.conn?.transport.getStatusInfo() ?? 'disconnected'
        }
    }
    client.inst.labelDrawClasses.push(new TransportInfoLabelDrawClass())
}

export function createClientNetworkPacketTrafficLabel(client: Client) {
    assertRemote(multi.server)
    const server = multi.server

    class NetworkPacketTrafficLabelDrawClass extends BasicLabelDrawClass {
        avgSent = new ValueAverageOverTime(10)
        avgReceived = new ValueAverageOverTime(10)
        condition = () => Opts.showPacketNetworkTraffic

        private lastSent: bigint = 0n
        private lastReceived: bigint = 0n

        getText(): string {
            const bytesSent = server.netManager.conn?.bytesSent ?? 0n
            const bytesReceived = server.netManager.conn?.bytesReceived ?? 0n

            const bytesSentDiff = Number(bytesSent - this.lastSent)
            const bytesReceivedDiff = Number(bytesReceived - this.lastReceived)

            this.lastSent = bytesSent
            this.lastReceived = bytesReceived

            this.avgSent.pushValue(bytesSentDiff)
            this.avgReceived.pushValue(bytesReceivedDiff)

            const bytesSentAvg = this.avgSent.getAverage()
            const bytesReceivedAvg = this.avgReceived.getAverage()

            const tps = multi.server.settings.gameTps
            const kbSent = (bytesSentAvg * tps * 8) / 1024
            const kbReceived = (bytesReceivedAvg * tps * 8) / 1024

            const downloadStr = `\\i[keyCode-${ig.KEY.D}] ${kbReceived.floor()} kbps`
            const uploadStr = `\\i[keyCode-${ig.KEY.U}] ${kbSent.floor()} kbps`
            return `${downloadStr}  ${uploadStr}`
        }
    }
    client.inst.labelDrawClasses.push(new NetworkPacketTrafficLabelDrawClass())

    class NetworkPacketSizeLabelDrawClass extends BasicLabelDrawClass {
        condition = () => Opts.showPacketNetworkSize

        private lastSent: bigint = 0n
        private lastReceived: bigint = 0n

        getText(): string {
            const bytesSent = server.netManager.conn?.bytesSent ?? 0n
            const bytesReceived = server.netManager.conn?.bytesReceived ?? 0n

            const bytesSentDiff = Number(bytesSent - this.lastSent)
            const bytesReceivedDiff = Number(bytesReceived - this.lastReceived)

            this.lastSent = bytesSent
            this.lastReceived = bytesReceived

            const bSent = bytesSentDiff
            const bReceived = bytesReceivedDiff

            const downloadStr = `\\i[keyCode-${ig.KEY.D}] ${bReceived.floor()} B`
            const uploadStr = `\\i[keyCode-${ig.KEY.U}] ${bSent.floor()} B`
            return `${downloadStr}  ${uploadStr}`
        }
    }
    client.inst.labelDrawClasses.push(new NetworkPacketSizeLabelDrawClass())
}

export function createServerTpsLabel(inst: InstanceinatorInstance) {
    class ServerTpsLabelDrawClass extends BasicLabelDrawClass {
        condition = () => Opts.showServerTps
        getText(): string {
            const tps = 1000 / multi.server.updateDelayAvg.getAverage()
            return `${tps.round(0)} tps`
        }
    }
    inst.labelDrawClasses.push(new ServerTpsLabelDrawClass())
}
