import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { waitForScheduledTask } from './server'
import { assert } from '../misc/assert'
import { ServerPlayer } from './server-player'
import { CCMapDisplay } from './ccmap-display'
import { setDataFromLevelData } from './ccmap-data-load'
import type { DeterMineInstance } from 'cc-determine/src/instance'
import { prestart } from '../plugin'
import { forceConditionalLightOnInst } from '../client/conditional-light'
import * as inputBackup from '../dummy/dummy-input'

declare global {
    namespace ig {
        var ccmap: CCMap | undefined
    }
}

export class CCMap {
    rawLevelData!: sc.MapModel.Map

    players: ServerPlayer[] = []

    inst!: InstanceinatorInstance
    display!: CCMapDisplay
    determinism!: DeterMineInstance

    ready: boolean = false
    readyPromise: Promise<void>
    private readyResolve!: () => void
    noStateAppliedYet: boolean = true

    constructor(
        public name: string,
        private remote: boolean
    ) {
        this.readyPromise = new Promise<void>(resolve => {
            this.readyResolve = () => {
                this.ready = true
                resolve()
            }
        })
    }

    async load() {
        this.display = new CCMapDisplay(this)
        this.determinism = new determine.Instance('welcome to hell', false, true)

        const displayMaps = multi.server.settings.displayMaps

        const levelDataPromise = this.readLevelData()
        this.inst = await instanceinator.copy(multi.server.baseInst, `map-${this.name}`, displayMaps)
        this.inst.ig.ccmap = this
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
        this.readyResolve()
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

        await this.enterEntity(player.dummy)
        this.display.onPlayerCountChange(true)
    }

    async leave(player: ServerPlayer) {
        const prevLen = this.players.length
        this.players.erase(player)
        if (prevLen == this.players.length) return

        await this.leaveEntity(player.dummy)
        this.display.onPlayerCountChange(false)
    }

    private async enterEntity(e: ig.Entity) {
        if (this.remote) return

        if (e.isPlayer && e instanceof dummy.DummyPlayer && e.gui.crosshair) {
            /* this promise will finish by the end of this function, so there's no need to await it */
            this.enterEntity(e.gui.crosshair)
        }
        await waitForScheduledTask(this.inst, () => {
            ig.game.entitiesByNetid[e.netid] = e

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
        if (this.remote) return

        if (e.isPlayer && e instanceof ig.ENTITY.Player) {
            /* this promise will finish by the end of this function, so there's no need to await it */
            this.leaveEntity(e.gui.crosshair)
        }

        await waitForScheduledTask(this.inst, () => {
            ig.game.entities.erase(e)
            delete ig.game.entitiesByNetid[e.netid]
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

    async destroy() {
        for (const player of this.players) await player.destroy()
        if (this.inst) {
            multi.server.serverInst.apply()
            instanceinator.delete(this.inst)
        }
        if (this.determinism) determine.delete(this.determinism)
    }
}

prestart(() => {
    const backup = ig.CollTools.isInScreen
    ig.CollTools.isInScreen = function (e: ig.Entity, x?: number, y?: number) {
        if (multi.server && !ig.client) return true
        return backup(e, x, y)
    }

    sc.Combat.inject({
        getPartyHpFactor(party) {
            if (!multi.server) return this.parent(party)

            assert(ig.ccmap)
            ig.game.playerEntity = ig.ccmap.players[0].dummy
            const ret = this.parent(party)
            ig.game.playerEntity = undefined as any
            return ret
        },
    })

    ig.ACTION_STEP.ADD_PLAYER_CAMERA_TARGET.inject({
        start(actor) {
            if (!multi.server) return this.parent(actor)
            assert(ig.game.playerEntity == undefined)
            // @ts-expect-error
            ig.game.playerEntity = {
                hasCameraTarget: () => true,
            }
            this.parent(actor)
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

    sc.EnemyType.inject({
        resolveItemDrops(enemyEntity) {
            if (!ig.ccmap) return this.parent(enemyEntity)
            assert(!ig.game.playerEntity)
            ig.game.playerEntity = ig.ccmap.players[0].dummy
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

    sc.ItemDropEntity.inject({
        onKill() {
            if (!ig.ccmap) return this.parent()
            assert(!ig.game.playerEntity)
            assert(this.target instanceof dummy.DummyPlayer)
            inputBackup.apply(this.target.inputManager)
            this.parent()
            inputBackup.restore()
        },
    })
})

declare global {
    namespace sc {
        interface MapInteractEntry {
            thisTickState?: sc.INTERACT_ENTRY_STATE
        }
    }
}
prestart(() => {
    sc.MapInteractEntry.inject({
        setState(state) {
            if (!ig.ccmap) return this.parent(state)
            if (
                state == sc.INTERACT_ENTRY_STATE.FOCUS ||
                (this.thisTickState != sc.INTERACT_ENTRY_STATE.FOCUS &&
                    state != sc.INTERACT_ENTRY_STATE.HIDDEN &&
                    state != sc.INTERACT_ENTRY_STATE.AWAY)
            ) {
                this.thisTickState = state
            }
            this.parent(state)
        },
    })
    sc.MapInteract.inject({
        onPreUpdate() {
            if (this instanceof multi.class.ServerPlayer.MapInteract || !ig.ccmap) return this.parent()

            for (const entry of this.entries) {
                if (entry.thisTickState) entry.setState(entry.thisTickState)
                entry.thisTickState = undefined
            }
        },
    })
})

prestart(() => {
    ig.ENTITY.NPC.inject({
        onInteraction() {
            if (!ig.ccmap) return this.parent()
            return
        },
    })

    sc.PushPullable.inject({
        onInteraction() {
            if (!ig.ccmap) return this.parent()
        },
    })
})
