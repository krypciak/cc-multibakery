import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { CCMap } from './ccmap'
import { waitForScheduledTask } from '../server'
import { ServerPlayer } from '../server-player'

export class CCMapDisplay {
    camera!: ig.Camera.TargetHandle
    cameraTarget!: ig.Camera.TargetHandle.Target
    currentPlayerI: number = 0

    constructor(public map: CCMap) {}

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

    async setPosCameraHandle(pos: Vec2) {
        if (!multi.server.settings.displayMaps) return

        await waitForScheduledTask(this.map.inst, () => {
            const prev = this.camera
            this.cameraTarget = new ig.Camera.PosTarget(pos)
            this.camera = new ig.Camera.TargetHandle(this.cameraTarget, 0, 0)
            ig.camera.replaceTarget(prev, this.camera)
        })
    }

    addDummyUsernameBoxes() {
        new dummy.BoxGuiAddon.Username(ig.game)
        new dummy.BoxGuiAddon.Menu(ig.game)
    }

    private async setEntityCameraHandle(e: ig.Entity) {
        await waitForScheduledTask(this.map.inst, () => {
            const prev = this.camera
            this.cameraTarget = new ig.Camera.EntityTarget(e)
            this.camera = new ig.Camera.TargetHandle(this.cameraTarget, 0, 0)
            ig.camera.replaceTarget(prev, this.camera)
        })
    }

    async setPlayerCameraHandle(player: ServerPlayer) {
        assert(player)
        await this.setEntityCameraHandle(player.dummy)
    }

    async onPlayerCountChange(enter: boolean) {
        if (!multi.server.settings.displayMaps) return

        if (enter && this.map.players.length == 1) {
            this.setPlayerCameraHandle(this.map.players[0])
        }
    }
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

                    if (map.display.cameraTarget instanceof ig.Camera.PosTarget) {
                        if (ig.input.pressed('special') && map.players.length > 0) {
                            map.display.currentPlayerI = 0
                            map.display.setPlayerCameraHandle(map.players[0])
                        } else if (!multi.server.settings.disableMapDisplayCameraMovement) {
                            Vec2.add(map.display.cameraTarget.pos, move)
                        }
                    } else if (map.display.cameraTarget instanceof ig.Camera.EntityTarget) {
                        if (Vec2.isZero(move)) {
                            if (ig.input.pressed('special')) {
                                map.display.currentPlayerI++
                                if (map.display.currentPlayerI >= map.players.length) map.display.currentPlayerI = 0
                                const player = map.players[map.display.currentPlayerI]
                                if (player) map.display.setPlayerCameraHandle(player)
                            }
                        } else {
                            const pos = Vec2.create()
                            map.display.cameraTarget.getPos(pos)
                            map.display.setPosCameraHandle(pos)
                        }
                    }
                }
            }
            this.parent()
        },
    })
})
