import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { inputBackup } from '../../dummy/dummy-input'

import './sound-position-fix'
import { isPhysics } from '../physics/physics-server-types'

prestart(() => {
    const backup = ig.CollTools.isInScreen
    ig.CollTools.isInScreen = function isInScreen(coll: ig.CollEntry, x?: number, y?: number) {
        if (!ig.mapShared) return backup(coll, x, y)

        x ??= 0
        y ??= x

        for (const client of ig.mapShared.ccmap.clients) {
            const ig = client.inst.ig
            const isInScreen =
                coll.pos.x + coll.size.x + x >= ig.game.screen.x &&
                coll.pos.x - x <= ig.game.screen.x + ig.system.width &&
                coll.pos.y - coll.pos.z + coll.size.y + y >= ig.game.screen.y &&
                coll.pos.y - coll.pos.z - coll.size.z - y <= ig.game.screen.y + ig.system.height

            if (isInScreen) return true
        }
        return false
    }

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
        runTasks(ig.ccmap.getClientInstances(), notify)
    }
}

prestart(() => {
    ig.ENTITY.EventTrigger.inject({
        update() {
            if (!ig.ccmap || (ig.ccmap.ready && ig.ccmap.clients.length > 0)) return this.parent()
        },
    })
})

prestart(() => {
    ig.ENTITY.TeleportCentral.inject({
        update() {
            if (!ig.ccmap) return this.parent()

            runTasks(ig.ccmap.getClientInstances(), () => {
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

prestart(() => {
    if (!PHYSICS) return

    sc.EnemyType.inject({
        resolveItemDrops(enemyEntity) {
            if (!ig.ccmap) return this.parent(enemyEntity)
            assert(!ig.game.playerEntity)
            const player = enemyEntity.getLastDamagingPlayer() ?? ig.ccmap.clients[0]?.dummy
            if (!player) return
            inputBackup(player.inputManager, () => this.parent(enemyEntity))
        },
    })
})

declare global {
    namespace ig {
        interface MapSharedVars {
            xenoDialogs?: ig.ENTITY.XenoDialog[]
        }
    }
}

prestart(() => {
    ig.ENTITY.XenoDialog.inject({
        startDialog() {
            if (!multi.server) return this.parent()

            ig.mapShared.xenoDialogs ??= []
            for (const entity of ig.mapShared.xenoDialogs) entity.cancelDialog()
            this.running = true
            ig.mapShared.xenoDialogs.push(this)
        },
        cancelDialog() {
            this.parent()
            if (!multi.server) return
            ig.mapShared.xenoDialogs?.erase(this)
        },
    })
})

prestart(() => {
    sc.MapModel.inject({
        validateCurrentPlayerFloor() {
            if (ig.game.playerEntity) return this.parent()
        },
        validateCurrentFloor() {
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

declare global {
    namespace ig.ENTITY {
        interface Elevator {
            preMoveZ?: number
            lastUsedPlayers?: string[]
        }
    }
}
prestart(() => {
    let noRecursve = false
    ig.ENTITY.Elevator.inject({
        moveToDestination(destinationIndex) {
            this.preMoveZ = this.coll.pos.z
            return this.parent(destinationIndex)
        },
        performTeleport(destination) {
            this.parent(destination)
            if (!multi.server || noRecursve) return

            const clients = ig.mapShared.ccmap.clients.filter(c => {
                const ground = c.dummy?.coll._collData.groundEntry
                return ground && ground.entity == this
            })

            for (const client of clients) {
                if (client == ig.client) continue
                try {
                    noRecursve = true
                    runTask(client.inst, () => this.performTeleport(destination))
                } finally {
                    noRecursve = false
                }
            }

            assert(ig.client)
            if (this.doTeleport) {
                this.lastUsedPlayers = clients.map(p => p.username)
                for (const client of clients) {
                    const relativePos = Vec2.sub(Vec2.create(this.getCenter()), client.dummy.getCenter())
                    relativePos.x = relativePos.x.limit(-this.coll.size.x / 2.2, this.coll.size.x / 2.2)
                    relativePos.y = relativePos.y.limit(-this.coll.size.y / 2, this.coll.size.y / 2)
                    client.teleportOverrides.pos = () => {
                        const newPos = Vec2.sub(Vec2.create(client.dummy.coll.pos), relativePos)
                        return newPos
                    }
                }
            }
        },
        update() {
            this.parent()
            if (!isPhysics(multi.server) || !this.lastUsedPlayers) return

            if (this.targetZ !== undefined && this.targetZ !== null && Math.abs(this.targetZ - this.coll.pos.z) < 1) {
                for (const username of this.lastUsedPlayers) {
                    const client = multi.server.clients.get(username)
                    if (!client) continue
                    runTask(client.inst, () => sc.elevatorModel.endMoveSound(this.sounds.end))
                }
                this.lastUsedPlayers = undefined
                this.coll.vel.z = 0
                this.targetZ = null
                this.setZPos(this.preMoveZ!)
                this.switchEntity.setMoving(false)
            }
        },
    })
})
