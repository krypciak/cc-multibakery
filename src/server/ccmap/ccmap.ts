import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { GameLoopUpdateable } from '../server'
import { assert } from '../../misc/assert'
import { ServerPlayer } from '../server-player'
import { CCMapDisplay } from './display'
import { setDataFromLevelData } from './data-load'
import { prestart } from '../../plugin'
import { forceConditionalLightOnInst } from '../../client/conditional-light'
import { Client } from '../../client/client'
import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { inputBackup } from '../../dummy/dummy-input'

declare global {
    namespace ig {
        var ccmap: CCMap | undefined
    }
}

export interface OnLinkChange {
    onClientLink(this: this, client: Client): void
    onClientDestroy(this: this, client: Client): void
}

export class CCMap implements GameLoopUpdateable {
    rawLevelData!: sc.MapModel.Map

    players: ServerPlayer[] = []

    inst!: InstanceinatorInstance
    display!: CCMapDisplay

    ready: boolean = false
    readyPromise: Promise<void>
    private readyResolve!: () => void
    noStateAppliedYet: boolean = true
    onLinkChange: OnLinkChange[] = []

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

        const displayMaps = multi.server.settings.displayMaps

        const levelDataPromise = this.readLevelData()
        this.inst = await instanceinator.copy(multi.server.baseInst, `map-${this.name}`, displayMaps)
        this.inst.ig.ccmap = this
        forceConditionalLightOnInst(this.inst.id)

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

    update() {
        try {
            ig.game.update()
        } catch (e) {
            this.attemptRecovery(e)
        }
    }

    deferredUpdate() {
        try {
            ig.game.deferredUpdate()
            ig.input.clearPressed()
        } catch (e) {
            this.attemptRecovery(e)
        }
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

    enter(player: ServerPlayer) {
        player.mapName = this.name
        this.players.push(player)
    }

    leave(player: ServerPlayer) {
        const prevLen = this.players.length
        this.players.erase(player)
        if (prevLen == this.players.length) return

        this.leaveEntity(player.dummy)
    }

    private leaveEntity(e: ig.Entity) {
        if (this.remote) return

        if (e.isPlayer && e instanceof ig.ENTITY.Player) {
            /* this promise will finish by the end of this function, so there's no need to await it */
            this.leaveEntity(e.gui.crosshair)
        }

        assert(instanceinator.id == multi.server.serverInst.id)
        runTask(this.inst, () => {
            e.kill()
        })
    }

    getAllInstances(includeMapInst?: boolean) {
        const insts = this.players.map(player => player.getClient().inst)
        if (includeMapInst) insts.push(this.inst)
        return insts
    }

    destroy() {
        for (const player of this.players) {
            const client = player.getClient()
            multi.server.leaveClient(client)
        }
        if (this.inst) {
            multi.server.serverInst.apply()
            instanceinator.delete(this.inst)
        }
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
        _onDeathHit(a) {
            if (!multi.server || !(this instanceof dummy.DummyPlayer)) return this.parent(a)

            if (sc.pvp.isCombatantInPvP(this)) return this.parent(a)

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
            inputBackup(this.target.inputManager, () => this.parent())
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
        },
    })

    sc.PushPullable.inject({
        onInteraction() {
            if (!ig.ccmap) return this.parent()
        },
    })
})

export function notifyMapAndPlayerInsts(model: sc.Model, msg: number, data?: unknown) {
    function notify() {
        sc.Model.notifyObserver(model, msg, data)
    }
    notify()

    if (ig.ccmap) {
        const map = ig.ccmap
        runTasks(map.getAllInstances(), notify)
    }
}
