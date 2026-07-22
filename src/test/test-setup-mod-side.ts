import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { poststart, preload, prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { getServerDetails } from '../net/web-server-utils'
import type { RemoteServerConnectionSettings } from '../server/remote/remote-server-types'
import { tryJoinRemote } from '../server/remote/try-join-remote'
import { addStateHandler } from '../state/states'
import { isBunTest } from './test-bridge'

preload(() => {
    if (!TEST) return
    TEST && import('./aoc/aoc2024d15')
    TEST && import('./combat/combat-art-test')
}, 1)

poststart(() => {
    if (!TEST || isBunTest()) return

    if (process.argv.length > 2 && process.argv[2] == 'remoteServer') {
        execRemote()
    } else {
        execPhysics()
    }
}, 9999)

function execPhysics() {
    // TEST && import('./aoc/aoc2024d15.test')

    TEST && import('./combat/spheromancer/combat-art-spheromancer-neutral.test')
    TEST && import('./combat/spheromancer/combat-art-spheromancer-heat.test')
    TEST && import('./combat/spheromancer/combat-art-spheromancer-cold.test')
    TEST && import('./combat/spheromancer/combat-art-spheromancer-shock.test')
    TEST && import('./combat/spheromancer/combat-art-spheromancer-wave.test')

    TEST && import('./combat/triblader/combat-art-triblader-neutral.test')
    TEST && import('./combat/triblader/combat-art-triblader-heat.test')
    TEST && import('./combat/triblader/combat-art-triblader-cold.test')
    TEST && import('./combat/triblader/combat-art-triblader-shock.test')
    TEST && import('./combat/triblader/combat-art-triblader-wave.test')

    TEST && import('./combat/hexacast/combat-art-hexacast-neutral.test')
    TEST && import('./combat/hexacast/combat-art-hexacast-heat.test')
    TEST && import('./combat/hexacast/combat-art-hexacast-cold.test')
    TEST && import('./combat/hexacast/combat-art-hexacast-shock.test')
    TEST && import('./combat/hexacast/combat-art-hexacast-wave.test')
}

export interface TestRemoteClientRaport {
    crashed: boolean
    playerZoom?: number
    errors?: string[]
}

export interface TestRemoteClientRequestConfig {
    username: string
    port: number
}

let raportSent = false
async function execRemote() {
    ig.system.startRunLoop = () => {
        createAndSendRaport()
        process.exit(0)
    }

    const config: TestRemoteClientRequestConfig = JSON.parse(process.argv[3])
    const { username, port } = config

    const connection: RemoteServerConnectionSettings = { host: '127.0.0.1', port }
    const { details } = (await getServerDetails(connection)) ?? {}
    assert(details)
    const ackData = await tryJoinRemote({ connection, details }, { username })
    if (ackData.status != 'ok') {
        console.error(ackData)
    }
}

function createRaport(): TestRemoteClientRaport {
    if (!multi.server) return { crashed: true }
    const client = multi.server.clients.values().next().value
    if (!client) return { crashed: true }

    const playerZoom = client.inst.ig.camera._currentZoom

    return {
        crashed: false,
        playerZoom,
    }
}

function createAndSendRaport() {
    if (raportSent) return
    raportSent = true

    const raport = createRaport()
    console.log('RAPORT:', JSON.stringify(raport))
}
declare global {
    interface StateUpdatePacket {
        testDone?: boolean
    }
    namespace ig {
        interface MapSharedVars {
            testDone?: boolean
        }
    }
}
prestart(() => {
    if (!TEST) return
    addStateHandler({
        get(packet) {
            packet.testDone = ig.mapShared?.testDone
        },
        set(packet) {
            if (!packet.testDone) return

            createAndSendRaport()

            assert(ig.ccmap)
            scheduleTask(ig.ccmap.inst, () => {
                for (const client of ig.ccmap!.clients) {
                    runTask(multi.server.inst, () => multi.server.leaveClient(client))
                }
            })
        },
    })
})
