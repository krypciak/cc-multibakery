import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { inputBackup } from '../../dummy/dummy-input'
import { isPhysics } from '../physics/is-physics-server'

prestart(() => {
    const backup = ig.CollTools.isInScreen
    ig.CollTools.isInScreen = function (e: ig.Entity, x?: number, y?: number) {
        if (multi.server && !ig.client) return true
        return backup(e, x, y)
    }

    sc.Combat.inject({
        getPartyHpFactor(party) {
            if (!multi.server || !ig.ccmap) return this.parent(party)

            ig.game.playerEntity = ig.ccmap.clients[0].dummy
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
            const player = enemyEntity.getLastDamagingPlayer() ?? ig.ccmap.clients[0]?.dummy
            if (!player) return
            inputBackup(player.inputManager, () => this.parent(enemyEntity))
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
            if (!ig.ccmap) return this.parent()

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
        runTasks(ig.ccmap.getAllInstances(), notify)
    }
}

prestart(() => {
    ig.ENTITY.EventTrigger.inject({
        update() {
            if (!ig.ccmap || ig.ccmap.ready) return this.parent()
        },
    })
})

prestart(() => {
    dummy.DummyPlayer.inject({
        _removeTargetedBy(combatant) {
            if (!multi.server || !ig.ccmap) return this.parent(combatant)

            const client = this.getClient(false)
            if (client) runTask(client.inst, () => this.parent(combatant))
        },
    })
})

prestart(() => {
    ig.ENTITY.TeleportCentral.inject({
        update() {
            if (!ig.ccmap) return this.parent()

            runTasks(ig.ccmap.getAllInstances(), () => {
                this.parent()
            })
        },
    })
})

prestart(() => {
    ig.ENTITY.NPC.inject({
        postActionUpdate() {
            if (!multi.server) return this.parent()
            const map = ig.ccmap
            assert(map)

            const backup = sc.model.isCutscene
            sc.model.isCutscene = function () {
                return backup.call(this) || map.clients.some(client => client.inst.sc.model.isCutscene())
            }
            this.parent()
            sc.model.isCutscene = backup
        },
    })
})

prestart(() => {
    sc.ItemDropEntity.inject({
        collectItem(count) {
            if (!ig.ccmap) return this.parent(count)
            assert(this.target instanceof dummy.DummyPlayer)
            inputBackup(this.target.inputManager, () => this.parent(count))
        },
        onKill() {
            if (!ig.ccmap) return this.parent()
            assert(!ig.game.playerEntity)
            assert(this.target instanceof dummy.DummyPlayer)
            inputBackup(this.target.inputManager, () => this.parent())
        },
    })
})

declare global {
    namespace ig.ENTITY {
        interface ItemDestruct {
            destroyedBy?: ig.ENTITY.Combatant
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.ItemDestruct.inject({
        ballHit(ballLike, blockDir) {
            if (!isPhysics(multi.server)) return this.parent!(ballLike, blockDir)

            this.destroyedBy = ballLike.getCombatantRoot()
            const ret = this.parent!(ballLike, blockDir)
            this.destroyedBy = undefined
            return ret
        },
        dropItem() {
            if (!isPhysics(multi.server)) return this.parent()

            assert(ig.ccmap)
            assert(this.destroyedBy)
            let player: dummy.DummyPlayer
            if (this.destroyedBy instanceof dummy.DummyPlayer) {
                player = this.destroyedBy
            } else {
                // console.warn('ig.ENTITY.ItemDestruct not destroyed by player, picking first player on map')
                player = ig.ccmap.clients[0]?.dummy
                /* haven't encountered a situation where player is undefined, but just to be safe */
                if (!player) return
            }
            inputBackup(player.inputManager, () => this.parent())
        },
    })
})

declare global {
    namespace ig {
        var xenoDialogs: ig.ENTITY.XenoDialog[]
    }
}

prestart(() => {
    ig.ENTITY.XenoDialog.inject({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            ig.xenoDialogs ??= []
        },
        startDialog() {
            if (!multi.server) return this.parent()

            for (const entity of ig.xenoDialogs) entity.cancelDialog()
            this.running = true
            ig.xenoDialogs.push(this)
        },
        cancelDialog() {
            this.parent()
            if (!multi.server) return
            ig.xenoDialogs.erase(this)
        },
    })
})

prestart(() => {
    sc.MapModel.inject({
        validateCurrentPlayerFloor() {
            if (ig.game.playerEntity) return this.parent()
        },
    })
})

prestart(() => {
    /* actually a server instance fix not ccmap fix but whatever */
    sc.TimerEntry.inject({
        tick() {
            if (sc.map.currentArea) return this.parent()
        },
    })
})

prestart(() => {
    sc.Inventory.inject({
        updateScaledEquipment(newLevel) {
            if (!multi.server) return this.parent(newLevel)
            const players = ig.game.entities.filter(e => e instanceof dummy.DummyPlayer) as dummy.DummyPlayer[]
            const maxDummyLevel = Math.max(newLevel, ...players.map(e => e.model.level))
            return this.parent(maxDummyLevel)
        },
    })
})
