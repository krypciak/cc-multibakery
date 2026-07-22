import { assert } from '../../misc/assert'
import { CCMapDisplay } from './display'
import { MapDataLoad } from './data-load'
import { forceConditionalLightOnInst } from '../../client/conditional-light'
import type { Client } from '../../client/client'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { InstanceUpdateable } from '../instance-updateable'
import { linkMapVars } from './map-var-link'
import { linkOptions } from '../physics/storage/storage'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { MapName } from '../../net/binary/binary-types'
import { instanceinatorCopyInstanceConfig } from '../server'
import { createNetid, type EntityNetid } from '../../misc/entity-netid'
import { isRemote } from '../remote/remote-server-types'
import { assertPhysics } from '../physics/physics-server-types'
import type { TestConfig } from '../../test/test-bridge'
import { createServerTpsLabel } from '../../client/instance-label-draw'
import { profile } from '../../misc/profile-decorator'

import './injects'

declare global {
    namespace ig {
        var ccmap: CCMap | undefined

        interface MapSharedVars {
            ccmap: CCMap
        }
        var mapShared: MapSharedVars
    }
}

export interface OnLinkChange {
    onClientLink?(this: this, client: Client): void
    onClientUnlink?(this: this, client: Client): void
}

export class CCMap extends InstanceUpdateable {
    private static mapUniqueCounter: Record<string, number> = {}
    private static mapDataCache: Record<string, sc.MapModel.Map> = {}
    private static async loadMapData(name: string): Promise<sc.MapModel.Map> {
        let data = this.mapDataCache[name]
        if (data) {
            return {
                ...data,
                layer: data.layer.map(layer => ({ ...layer, data: layer.data.map(arr => [...arr]) })),
            }
        }

        const path = CCMap.mapNameToFilePath(name)
        data = await new Promise<sc.MapModel.Map>(resolve => {
            $.ajax({
                dataType: 'json',
                url: path,
                context: this,
                success: resolve,
                error: (b, c, e) => {
                    ig.system.error(Error("Loading of Map '" + this.name + "' failed: " + b + ' / ' + c + ' / ' + e))
                },
            })
        })
        this.mapDataCache[name] = data
        return data
    }

    private fsName: string

    clients: Client[] = []

    display!: CCMapDisplay

    initialized: boolean = false
    initPromise!: Promise<void>
    private initResolve!: () => void

    ready: boolean = false
    private readyPromise!: Promise<void>
    private readyResolve!: () => void

    noStateAppliedYet: boolean = true
    onLinkChange: OnLinkChange[] = []
    forceUpdateForFrames: number = 0

    private netidReserve = {
        entityTypeIdCounterMap: {} as ig.Game['entityTypeIdCounterMap'],
        entitiesByNetid: {} as ig.Game['entitiesByNetid'],
    }

    attachedTest?: TestConfig

    constructor(public name: MapName) {
        super()

        if (name.includes('@')) {
            let [baseName, suffix] = name.split('@')
            this.fsName = baseName
            if (!suffix) {
                CCMap.mapUniqueCounter[baseName] ??= 0
                suffix = `${CCMap.mapUniqueCounter[baseName]++}`
            }
            const newName = baseName + '@' + suffix

            this.name = newName
        } else {
            this.fsName = name
        }
    }

    reservePlayerNetid(): EntityNetid {
        assertPhysics(multi.server)
        return createNetid(
            dummy.DummyPlayer.classId,
            this.netidReserve.entityTypeIdCounterMap,
            this.netidReserve.entitiesByNetid
        )
    }

    private link() {
        const toLink = [linkMapVars, linkOptions, linkMapModel]
        for (const link of toLink) link(this.inst, multi.server.inst)
    }

    async initIfNeeded() {
        if (this.initPromise) return this.initPromise
        this.initPromise = new Promise<void>(resolve => {
            this.initResolve = () => {
                this.initialized = true
                resolve()
            }
        })
        await this.init()
        this.initResolve()
    }

    @profile((self: CCMap) => `${self.name} map`)
    private async init() {
        this.display = new CCMapDisplay(this)

        const levelDataPromise = this.getLevelData()
        this.inst = await instanceinator.copy(
            multi.server.baseInst,
            {
                name: `map-${this.name}`,
                display: this.isVisible(),
                soundPlayCondition: () => this.isVisible() || this.clients.some(c => c.inst.display),
            },
            instanceinatorCopyInstanceConfig()
        )
        this.inst.ig.ccmap = this
        this.inst.ig.mapShared = { ccmap: this } as any
        forceConditionalLightOnInst(this.inst.id)
        this.link()

        this.inst.ig.game.entityTypeIdCounterMap = this.netidReserve.entityTypeIdCounterMap
        this.inst.ig.game.entitiesByNetid = this.netidReserve.entitiesByNetid

        PROFILE && console.time(`${this.name} await level data`)
        const levelData = await levelDataPromise
        PROFILE && console.timeEnd(`${this.name} await level data`)

        runTask(this.inst, () => {
            MapDataLoad.setMapDataFromLevelData(levelData, this.name)
        })
        createServerTpsLabel(this.inst)
    }

    async loadResourcesIfNeeded() {
        if (this.readyPromise) return this.readyPromise

        this.readyPromise = new Promise<void>(resolve => {
            this.readyResolve = () => {
                this.ready = true
                resolve()
            }
        })
        await this.loadResources()
        this.readyResolve()
    }

    @profile((self: CCMap) => `${self.name}`)
    private async loadResources() {
        await runTask(this.inst, () => MapDataLoad.loadMapResources())
        runTask(this.inst, () => {
            sc.model.enterNewGame()
            sc.model.enterGame()

            this.display.setPosCameraHandle({ x: ig.game.size.x / 2, y: ig.game.size.y / 2 })
            this.display.removeUnneededGuis()
            this.display.addDummyUsernameBoxes()
        })

        instanceinator.retile()

        if (isRemote(multi.server)) {
            multi.server.onMapReady(this)
        }
    }

    attemptRecovery(e: unknown) {
        if (!multi.server.settings.attemptCrashRecovery) throw e

        if (!TEST) console.error(`ccmap crashed, inst: ${instanceinator.id}`, e)
        multi.server.unloadMap(this)

        if (TEST && this.attachedTest) tester.testCrashed(this.attachedTest)
    }

    isActive() {
        return (
            multi.server.settings.forceMapsActive ||
            !this.initialized ||
            this.forceUpdateForFrames != 0 ||
            this.clients.length > 0
        )
    }

    isVisible() {
        return (
            !!multi.server.settings.displayMaps &&
            this.initialized &&
            (multi.server.settings.displayInactiveMaps || this.isActive())
        )
    }

    static mapNameToFilePath(name: string): string {
        return ig.getFilePath(name.toPath(ig.root + 'data/maps/', '.json') + ig.getCacheSuffix())
    }

    async getLevelData() {
        return CCMap.loadMapData(this.fsName)
    }

    enter(client: Client) {
        assert(!this.clients.includes(client))
        this.clients.push(client)
    }

    leave(client: Client) {
        const prevLen = this.clients.length
        this.clients.erase(client)
        if (prevLen == this.clients.length) return

        this.forceUpdateForFrames = multi.server.settings.gameTps

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
        // console.log('map update')
        super.update()
        if (this.destroyed) return

        if (this.forceUpdateForFrames > 0) this.forceUpdateForFrames--
    }

    deferredUpdate() {
        super.deferredUpdate()
        if (this.destroyed) return

        ig.soundManager.update()
    }

    getClientInstances(includeMapInst?: boolean) {
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
