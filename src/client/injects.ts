import { prestart } from '../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { PhysicsServer } from '../server/physics/physics-server'
import { Client } from './client'
import { assert } from '../misc/assert'

prestart(() => {
    ig.Physics.inject({
        update() {
            if (ig.client) return
            this.parent()
        },
    })
})

prestart(() => {
    ig.Game.inject({
        deferredMapEntityUpdate() {
            if (ig.client) return
            this.parent()
        },
        varsChanged() {
            if (ig.client) return
            this.parent()
        },
    })
})

prestart(() => {
    ig.Camera.inject({
        onPostUpdate() {
            this.parent()
            const inp = ig.client?.inputManager
            if (inp) Vec2.assign(inp.screen, ig.game.screen)
        },
    })

    dummy.DummyPlayer.inject({
        update() {
            const client = this.getClient(true)
            if (!client) return this.parent()
            assert(ig.ccmap)

            const cameraBackup = ig.camera
            // const combatBackup = sc.combat
            const modelBackup = sc.model
            const isControlBlockedBackup = ig.game.isControlBlocked
            const interactBackup = ig.interact
            ig.camera = client.inst.ig.camera
            // sc.combat = client.inst.sc.combat
            sc.model = client.inst.sc.model
            ig.game.isControlBlocked = () => runTask(client.inst, () => ig.game.isControlBlocked())
            ig.interact = client.inst.ig.interact
            this.parent()
            ig.camera = cameraBackup
            // sc.combat = combatBackup
            sc.model = modelBackup
            ig.game.isControlBlocked = isControlBlockedBackup
            ig.interact = interactBackup
        },
    })
})

prestart(() => {
    /* dont show title screen when client gets created, instead show a black screen */
    sc.TitleScreenGui.inject({
        init() {
            this.parent()
            if (!ig.client) return
            this.introGui.timeLine = [
                { time: 10000, gui: 'baseBG', state: 'DEFAULT' },
                { time: 0, end: true },
            ]
        },
    })
})

prestart(() => {
    // @ts-expect-error
    sc.Model.notifyObserver = function (model: sc.Model & ig.Class, message: number, data?: unknown) {
        // console.log('nofifyObserver', findClassName(model), message, data)
        // function rev<K extends string | number, V extends string | number>(rec: Record<K, V>): Record<V, K> {
        //     return Object.fromEntries(Object.entries(rec).map(([a, b]) => [b as V, a as K]))
        // }

        for (const _o of model.observers) {
            const o = _o as sc.Model.Observer & ig.Class
            if (o._instanceId != instanceinator.id) {
                // let msg: string = message.toString()
                // if (model instanceof sc.PlayerModel)
                //     msg = 'sc.PLAYER_MSG.' + rev(sc.PLAYER_MSG)[message as sc.PLAYER_MSG]
                // if (model instanceof sc.CombatParams)
                //     msg = 'sc.COMBAT_PARAM_MSG.' + rev(sc.COMBAT_PARAM_MSG)[message as sc.COMBAT_PARAM_MSG]
                // console.log('passing ', findClassName(model), msg, data)
                const inst = instanceinator.instances[o._instanceId]
                if (inst) {
                    runTask(inst, () => {
                        o.modelChanged(model, message, data)
                    })
                } else model.observers.erase(o)

                continue
            }
            o.modelChanged(model, message, data)
        }
    }
})

prestart(() => {
    if (ASSERT) {
        ig.GuiHook.inject({
            onAttach(hook) {
                if (this._instanceId != hook!._instanceId) {
                    console.warn('a sin has been commited', this._instanceId, hook!._instanceId)
                    debugger
                }
                this.parent(hook)
            },
            doStateTransition(...args) {
                if (this._instanceId != instanceinator.id) {
                    console.warn('a sin has been commited', this._instanceId, instanceinator.id)
                    debugger
                }
                this.parent(...args)
            },
        })
    }
})

prestart(() => {
    ig.EVENT_STEP.SHOW_TUTORIAL_START.inject({
        start(data, eventCall) {
            if (!multi.server) return this.parent(data, eventCall)
            ;(data as any).done = true
            ;(data as any).accept = false
        },
    })
})

declare global {
    namespace dummy.DummyPlayer {
        interface Data {
            currentMenu?: sc.MENU_SUBMENU
            currentSubState?: sc.GAME_MODEL_SUBSTATE
        }
    }
}
export function updateDummyData(client: Client) {
    if (!(multi.server instanceof PhysicsServer)) return
    const inp = client.inputManager

    const menu = sc.menu.currentMenu
    const subState = sc.model.currentSubState
    if (inp.player) {
        inp.player.data.currentMenu = menu
        inp.player.data.currentSubState = subState
        inp.player.data.isControlBlocked = subState == sc.GAME_MODEL_SUBSTATE.ONMAPMENU
        inp.player.data.inCutscene = ig.client!.inst.ig.game.isControlBlocked()
    }

    const inMenu = subState != sc.GAME_MODEL_SUBSTATE.RUNNING
    if (inMenu) {
        inp.block.blockBoth('PAUSED')
    } else {
        inp.block.unblockBoth('PAUSED')
    }
}

prestart(() => {
    sc.BounceSwitchGroups.inject({
        setCameraBall(groupName, ball) {
            if (!multi.server) return this.parent(groupName, ball)

            if (!ig.game.playerEntity) return

            this.parent(groupName, ball)
        },
    })
})

prestart(() => {
    sc.CrossCode.inject({
        onGameLoopStart() {
            if (!multi.server) return this.parent()
        },
    })
})

prestart(() => {
    ig.EVENT_STEP.SPAWN_ENEMY.inject({
        start(data, eventCall) {
            if (!ig.client) return this.parent(data, eventCall)
            return runTask(ig.client.getMap().inst, () => this.parent(data, eventCall))
        },
    })
})
