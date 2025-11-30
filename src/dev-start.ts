import { PhysicsServer } from './server/physics/physics-server'
import { DEFAULT_HTTP_PORT } from './client/menu/default-server-list'
import { addTitleScreenButton } from './misc/title-screen-button'
import { poststart, prestart } from './loading-stages'
import { Opts } from './options'

async function startDevServer() {
    if (!PHYSICS) return

    PHYSICS && multi.setServer(
        new PhysicsServer({
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
                    httpRoot: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/dist',
                    https: {
                        cert: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/cert/localhost+1.pem',
                        key: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/cert/localhost+1-key.pem',
                    },
                    // ccbundler: {
                    //     modProxy: true,
                    //     liveModUpdates: true,
                    // },
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
                map: 'multibakery/dev',
                // map: 'multibakery/pvp-test',
                // map: 'multibakery/fish-minigame-test',
                // map: 'rhombus-dng/room-1',
                // map: 'rhombus-dng/boss',
                // map: 'rhombus-sqr/dng-end',
                // map: 'rhombus-sqr/central-inner',
                // map: 'rookie-harbor/teleporter',
                // map: 'rookie-harbor/center',
                // map: 'autumn/path-2',
                // map: 'rookie-harbor/inner-harbor-pub',
                // map: 'rhombus-dng/room-2',
                // map: 'rookie-harbor/inner-info-ug-1',
                // map: 'rhombus-dng/room-3-2-post',
                // map: 'rhombus-sqr/central-inner',
                // map: 'rookie-harbor/south',
                // map: 'xpc/bonus/art-testing',
                // marker: 'entrance',
                // marker: 'puzzle',
                marker: 'pvp',
                // marker: 'exit',
                // marker: 'door-west1',
            },
        })
    )
    await multi.server.start()

    if (!window.crossnode?.options.test && process.execPath.includes('server')) {
        multi.server.setMasterClient(
            await multi.server.createAndJoinClient({
                username: `lea_${1}`,
                inputType: 'clone',
                remote: false,
            })
        )
        // await this.createAndJoinClient({
        //     username: `obama`,
        //     inputType: 'clone',
        //     remote: false,
        // })
        // await this.createAndJoinClient({
        //     username: `lea_${3}`,
        //     inputType: 'clone',
        //     forceInputType: ig.INPUT_DEVICES.GAMEPAD,
        // })
        let promises = []
        for (let i = 2; i <= 3; i++) {
            promises.push(
                multi.server.createAndJoinClient({
                    username: `lea_${i}`,
                    noShowInstance: true || i != 2,
                    inputType: 'clone',
                    remote: false,
                })
            )
        }
        await Promise.all(promises)
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

poststart(() => {
    if (window.crossnode?.options.test) return

    if (PHYSICS && isInServerDir()) {
        startDevServer()
    } else if (REMOTE && isInClientDir()) {
        return
    }
}, 999)
