import { NetServerInfoRemote } from '../../client/menu/server-info'
import { assert } from '../../misc/assert'
import { Opts } from '../../options'
import { ClientJoinAckData, ClientJoinData } from '../server'
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

    const server = new RemoteServer({
        displayServerInstance: Opts.serverDisplayServerInstance,
        displayMaps: Opts.serverDisplayMaps,
        displayClientInstances: Opts.serverDisplayClientInstances,
        displayRemoteClientInstances: Opts.serverDisplayRemoteClientInstances,

        globalTps: serverInfo.details.globalTps,
        forceConsistentTickTimes: serverInfo.details.forceConsistentTickTimes,
        connection: serverInfo.connection,
    })
    multi.setServer(server)
    await server.start()
    server.masterUsername = joinData.username

    const { ackData } = await server.tryJoinClient(joinData, false)
    if (ackData.status != 'ok') {
        await multi.destroyNextFrameAndStartLoop()
    }
    return ackData
}
