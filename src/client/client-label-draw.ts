import { LabelDrawClass, ValueAverageOverTime } from 'cc-instanceinator/src/label-draw'
import { Client } from './client'
import { assert } from '../misc/assert'
import { RemoteServer } from '../server/remote-server'
import { Opts } from '../options'

export function createClientPingLabel(client: Client) {
    class MsPingLabelDrawClass implements LabelDrawClass {
        avg = new ValueAverageOverTime(60)

        draw(y: number) {
            if (!Opts.showClientMsPing) return y
            this.avg.pushValue(client.lastPingMs)
            const msPing = this.avg.getAverage().floor()
            const str = `${msPing}ms`
            const text = new ig.TextBlock(sc.fontsystem.font, `${str}`, {})
            text.draw(ig.system.width - text.size.x - 5, y)
            y += text.size.y
            return y
        }
    }
    client.inst.labelDrawClasses.push(new MsPingLabelDrawClass())
}

export function createClientConnectionInfoLabel(client: Client) {
    assert(multi.server instanceof RemoteServer)
    const server = multi.server

    class ConnectionInfoLabelDrawClass implements LabelDrawClass {
        draw(y: number) {
            if (!Opts.showClientConnectionInfo) return y
            const str = server.netManager?.conn?.getConnectionInfo() ?? 'disconnected'
            const text = new ig.TextBlock(sc.fontsystem.font, `${str}`, {})
            text.draw(ig.system.width - text.size.x - 5, y)
            y += text.size.y
            return y
        }
    }
    client.inst.labelDrawClasses.push(new ConnectionInfoLabelDrawClass())
}
