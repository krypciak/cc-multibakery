import { assert } from '../../misc/assert'
import { CCMapDisplay } from './display'
import { setDataFromLevelData } from './data-load'
import { forceConditionalLightOnInst } from '../../client/conditional-light'
import { Client } from '../../client/client'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { InstanceUpdateable } from '../instance-updateable'
import { linkMapVars } from './map-var-link'
import { linkOptions } from '../physics/storage/storage'
import { linkMusic } from '../music'
import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

import './injects'

declare global {
    namespace ig {
        var ccmap: CCMap | undefined
    }
}

export interface OnLinkChange {
    onClientLink(this: this, client: Client): void
    onClientUnlink(this: this, client: Client): void
}

export class CCMap extends InstanceUpdateable {
    rawLevelData!: sc.MapModel.Map

    clients: Client[] = []

    display!: CCMapDisplay

    ready: boolean = false
    readyPromise: Promise<void>
    private readyResolve!: () => void
    noStateAppliedYet: boolean = true
    onLinkChange: OnLinkChange[] = []
    forceUpdateForFrames: number = 0

    constructor(public name: string) {
        super()
        this.readyPromise = new Promise<void>(resolve => {
            this.readyResolve = () => {
                this.ready = true
                resolve()
            }
        })
    }

    private link() {
        const toLink = [linkMapVars, linkOptions, linkMusic, linkMapModel, linkTimersModel]
        for (const link of toLink) link(this.inst, multi.server.inst)
    }

    async init() {
        this.display = new CCMapDisplay(this)

        const levelDataPromise = this.readLevelData()
        this.inst = await instanceinator.copy(multi.server.inst, {
            name: `map-${this.name}`,
            display: this.isVisible(),
            soundPlayCondition: () => this.clients.some(c => c.inst.display),
        })
        this.inst.ig.ccmap = this
        forceConditionalLightOnInst(this.inst.id)
        this.link()

        const levelData = await levelDataPromise
        this.rawLevelData = levelData

        await runTask(this.inst, async () => {
            await setDataFromLevelData.call(ig.game, this.name, levelData)
            runTask(this.inst, () => {
                sc.model.enterNewGame()
                sc.model.enterGame()

                this.display.setPosCameraHandle({ x: ig.game.size.x / 2, y: ig.game.size.y / 2 })
                this.display.removeUnneededGuis()
                this.display.addDummyUsernameBoxes()
            })
        })
        this.readyResolve()
    }

    attemptRecovery(e: unknown) {
        if (!multi.server.settings.attemptCrashRecovery) throw e

        console.error(`ccmap crashed, inst: ${instanceinator.id}`, e)
        multi.server.unloadMap(this)
    }

    isActive() {
        return (
            multi.server.settings.forceMapsActive ||
            !this.ready ||
            this.forceUpdateForFrames != 0 ||
            this.clients.length > 0
        )
    }

    isVisible() {
        return (
            !!multi.server.settings.displayMaps &&
            this.ready &&
            (multi.server.settings.displayInactiveMaps || this.isActive())
        )
    }

    private async readLevelData() {
        return new Promise<sc.MapModel.Map>(resolve => {
            $.ajax({
                dataType: 'json',
                url: ig.getFilePath(this.name.toPath(ig.root + 'data/maps/', '.json') + ig.getCacheSuffix()),
                context: this,
                success: resolve,
                error: (b, c, e) => {
                    ig.system.error(Error("Loading of Map '" + this.name + "' failed: " + b + ' / ' + c + ' / ' + e))
                },
            })
        })
    }

    enter(client: Client) {
        assert(!this.clients.includes(client))
        this.clients.push(client)
    }

    leave(client: Client) {
        const prevLen = this.clients.length
        this.clients.erase(client)
        if (prevLen == this.clients.length) return

        this.forceUpdateForFrames = multi.server.settings.tps

        if (client.dummy) this.leaveEntity(client.dummy)
    }

    private leaveEntity(e: ig.Entity) {
        if (e.isPlayer && e instanceof ig.ENTITY.Player) {
            this.leaveEntity(e.gui.crosshair)
        }

        assert(instanceinator.id == multi.server.inst.id)
        runTask(this.inst, () => {
            e.kill()
        })
    }

    update() {
        super.update()
        if (this.forceUpdateForFrames > 0) this.forceUpdateForFrames--
    }

    getAllInstances(includeMapInst?: boolean) {
        const insts = this.clients.map(client => client.inst)
        if (includeMapInst) insts.push(this.inst)
        return insts
    }

    destroy() {
        if (this.destroyed) return

        for (const client of this.clients) {
            multi.server.leaveClient(client)
        }

        multi.server.inst.apply()
        super.destroy()
    }
}

function linkMapModel(toInst: InstanceinatorInstance, fromInst: InstanceinatorInstance) {
    const to = toInst.sc.map
    const from = fromInst.sc.map

    to.areas = from.areas
    to.areasVisited = from.areasVisited
    to.activeLandmarks = from.activeLandmarks
}

export function linkTimersModel(toInst: InstanceinatorInstance, fromInst: InstanceinatorInstance) {
    const to = toInst.sc.timers
    const from = fromInst.sc.timers

    to.timers = from.timers
}
