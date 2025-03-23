import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { LocalServer, waitForScheduledTask } from './local-server'
import { assert } from '../misc/assert'
import { ServerPlayer } from './server-player'
import { indent } from './local-server-console'
import { CCMapDisplay } from './ccmap-display'
import { setDataFromLevelData } from './ccmap-data-load'
import type { DeterMineInstance } from 'cc-determine/src/instance'
import { prestart } from '../plugin'
import { forceConditionalLightOnInst } from '../client/conditional-light'
import * as inputBackup from '../dummy/dummy-input'

export class CCMap {
    rawLevelData!: sc.MapModel.Map

    players: ServerPlayer[] = []
    // playersThatJustLeft!: Player
    // private unloadTimeoutId!: NodeJS.Timeout

    inst!: InstanceinatorInstance
    display!: CCMapDisplay
    determinism!: DeterMineInstance

    constructor(public name: string) {}

    async load() {
        assert(multi.server instanceof LocalServer)

        this.display = new CCMapDisplay(this)
        this.determinism = new determine.Instance('welcome to hell', false, true)

        const displayMaps = multi.server.s.displayMaps

        const levelDataPromise = this.readLevelData()
        this.inst = await instanceinator.copy(multi.server.baseInst, `map-${this.name}`, displayMaps)
        determine.append(this.determinism)
        forceConditionalLightOnInst(this.inst.id)

        const levelData = await levelDataPromise
        this.rawLevelData = levelData

        await waitForScheduledTask(this.inst, async () => {
            await setDataFromLevelData.call(ig.game, this.name, levelData)
            await waitForScheduledTask(this.inst, () => {
                sc.model.enterNewGame()
                sc.model.enterGame()

                this.display.setPosCameraHandle({ x: ig.game.size.x / 2, y: ig.game.size.y / 2 })
                this.display.removeUnneededGuis()
                this.display.addDummyUsernameBoxes()
            })
        })
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

    async enter(player: ServerPlayer) {
        player.mapName = this.name
        this.players.push(player)
        // this.stopUnloadTimer()

        await this.enterEntity(player.dummy)
        this.display.onPlayerCountChange(true)
    }

    async leave(player: ServerPlayer) {
        const prevLen = this.players.length
        this.players.erase(player)
        if (prevLen == this.players.length) return

        // const packet = (UpdatePacketGather.state[this.name] ??= {})
        // const playersLeft = (packet.playersLeft ??= [])
        // playersLeft.push(player.dummy.uuid)

        // this.startUnloadTimer()
        await this.leaveEntity(player.dummy)
        this.display.onPlayerCountChange(false)
    }

    private async enterEntity(e: ig.Entity) {
        if (e.isPlayer && e instanceof dummy.DummyPlayer && e.gui.crosshair) {
            /* this promise will finish by the end of this function, so there's no need to await it */
            this.enterEntity(e.gui.crosshair)
        }
        await waitForScheduledTask(this.inst, () => {
            ig.game.entitiesByUUID[e.uuid] = e

            const oldColl = e.coll
            e.coll = new ig.CollEntry(e)
            e.coll.setType(oldColl.type)
            e.coll.weight = oldColl.weight
            e.coll.friction = oldColl.friction
            e.coll.accelSpeed = oldColl.accelSpeed
            e.coll.maxVel = oldColl.maxVel
            e.coll.float = oldColl.float
            e.coll.shadow = oldColl.shadow
            Vec3.assign(e.coll.pos, oldColl.pos)
            Vec3.assign(e.coll.size, oldColl.size)

            if (e.name) {
                assert(!ig.game.namedEntities[e.mapId], 'map enterEntity namedEntities collision!')
                ig.game.namedEntities[e.name] = e
            }
            if (e.mapId) {
                assert(!ig.game.mapEntities[e.mapId], 'map enterEntity mapId collision!')
                ig.game.mapEntities[e.mapId] = e
            }
            ig.game.entities.push(e)
            e._hidden = true
            e.show()
        })
    }

    private async leaveEntity(e: ig.Entity) {
        if (e.isPlayer && e instanceof ig.ENTITY.Player) {
            /* this promise will finish by the end of this function, so there's no need to await it */
            this.leaveEntity(e.gui.crosshair)
        }

        await waitForScheduledTask(this.inst, () => {
            ig.game.entities.erase(e)
            delete ig.game.entitiesByUUID[e.uuid]
            e.clearEntityAttached()

            /* ig.game.removeEntity(e) */
            e.name && delete ig.game.namedEntities[e.name]

            // e._killed = e.coll._killed = true

            /* consequence of ig.game.detachEntity(e) */

            if (e.id) {
                ig.game.physics.removeCollEntry(e.coll)
                // this.physics.collEntryMap.forEach(a =>
                //     a.forEach(a =>
                //         a.forEach(c => {
                //             if (c.entity === e) {
                //                 a.erase(e.coll)
                //             }
                //         })
                //     )
                // )
                /* reactivate it cuz removeCollEntry set it to false */
                e.coll._active = true

                ig.game.shownEntities[e.id] = null
                // this.freeEntityIds.push(e.id)
                // e.id = 0
            }
        })
    }

    preUpdate() {
        for (const player of this.players) player.preUpdate()
    }

    // public startUnloadTimer() {
    //     return
    //     // if (this.alwaysLoaded || this.players.length != 0) return
    //     //
    //     // const waitTime = multi.server.s.unloadInactiveMapsMs
    //     // if (waitTime === undefined || waitTime == -1) return
    //     //
    //     // this.unloadTimeoutId = setTimeout(() => {
    //     //     multi.server.unloadMap(this)
    //     // }, waitTime)
    // }
    // public stopUnloadTimer() {
    //     if (this.unloadTimeoutId) clearTimeout(this.unloadTimeoutId)
    // }

    async destroy() {
        for (const player of this.players) await player.destroy()
        assert(instanceinator.id != this.inst.id)
        instanceinator.delete(this.inst)
        determine.delete(this.determinism)
    }

    toConsoleString(i: number = 0): string {
        let str = ''
        str += indent(i) + `map ${this.name}: {\n`
        if (this.display.cameraTarget) str += indent(i + 1) + this.display.toConsoleString()
        str += indent(i + 1) + `players: [\n`
        for (const player of this.players) str += player.toConsoleString(i + 2)
        str += indent(i + 1) + `]\n`
        str += indent(i) + `}\n`
        return str
    }
}

prestart(() => {
    const backup = ig.CollTools.isInScreen
    ig.CollTools.isInScreen = function (e: ig.Entity, x?: number, y?: number) {
        if (multi.server instanceof LocalServer) return true
        return backup(e, x, y)
    }

    sc.Combat.inject({
        getPartyHpFactor(party) {
            if (!(multi.server instanceof LocalServer)) return this.parent(party)
            const map = multi.server.mapsById[instanceinator.id]
            assert(map)

            ig.game.playerEntity = map.players[0].dummy
            const ret = this.parent(party)
            ig.game.playerEntity = undefined as any
            return ret
        },
    })

    // @ts-expect-error
    ig.ACTION_STEP.ADD_PLAYER_CAMERA_TARGET.inject({
        start() {
            if (!multi.server) return this.parent()
            assert(ig.game.playerEntity == undefined)
            ig.game.playerEntity = {
                // @ts-expect-error
                hasCameraTarget: () => true,
            }
            this.parent()
            ig.game.playerEntity = undefined as any
        },
    })

    ig.SlowMotion.inject({
        /* fix slow motion (by disabling it) */
        add(factor, timer, name) {
            if (!multi.server) return this.parent(factor, timer, name)

            const handle = new ig.SlowMotionHandle(factor, timer, name)
            // this.slowMotions.push(b)
            if (name) {
                if (this.namedSlowMotions[name]) {
                    this.namedSlowMotions[name].clear()
                    this.namedSlowMotions[name].name = null
                }
                this.namedSlowMotions[name] = handle
            }
            return handle
        },
    })

    function getMap(assertMap = false) {
        if (!(multi.server instanceof LocalServer)) return
        const map = multi.server.mapsById[instanceinator.id]
        if (assertMap) assert(map)
        return map
    }

    sc.EnemyType.inject({
        resolveItemDrops(enemyEntity) {
            const map = getMap(true)
            if (!map) return this.parent(enemyEntity)
            assert(!ig.game.playerEntity)
            ig.game.playerEntity = map.players[0].dummy
            this.parent(enemyEntity)
            ig.game.playerEntity = undefined as any
        },
    })

    dummy.DummyPlayer.inject({
        kill(_levelChange) {},
        _onDeathHit(a) {
            if (!multi.server || !(this instanceof dummy.DummyPlayer)) return this.parent(a)

            if (this.dying == sc.DYING_STATE.ALIVE) {
                this.dying = sc.DYING_STATE.KILL_HIT
                // sc.combat.onCombatantDeathHit(a, this)
                ig.EffectTools.clearEffects(this)

                if (!this.skipRumble) {
                    const effect = new ig.Rumble.RumbleHandle('RANDOM', 'STRONG', 'FASTER', 0.3, false, true)
                    ig.rumble.addRumble(effect)
                }
                if (!sc.pvp.isCombatantInPvP(this)) {
                    this.effects.death.spawnOnTarget('pre_die', this, { duration: -1 })
                    this.coll.type = ig.COLLTYPE.IGNORE
                }

                this.dying = sc.DYING_STATE.ALIVE
                this.params.revive()

                ig.EffectTools.clearEffects(this)
                this.resetStunData()
            }
        },
    })

    sc.MapInteract.inject({
        onPreUpdate() {
            if (this instanceof sc.MapInteractServerPlayer) return this.parent()
            const map = getMap()
            if (!map) return this.parent()
        },
    })

    sc.ItemDropEntity.inject({
        onKill() {
            const map = getMap(true)
            if (!map) return this.parent()
            assert(!ig.game.playerEntity)
            assert(this.target instanceof dummy.DummyPlayer)
            inputBackup.apply(this.target.inputManager)
            this.parent()
            inputBackup.restore()
        },
    })
})
