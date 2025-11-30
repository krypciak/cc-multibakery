import { type LabelDrawClass, ValueAverageOverTime } from 'cc-instanceinator/src/label-draw'
import { Client } from './client'
import { Opts } from '../options'
import { assertRemote } from '../server/remote/is-remote-server'

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

export function createClientPingLabel(client: Client) {
    class MsPingLabelDrawClass extends BasicLabelDrawClass {
        avg = new ValueAverageOverTime(60)
        condition = () => Opts.showClientMsPing
        getText(): string {
            this.avg.pushValue(client.lastPingMs)
            const msPing = Math.max(0, this.avg.getAverage().floor())
            return `${msPing}ms`
        }
    }
    client.inst.labelDrawClasses.push(new MsPingLabelDrawClass())
}

export function createClientConnectionInfoLabel(client: Client) {
    assertRemote(multi.server)
    const server = multi.server

    class ConnectionInfoLabelDrawClass extends BasicLabelDrawClass {
        condition = () => Opts.showClientConnectionInfo
        getText(): string {
            return server.netManager?.conn?.getConnectionInfo() ?? 'disconnected'
        }
    }
    client.inst.labelDrawClasses.push(new ConnectionInfoLabelDrawClass())
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

            const tps = multi.server.settings.tps
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
