import { Client } from '../client/client'
import { startGameLoop } from '../game-loop'
import { prestart } from '../plugin'
import { CCMap } from './ccmap'
import { initConsoleDialog, openServerConsole } from './local-server-console'
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

    consoleDialog!: modmanager.gui.MultiPageButtonBoxGui

    clients: Record<string, Client> = {}

    constructor(public s: LocalServerSettings) {}

    async start() {
        instanceinator.Instance.resetInstanceIdCounter()
        this.baseInst = instanceinator.Instance.currentReference('base', false)
        instanceinator.append(this.baseInst)

        this.serverInst = await instanceinator.Instance.copy(this.baseInst, 'server', true)
        instanceinator.append(this.serverInst)
        this.serverInst.apply()

        /* update tiling */
        sc.options._setDisplaySize()

        startGameLoop()

        initConsoleDialog()
        setTimeout(() => this.serverInst.ig.game.scheduledTasks.push(() => openServerConsole()), 400)

        this.loadMap('rhombus-dng.room-1')
    }

    update() {
        ig.game.update()

        for (const name in this.maps) {
            const map = this.maps[name]
            if (!map.inst) continue
            map.inst.apply()
            ig.game.update()
        }
        this.serverInst.apply()
    }
    deferredUpdate() {
        ig.game.deferredUpdate()
        ig.input.clearPressed()

        for (const name in this.maps) {
            const map = this.maps[name]
            if (!map.inst) continue
            map.inst.apply()
            ig.game.deferredUpdate()
        }
        this.serverInst.apply()
    }

    async loadMap(name: string) {
        const map = new CCMap(name)
        this.maps[name] = map
        await map.load()
    }
}

prestart(() => {
    ig.Game.inject({
        draw() {
            if (!(multi.server instanceof LocalServer) || instanceinator.instanceId != multi.server.serverInst.id)
                return this.parent()

            // for (var b in this.levels)
            //     for (var a = 0; a < this.levels[b].maps.length; a++)
            //         this.levels[b].maps[a].setScreenPos(this.screen.x, this.screen.y)

            // for (const addon of this.addons.preDraw) addon.onPreDraw()
            // ig.system.startZoomedDraw()
            this.renderer.prepareDraw([])
            // this.renderer.drawLayers()
            // for (const addon of this.addons.midDraw) addon.onMidDraw()
            // this.renderer.drawPostLayerSprites()
            // ig.system.endZoomedDraw()
            for (const addon of this.addons.postDraw) addon.onPostDraw()

            multi.server.serverInst.drawLabel()
        },
    })
})
