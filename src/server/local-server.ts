import type { DeterMineInstance } from 'cc-determine/src/instance'
import { Client } from '../client/client'
import { copyTickInfo, startGameLoop } from '../game-loop'
import { prestart } from '../plugin'
import { CCMap } from './ccmap'
import { Player } from './player'
import { Server, ServerSettings } from './server'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { LocalServerConsoleDialog } from './local-server-console'

export interface LocalServerSettings extends ServerSettings {
    slotName?: string
    host?: string
    port?: number
    displayMaps?: boolean
    disableMapDisplayCameraMovement?: boolean

    // unloadInactiveMapsMs?: number /* set to -1 to disable unloading inactive maps */
}

export class LocalServer implements Server<LocalServerSettings> {
    maps: Record<string, CCMap> = {}
    mapsById: Record<number, CCMap> = {}

    baseInst!: InstanceinatorInstance
    serverInst!: InstanceinatorInstance
    serverDeterminism!: DeterMineInstance

    consoleDialog!: LocalServerConsoleDialog

    clients: Record<string, Client> = {}

    constructor(public s: LocalServerSettings) {}

    async start() {
        instanceinator.Instance.resetInstanceIdCounter()
        this.baseInst = instanceinator.Instance.currentReference('base', false)
        instanceinator.append(this.baseInst)

        this.serverInst = await instanceinator.Instance.copy(this.baseInst, 'server', this.s.displayMaps)
        instanceinator.append(this.serverInst)
        this.serverInst.apply()
        this.serverDeterminism = new determine.Instance('welcome to hell')
        determine.apply(this.serverDeterminism)

        if (!multi.headless) /* update tiling */ sc.options._setDisplaySize()

        startGameLoop()

        this.consoleDialog = new LocalServerConsoleDialog()
        this.consoleDialog.openServerConsole()

        if (!window.crossnode?.options.test) {
            const player = new Player('player1')
            await player.teleport('rhombus-dng.room-1', undefined)
        }
    }

    update() {
        ig.game.update()

        for (const name in this.maps) {
            const map = this.maps[name]
            if (!map.inst) continue
            copyTickInfo(this.serverInst, map.inst)
            map.inst.apply()
            determine.apply(map.determinism)
            ig.game.update()
        }
        this.serverInst.apply()
        determine.apply(this.serverDeterminism)
    }

    deferredUpdate() {
        ig.game.deferredUpdate()

        for (const name in this.maps) {
            const map = this.maps[name]
            if (!map.inst) continue
            copyTickInfo(this.serverInst, map.inst)
            map.inst.apply()
            determine.apply(map.determinism)
            ig.game.deferredUpdate()
            ig.input.clearPressed()
        }

        this.serverInst.apply()
        determine.apply(this.serverDeterminism)
        ig.input.clearPressed()
    }

    async loadMap(name: string) {
        if (this.maps[name]) this.maps[name].destroy()
        const map = new CCMap(name)
        this.maps[name] = map
        await map.load()
        this.mapsById[map.inst.id] = map
    }

    destroy() {
        this.baseInst.apply()

        determine.apply(determine.instances[0])
        this.consoleDialog.destroy()
        for (const map of Object.values(this.maps)) {
            map.destroy()
        }
        instanceinator.delete(this.serverInst)
        instanceinator.delete(this.baseInst)

        determine.delete(this.serverDeterminism)
        determine.apply(determine.instances[0])
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

export function waitForScheduledTask(inst: InstanceinatorInstance, task: () => Promise<void> | void) {
    return new Promise<void>(resolve => {
        inst.ig.game.scheduledTasks.push(async () => {
            await task()
            resolve()
        })
    })
}
