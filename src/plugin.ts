import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import { Mod1 } from './types'
import { DEFAULT_PORT, Multiplayer, appendServer, createServer } from './global'

export default class Server implements PluginClass {
    static dir: string
    static mod: Mod1

    constructor(mod: Mod1) {
        Server.dir = mod.baseDirectory
        Server.mod = mod
        Server.mod.isCCL3 = mod.findAllAssets ? true : false
        Server.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
    }

    async prestart() {
        await import('./skip-title-screen')
        ig.multiplayer = new Multiplayer()
    }

    async poststart() {
        initTestServer()

        async function initTestServer() {
            const server = await createServer({
                name: 'example',
                slotName: 'example',
                host: 'localhost',
                port: DEFAULT_PORT,
                globalTps: 60,
                entityTickSkipEvery: 0,
                physicsTickSkipEvery: 0,
            })
            appendServer(server)
        }
    }
}
