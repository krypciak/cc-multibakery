import { OnlineMap } from './online-map'
import { createSlot } from './save-slot'

declare global {
    namespace ig {
        var multiplayer: Multiplayer
    }
}
export const DEFAULT_PORT = 33405

export type PlayerId = string
type Server = Awaited<ReturnType<typeof createServer>>

export type ServerSettings = {
    name: string
    slotName: string
    host: string
    port: number
    globalTps: number
    entityTickSkipEvery: number
    physicsTickSkipEvery: number
}

export async function createServer(settings: ServerSettings) {
    await createSlot(settings.slotName)
    return {
        ...settings,
        maps: [] as OnlineMap[],
        getPlayers() {
            throw new Error('not implemented')
        },
    }
}
export function appendServer(server: Server) {
    ig.multiplayer.servers[server.name] = server
}

export class Multiplayer {
    headless: boolean = false

    servers: Record<string, Server> = {}
    /* current processed server */
    server!: Server
    map!: OnlineMap

    get globalTps(): number {
        return Math.max(...Object.values(this.servers).map(s => s.globalTps))
    }

    constructor() {
        import('./game-loop')
    }

    start() {
        /* for now at least, only 1 server supported per cc instance */
        this.server = Object.values(this.servers)[0]
    }

    allMapEntityTick() {
        for (const map of this.server.maps) {
            this.map = map
            map.entityTick()
        }
    }

    allMapPhysicsTick() {
        for (const map of this.server.maps) {
            this.map = map
            map.physicsTick()
        }
    }
}
