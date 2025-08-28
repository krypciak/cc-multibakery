import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { PhysicsServer } from '../server/physics/physics-server'

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
            const inp = ig.client?.player?.inputManager
            if (inp) Vec2.assign(inp.screen, ig.game.screen)
        },
    })

    dummy.DummyPlayer.inject({
        update() {
            const client = this.getClient(true)
            if (!client) return this.parent()

            const camera = ig.camera
            ig.camera = client.inst.ig.camera
            this.parent()
            ig.camera = camera
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
prestart(() => {
    if (!PHYSICS) return
    ig.Game.inject({
        deferredUpdate() {
            this.parent()
            if (!(multi.server instanceof PhysicsServer)) return
            const inp = ig.client?.player?.inputManager
            if (!inp) return
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
        },
    })
})

function broadcastCombatArtNameLabel(player: dummy.DummyPlayer, applyCharge: number) {
    const actionName = player.getChargeAction(player.charging.type, applyCharge) as keyof typeof sc.PLAYER_ACTION
    if (!actionName) return
    const combatArtName = player.model.getCombatArtName(sc.PLAYER_ACTION[actionName])
    assert(ig.ccmap)
    runTasks(ig.ccmap.getAllInstances(), () => {
        if (!sc.options.get('combat-art-name')) return

        const box = new sc.SmallEntityBox(player, combatArtName, 1)
        box.stopRumble()
        ig.gui.addGuiElement(box)
    })
}

prestart(() => {
    dummy.DummyPlayer.inject({
        handleStateStart(state, input) {
            this.parent(state, input)
            if (!multi.server) return

            if (state.startState == 5) {
                broadcastCombatArtNameLabel(this, state.applyCharge)
            }
        },
    })
})
