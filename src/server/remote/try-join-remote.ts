import type { NetServerInfoRemote } from '../../client/menu/server-info'
import { assert } from '../../misc/assert'
import { Opts } from '../../options'
import type { ClientJoinAckData, ClientJoinData } from '../server'
import { RemoteServer } from './remote-server'

export async function tryJoinRemote(
    netInfo: NetServerInfoRemote,
    joinData: ClientJoinData
): Promise<ClientJoinAckData> {
    {
        const server = multi.server
        assert(!server)
    }
    assert(netInfo.details)

    PROFILE && console.time('tryJoinRemote')

    const server = new RemoteServer({
        displayServerInstance: Opts.serverDisplayServerInstance,
        displayMaps: Opts.serverDisplayMaps,
        displayClientInstances: Opts.serverDisplayClientInstances,
        displayRemoteClientInstances: Opts.serverDisplayRemoteClientInstances,

        tps: netInfo.details.globalTps,
        forceConsistentTickTimes: netInfo.details.forceConsistentTickTimes,
        netInfo: netInfo as any,
        modCompatibility: netInfo.details.modCompatibility,
        mapSwitchDelay: netInfo.details.mapSwitchDelay,
    })
    multi.setServer(server)

    PROFILE && console.time('startNet')
    await server.startNet()
    PROFILE && console.timeEnd('startNet')

    const ackData = await server.netManager.sendJoin(joinData)

    if (ackData.status != 'ok') {
        multi.destroyAndStartLoop()
    } else {
        PROFILE && console.time('server start')
        await server.start()
        PROFILE && console.timeEnd('server start')

        await server.netManager.sendReady()

        const { client } = await server.createAndJoinClient(joinData, {
            awaitClientJoin: true,
            ackDataOverride: ackData,
        })
        assert(client)
        server.setMasterClient(client)
    }

    PROFILE && console.timeEnd('tryJoinRemote')

    return ackData
}
