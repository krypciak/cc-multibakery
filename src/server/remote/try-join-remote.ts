import type { NetServerInfoRemote } from '../../client/menu/server-info'
import { assert } from '../../misc/assert'
import { Opts } from '../../options'
import type { ClientJoinAckData, ClientJoinData } from '../server'
import { RemoteServer } from './remote-server'

export async function tryJoinRemote(
    serverInfo: NetServerInfoRemote,
    joinData: ClientJoinData
): Promise<ClientJoinAckData> {
    {
        const server = multi.server
        assert(!server)
    }
    assert(serverInfo.details)

    serverInfo.connection.forceJsonCommunication = serverInfo.details.forceJsonCommunication

    PROFILE && console.time('tryJoinRemote')

    const server = new RemoteServer({
        displayServerInstance: Opts.serverDisplayServerInstance,
        displayMaps: Opts.serverDisplayMaps,
        displayClientInstances: Opts.serverDisplayClientInstances,
        displayRemoteClientInstances: Opts.serverDisplayRemoteClientInstances,

        tps: serverInfo.details.globalTps,
        forceConsistentTickTimes: serverInfo.details.forceConsistentTickTimes,
        connection: serverInfo.connection,
        modCompatibility: serverInfo.details.modCompatibility,
        mapSwitchDelay: serverInfo.details.mapSwitchDelay,
    })
    multi.setServer(server)

    PROFILE && console.time('startNet')
    await server.startNet()
    PROFILE && console.timeEnd('startNet')

    PROFILE && console.time('sendJoin')
    const ackData = await server.netManager.sendJoin(joinData)
    PROFILE && console.timeEnd('sendJoin')

    if (ackData.status != 'ok') {
        multi.destroyAndStartLoop()
    } else {
        PROFILE && console.time('server start')
        await server.start()
        PROFILE && console.timeEnd('server start')

        await server.netManager.sendReady()

        const client = await server.createClientWithAckData(joinData, ackData)
        server.setMasterClient(client)
    }

    PROFILE && console.timeEnd('tryJoinRemote')

    return ackData
}
