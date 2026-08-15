import type { NetServerInfoRemote } from '../../client/menu/server-info-types'
import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { profile } from '../../misc/performance-profiling'
import { Opts } from '../../options'
import type { ClientJoinAckData, ClientJoinData } from '../server-types'
import { RemoteServer } from './remote-server'

declare global {
    namespace multi {
        function tryJoinRemote(netInfo: NetServerInfoRemote, joinData: ClientJoinData): Promise<ClientJoinAckData>
    }
}

class TryJoinRemote {
    @profile()
    private static async startServer(server: RemoteServer) {
        await server.start()
    }

    @profile((_self, netInfo, joinData) => `${netInfo.connection.host}:${netInfo.connection.port} ${joinData.username}`)
    static async tryJoinRemote(netInfo: NetServerInfoRemote, joinData: ClientJoinData): Promise<ClientJoinAckData> {
        {
            const server = multi.server
            assert(!server)
        }
        assert(netInfo.details)

        const server = new RemoteServer({
            displayServerInstance: Opts.serverDisplayServerInstance,
            displayMaps: Opts.serverDisplayMaps,
            forceMapsActive: Opts.serverForceMapsActive,
            displayInactiveMaps: Opts.serverDisplayInactiveMaps,
            displayClientInstances: Opts.serverDisplayClientInstances,
            displayRemoteClientInstances: Opts.serverDisplayRemoteClientInstances,

            gameTps: netInfo.details.gameTps,
            forceConsistentTickTimes: netInfo.details.forceConsistentTickTimes,
            netInfo: netInfo as any,
            modCompatibility: netInfo.details.modCompatibility,
            mapSwitchDelay: netInfo.details.mapSwitchDelay,
        })
        multi.setServer(server)

        await server.startNet()

        const ackData = await server.netManager.sendJoin(joinData)

        if (ackData.status != 'ok') {
            multi.destroyAndStartLoop()
        } else {
            await this.startServer(server)

            await server.netManager.sendReady()

            const { client } = await server.createAndJoinClient(joinData, {
                awaitClientJoin: true,
                ackDataOverride: ackData,
            })
            assert(client)
            server.setMasterClient(client)
        }

        return ackData
    }
}

prestart(() => {
    if (!REMOTE) return
    multi.tryJoinRemote = (...args) => TryJoinRemote.tryJoinRemote(...args)
})
