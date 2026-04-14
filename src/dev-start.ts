import { PhysicsServer, type PhysicsServerSettings } from './server/physics/physics-server'
import { DEFAULT_HTTP_PORT } from './client/menu/default-server-list'
import { addTitleScreenButton } from './misc/title-screen-button'
import { poststart, prestart } from './loading-stages'
import { instanceinatorCopyInstanceConfig } from './server/server'
import { Opts } from './options'

async function startDevServer() {
    if (!PHYSICS) return

    PROFILE && console.time('startDevServer')

    const settings: PhysicsServerSettings = {
        tps: 60,
        useAnimationFrameLoop: true,
        displayServerInstance: false,
        displayMaps: true,
        forceMapsActive: false,
        displayInactiveMaps: false,
        displayClientInstances: true,
        displayRemoteClientInstances: true,
        forceConsistentTickTimes: false,
        attemptCrashRecovery: false,
        mapSwitchDelay: Opts.serverMapSwitchDelay,
        godmode: true,
        disablePlayerIdlePose: true,
        // save: {
        //     manualSaving: true,
        //     automaticlySave: true,
        //     loadFromSlot: 0,
        // },
        netInfo: {
            connection: {
                httpPort: DEFAULT_HTTP_PORT,
                httpRoot: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/crosscode-web/dist',
                https: {
                    cert: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/crosscode-web/cert/localhost+1.pem',
                    key: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/crosscode-web/cert/localhost+1-key.pem',
                },
                // ccbundler: {
                //     modProxy: true,
                //     liveModUpdates: true,
                // },
                pingTimeout: 10000e3,
                type: 'socket',
            },
            details: {
                title: 'dev',
                description: 'dev server',
                iconPath: './assets/mods/cc-multibakery/icon/icon.png',
                // forceJsonCommunication: true,
            },
        },
        defaultMap: {
            // map: 'multibakery/dev',
            // map: 'multibakery/mba-pvp',
            // map: 'multibakery/mba-lobby',
            // map: 'multibakery/mba-testing',
            // map: 'multibakery/mba-outdoors',
            // map: 'multibakery/mba-south',
            // map: 'bergen/hideout-lobby',
            // map: 'xpc/bonus/training-1v1',
            map: 'rhombus-dng/room-1',
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
            // map: 'xpc/bonus/art-testing',
            // map: 'final-dng/b4/credits',
            // map: 'cursed/room-1',
            // map: 'cursed/room-1-end',
            // map: 'cursed/world',
            // map: 'cursed/room-1',
            // map: 'ark/beginner/bomb-switch',
            // map: 'ark/beginner/wave-block',
            // marker: 'entrance',
            // marker: 'puzzle',
            // marker: 'pvp',
            // marker: 'exit',
            // marker: 'door-west1',
            marker: 'blockPoint',
        },
    }
    const server = PHYSICS && new PhysicsServer(settings)
    multi.setServer(server)

    PROFILE && console.time('server start')
    await server.start()
    PROFILE && console.timeEnd('server start')

    if (window.crossnode?.options.test || !process.execPath.includes('server')) return
    PROFILE && console.time('client creation')
    server.setMasterClient(
        await server.forceCreateClient({
            username: `lea_${1}`,
            inputType: 'clone',
            remote: false,
        })
    )
    PROFILE && console.timeEnd('client creation')
    PROFILE && console.timeEnd('startDevServer')

    return
    let promises = []
    for (let i = 2; i <= 2; i++) {
        promises.push(
            server.forceCreateClient({
                username: `lea_${i}`,
                // noShowInstance: true || i != 2,
                inputType: 'clone',
                remote: false,
            })
        )
    }
    await Promise.all(promises)

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
    const groups = splitIntoRandomGroups(clients, 5)
    for (const group of groups) {
        const owner = group[0]
        for (let i = 1; i < group.length; i++) {
            const client = group[i]
            multi.server.party.invitePlayerTo(client.username, multi.server.party.getPartyOfEntity(owner.dummy))
        }
    }
}

function isInServerDir() {
    return process.execPath.includes('cc-server')
}
function isInClientDir() {
    return process.execPath.includes('cc-client')
}

prestart(() => {
    if (!PHYSICS || !isInServerDir()) return

    addTitleScreenButton({
        text: 'Start dev server',
        onClick: startDevServer,
    })
})

poststart(async () => {
    if (window.crossnode?.options.test) return

    if (PHYSICS && isInServerDir()) {
        startDevServer()
    } else if (REMOTE && isInClientDir()) {
        return
    }
}, 999)
