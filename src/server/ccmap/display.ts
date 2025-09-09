import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { CCMap, OnLinkChange } from './ccmap'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { Client } from '../../client/client'
import { dummyBoxGuiConfigs } from '../../dummy/box/configs'

export class CCMapDisplay implements OnLinkChange {
    camera!: ig.Camera.TargetHandle
    cameraTarget!: ig.Camera.TargetHandle.Target
    currentPlayerI: number = 0

    constructor(public map: CCMap) {
        map.onLinkChange.push(this)
    }

    removeUnneededGuis() {
        for (let i = ig.gui.guiHooks.length - 1; i >= 0; i--) {
            const hook = ig.gui.guiHooks[i]
            const gui = hook.gui
            if (
                gui instanceof sc.ElementalLoadOverlayGui ||
                gui instanceof ig.GuiImageContainer ||
                gui instanceof ig.OverlayCornerGui ||
                gui instanceof ig.OverlayGui ||
                gui instanceof sc.SpChangeHudGui ||
                gui instanceof ig.MessageOverlayGui ||
                gui instanceof sc.TopMsgHudGui ||
                gui instanceof sc.CombatHudGui ||
                gui instanceof sc.SideMessageHudGui ||
                gui instanceof sc.QuickMenu ||
                gui instanceof sc.ElementHudGui ||
                gui instanceof sc.MainMenu ||
                gui instanceof sc.StatusHudGui ||
                gui instanceof sc.TitleScreenGui ||
                gui instanceof sc.RightHudGui ||
                gui instanceof sc.MasterOverlayGui
            ) {
                ig.gui.guiHooks.splice(i, 1)
            }
        }
    }

    setPosCameraHandle(pos: Vec2) {
        if (!multi.server.settings.displayMaps) return

        runTask(this.map.inst, () => {
            const prev = this.camera
            this.cameraTarget = new ig.Camera.PosTarget(pos)
            this.camera = new ig.Camera.TargetHandle(this.cameraTarget, 0, 0)
            ig.camera.replaceTarget(prev, this.camera)
        })
    }

    addDummyUsernameBoxes() {
        new dummy.BoxGuiAddon.BoxGuiAddon(ig.game, dummyBoxGuiConfigs)
    }

    private setEntityCameraHandle(e: ig.Entity) {
        runTask(this.map.inst, () => {
            const prev = this.camera
            this.cameraTarget = new ig.Camera.EntityTarget(e)
            this.camera = new ig.Camera.TargetHandle(this.cameraTarget, 0, 0)
            ig.camera.replaceTarget(prev, this.camera)
        })
    }

    setPlayerCameraHandle(client: Client) {
        assert(client)
        this.setEntityCameraHandle(client.dummy)
    }

    onClientLink() {
        if (!multi.server.settings.displayMaps) return

        if (this.map.clients.length == 1) {
            this.setPlayerCameraHandle(this.map.clients[0])
        }
    }

    onClientDestroy() {}
}

// camera movement and player follow switching
prestart(() => {
    ig.Camera.inject({
        onPostUpdate() {
            if (!ig.game.paused && multi.server?.settings.displayMaps) {
                const map = ig.ccmap
                if (map) {
                    const move = Vec2.create()
                    sc.control.moveDir(move, 0, true)
                    Vec2.mulC(move, 8)
                    if (ig.gamepad.isLeftStickDown()) Vec2.assignC(move, 0, 0)

                    const target = map.display.cameraTarget
                    if (target instanceof ig.Camera.PosTarget) {
                        if (ig.input.pressed('special') && map.clients.length > 0) {
                            map.display.currentPlayerI = 0
                            map.display.setPlayerCameraHandle(map.clients[0])
                        } else if (!multi.server.settings.disableMapDisplayCameraMovement) {
                            Vec2.add(target.pos, move)
                        }
                    } else if (target instanceof ig.Camera.EntityTarget) {
                        if (Vec2.isZero(move)) {
                            if (ig.input.pressed('special') || target.entity._killed) {
                                map.display.currentPlayerI++
                                if (map.display.currentPlayerI >= map.clients.length) map.display.currentPlayerI = 0
                                const player = map.clients[map.display.currentPlayerI]
                                if (player) map.display.setPlayerCameraHandle(player)
                            }
                        } else {
                            const pos = Vec2.create()
                            target.getPos(pos)
                            map.display.setPosCameraHandle(pos)
                        }
                    }
                }
            }
            this.parent()
        },
    })
})
