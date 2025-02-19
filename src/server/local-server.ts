import { Client } from '../client/client'
import { copyTickInfo, startGameLoop } from '../game-loop'
import { Server, ServerSettings } from './server'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

export interface LocalServerSettings extends ServerSettings {
    slotName: string
    host: string
    port: number

    // unloadInactiveMapsMs?: number /* set to -1 to disable unloading inactive maps */
}

export class LocalServer implements Server<LocalServerSettings> {
    maps: Record<string, CCMap> = {}

    baseInst!: InstanceinatorInstance
    serverInst!: InstanceinatorInstance

    clients: Record<string, Client> = {}

    constructor(public s: LocalServerSettings) {}

    async start() {
        instanceinator.Instance.resetInstanceIdCounter()
        this.baseInst = instanceinator.Instance.currentReference('base', true)
        instanceinator.append(this.baseInst)

        this.serverInst = await instanceinator.Instance.copy(this.baseInst, 'server', true)
        instanceinator.append(this.serverInst)

        /* update tiling */
        sc.options._setDisplaySize()

        startGameLoop()
    }

    update() {
        copyTickInfo(this.baseInst, this.serverInst)
        this.serverInst.apply()

        ig.game.update()

        this.baseInst.apply()
    }
    deferredUpdate() {
        copyTickInfo(this.baseInst, this.serverInst)
        this.serverInst.apply()

        ig.game.deferredUpdate()
        ig.input.clearPressed()

        this.baseInst.apply()
    }
}
