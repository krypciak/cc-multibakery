import type { NetServerInfoRemote } from '../../client/menu/server-info-types'
import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { Opts } from '../../options'
import type { ClientJoinAckData, ClientJoinData } from '../server-types'
import { RemoteServer } from './remote-server'

declare global {
    namespace multi {
        function tryJoinRemote(netInfo: NetServerInfoRemote, joinData: ClientJoinData): Promise<ClientJoinAckData>
    }
}

prestart(() => {
    if (!REMOTE) return
    multi.tryJoinRemote = async function (
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
})
