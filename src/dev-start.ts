import { PhysicsServer, type PhysicsServerSettings } from './server/physics/physics-server'
import { DEFAULT_HTTP_PORT } from './client/menu/default-server-list'
import { addTitleScreenButton } from './misc/title-screen-button'
import { poststart, prestart } from './loading-stages'
import { Opts } from './options'
import { assert } from './misc/assert'
import type { MapTpInfo } from './server/server'
import { tryJoinRemote } from './server/remote/try-join-remote'
import { getServerDetails } from './net/web-server'
import type { RemoteServerConnectionSettings } from './server/remote/remote-server'
import { profile } from './misc/profile-decorator'

const defaultMap: MapTpInfo = {
    map: 'multibakery/dev',
    // map: 'multibakery/mba-pvp',
    // map: 'tree-dng/f4/boss',
    // map: 'multibakery/mba-lobby',
    // map: 'multibakery/mba-testing',
    // map: 'multibakery/mba-outdoors',
    // map: 'multibakery/mba-south',
    // map: 'bergen/hideout-lobby',
    // map: 'xpc/bonus/training-1v1',
    // map: 'rhombus-dng/room-1',
    // map: 'rhombus-dng/room-1-6',
    // map: 'rhombus-dng/boss',
    // map: 'rhombus-sqr/dng-end',
    // map: 'rhombus-sqr/central-inner',
    // map: 'cargo-ship/room2',
    // map: 'rookie-harbor/teleporter',
    // map: 'rookie-harbor/center',
    // map: 'autumn/entrance',
    // map: 'autumn/path4',
    // map: 'autumn/guild/inner-fs-og',
    // map: 'rookie-harbor/inner-harbor-pub',
    // map: 'rhombus-dng/room-2',
    // map: 'rookie-harbor/inner-info-ug-1',
    // map: 'rhombus-dng/room-3-2-post',
    // map: 'rhombus-sqr/central-inner',
    // map: 'rookie-harbor/south',
    // map: 'forest/path-10',
    // map: 'xpc/bonus/art-testing',
    // map: 'final-dng/b4/credits',
    // map: 'cursed/room-1',
    // map: 'cursed/room-1-end',
    // map: 'cursed/world',
    // map: 'cursed/room-1',
    // map: 'ark/beginner/bomb-switch',
    // map: 'ark/beginner/wave-block',
    marker: 'entrance',
    // marker: 'puzzle',
    // marker: 'pvp',
    // marker: 'to_pvp',
    // marker: 'exit',
    // marker: 'door-west1',
    // marker: 'blockPoint',
}

function createSettings(): PhysicsServerSettings {
    return {
        gameTps: 60,
        useAnimationFrameLoop: true,
        displayServerInstance: false,
        displayMaps: false,
        forceMapsActive: false,
        displayInactiveMaps: false,
        displayClientInstances: true,
        displayRemoteClientInstances: true,
        forceConsistentTickTimes: false,
        attemptCrashRecovery: false,
        mapSwitchDelay: Opts.serverMapSwitchDelay,
        godmode: true,
        disablePlayerIdlePose: true,
        save: true
            ? undefined
            : {
                  manualSaving: true,
                  automaticlySave: true,
                  loadFromSlot: 0,
              },
        netInfo: false
            ? undefined
            : {
                  connection: {
                      httpPort: DEFAULT_HTTP_PORT,
                      https: {
                          cert: '/home/krypek/Programming/crosscode/instances/cc-ccloader3/crosscode-web/cert/localhost+1.pem',
                          key: '/home/krypek/Programming/crosscode/instances/cc-ccloader3/crosscode-web/cert/localhost+1-key.pem',
                      },
                      crosscodeWeb: true
                          ? undefined
                          : {
                                httpRoot:
                                    '/home/krypek/Programming/crosscode/instances/cc-ccloader3/crosscode-web/dist',
                                modProxy: true,
                                liveModUpdates: true,
                            },
                      pingTimeout: 10000e3,
                      transport: {
                          type: 'socket.io',
                          // type: 'websocket',
                          // disableBinaryParser: true,
                      },
                  },
                  details: {
                      title: 'dev',
                      description: 'dev server',
                      iconPath: './assets/mods/cc-multibakery/icon/icon.png',
                      // forceJsonCommunication: true
                  },
                  // discovery: true,
              },
        defaultMap,
    }
}

class DevStart {
    private static server: PhysicsServer

    @profile()
    static async startDevServer() {
        if (!PHYSICS) return
        if (!DEV) return

        const settings = createSettings()
        this.server = PHYSICS && new PhysicsServer(settings)
        multi.setServer(this.server)

        await this.startServer()
        await this.createClients(1)

        if (false as boolean) splitClientsIntoGroups(5)
    }

    @profile()
    private static async startServer() {
        await this.server.start()
    }

    @profile()
    private static async createClients(count: number) {
        if (count == 0) return
        const { client } = await multi.server.createAndJoinClient({ username: `lea_${1}` }, { awaitClientJoin: true })
        assert(client)
        multi.server.setMasterClient(client)

        let promises = []
        for (let i = 2; i <= count; i++) {
            promises.push(multi.server.createAndJoinClient({ username: `lea_${i}` }, { awaitClientJoin: true }))
        }
        await Promise.all(promises)
    }
}

function splitClientsIntoGroups(groupSize: number) {
    function splitIntoRandomGroups<T>(arr: T[], n: number): T[][] {
        if (n <= 0) throw new Error('n must be > 0')
        if (n > arr.length) throw new Error('n cannot exceed array length')

        // Choose n−1 random split points between 1 and arr.length−1
        const splitPoints = new Set<number>()

        while (splitPoints.size < n - 1) {
            const r = Math.floor(Math.random() * (arr.length - 1)) + 1
            splitPoints.add(r)
        }

        const sorted = Array.from(splitPoints).sort((a, b) => a - b)

        // Build subarrays
        const result: T[][] = []
        let prev = 0

        for (const p of sorted) {
            result.push(arr.slice(prev, p))
            prev = p
        }

        // Last chunk
        result.push(arr.slice(prev))

        return result
    }

    const clients = [...multi.server.clients.values()]
    const groups = splitIntoRandomGroups(clients, groupSize)
    for (const group of groups) {
        const owner = group[0]
        for (let i = 1; i < group.length; i++) {
            const client = group[i]
            multi.server.party.invitePlayerTo(client.username, multi.server.party.getPartyOfEntity(owner.dummy))
        }
    }
}

function isInServerDir() {
    return process.execPath.includes('cc-server') || process.execPath.endsWith('/bun')
}
function isInClientDir() {
    return process.execPath.includes('cc-client')
}

prestart(() => {
    if (!PHYSICS || !isInServerDir() || !DEV) return

    addTitleScreenButton({
        text: 'Start dev server',
        onClick: () => DevStart.startDevServer(),
    })
})

poststart(() => {
    if (!DEV || TEST) return

    if (PHYSICS && isInServerDir()) {
        DevStart.startDevServer()
    } else if (REMOTE && isInClientDir()) {
        ;(async () => {
            const connection: RemoteServerConnectionSettings = {
                host: '127.0.0.1',
                port: DEFAULT_HTTP_PORT,
                https: true,
            }
            const { details } = (await getServerDetails(connection)) ?? {}
            if (details) {
                tryJoinRemote({ connection, details }, { username: Opts.clientLogin })
            }
        })()
    }
}, 999)
