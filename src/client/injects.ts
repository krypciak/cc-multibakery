import { poststart, prestart } from '../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { broadcastAcrossInstances } from './client-map-util'

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
})

poststart(() => {
    dummy.DummyPlayer.inject({
        clearActionAttached(...args) {
            const client = this.getClient(true)
            if (client) return runTask(client.inst, () => this.parent(...args))
            return this.parent(...args)
        },
    })
})

prestart(() => {
    // @ts-expect-error
    sc.Model.notifyObserver = function (model: sc.Model & ig.Class, message: number, data?: unknown) {
        // console.log('notifyObserver', findClassName(model), message, data)
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
                    console.warn('a sin has been committed', this._instanceId, hook!._instanceId)
                    debugger
                }
                this.parent(hook)
            },
            doStateTransition(...args) {
                if (this._instanceId != instanceinator.id) {
                    console.warn('a sin has been committed', this._instanceId, instanceinator.id)
                    debugger
                }
                this.parent(...args)
            },
        })
    }
})

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
    ig.ZoomBlurHandle.inject({
        draw(...args) {
            if (!multi.server) return this.parent(...args)
            if (ig.game.pausedVirtual) return

            return this.parent(...args)
        },
    })
})

prestart(() => {
    let noBroadcast = false
    sc.OptionModel.inject({
        init() {
            noBroadcast = true
            this.parent()
            noBroadcast = false
        },
    })
    ig.System.inject({
        setMasterVolume(volume) {
            this.parent(volume)
            if (!multi.server || noBroadcast) return
            broadcastAcrossInstances(multi.server.getAllInstances(), () => ig.system?.setMasterVolume(volume))
        },
        setSoundVolume(volume) {
            this.parent(volume)
            if (!multi.server || noBroadcast) return
            broadcastAcrossInstances(multi.server.getAllInstances(), () => ig.system?.setSoundVolume(volume))
        },
        setMusicVolume(volume) {
            this.parent(volume)
            if (!multi.server || noBroadcast) return
            broadcastAcrossInstances(multi.server.getAllInstances(), () => ig.system?.setMusicVolume(volume))
        },
    })
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

prestart(() => {
    ig.EVENT_STEP.SHOW_PARALLAX.inject({
        start(data, eventCall) {
            if (!ig.client) return this.parent(data, eventCall)

            this.parallaxGui = ig.gui.createEventGui(
                '__parallaxGui__',
                'Parallax',
                this.parallaxGui.hook.mapGuiInfo!.settings
            )
            return this.parent(data, eventCall)
        },
    })

    ig.EVENT_STEP.ADD_GUI.inject({
        start(data, eventCall) {
            if (!ig.client) return this.parent(data, eventCall)
            this.guiElement = ig.gui.createEventGui(this.name!, this.guiInfo.type, this.guiInfo.settings)
            return this.parent(data, eventCall)
        },
    })
})
