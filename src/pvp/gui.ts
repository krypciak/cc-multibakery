import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import { Opts } from '../options'
import { COLOR, wrapColor } from '../misc/wrap-color'
import type { MultiParty } from '../party/party'

import './combatant-gui-fix'

prestart(() => {
    sc.CombatUpperHud.inject({
        init() {
            this.parent()

            const clazz = ig.classIdToClass[
                this.sub.pvp.classId
            ] as unknown as sc.CombatUpperHud.CONTENT_GUI.PVP_CONSTRUCTOR
            assert(clazz)
            injectIntoPvpUpperGui(clazz)
        },
    })
})

let injectedIntoPvpUpperGui = false
function injectIntoPvpUpperGui(clazz: sc.CombatUpperHud.CONTENT_GUI.PVP_CONSTRUCTOR) {
    if (injectedIntoPvpUpperGui) return
    injectedIntoPvpUpperGui = true

    let x!: number
    let renderer!: ig.GuiRenderer

    function drawTeamName(party: MultiParty) {
        const text = new ig.TextBlock(sc.fontsystem.smallFont, party.title, {
            maxWidth: undefined,
        })
        renderer.addText(text, x, 0)
        x += text.size.x
    }

    function drawTeamHeads(this: sc.CombatUpperHud.CONTENT_GUI.PVP, party: MultiParty, left: boolean) {
        const heads: number[] = multi.server.party.getPartyCombatants(party).map(player => player.getHeadIdx())
        if (left) x += (heads.length - 1) * 16
        this._renderHeads(renderer, x + (left ? 24 : 0), left, heads)
        if (left) x += 16
        else x += heads.length * 16
        x += 8
    }

    function drawTeamPoints(this: sc.CombatUpperHud.CONTENT_GUI.PVP, party: MultiParty, left: boolean) {
        if (sc.pvp.winPoints != 1) {
            x += 4
            if (left) x += (sc.pvp.winPoints - 2) * 5
            this._renderPoints(renderer, x, left ? -1 : 1, sc.pvp.winPoints, sc.pvp.points[party.combatantParty]!, 0)

            if (left) x += 5
            else x += sc.pvp.winPoints * 5
        }
    }

    function drawVsGfx(this: sc.CombatUpperHud.CONTENT_GUI.PVP) {
        x += 4
        renderer.addGfx(this.gfx, x, 0, 136, 160, 16, 16)
        x += 16
    }

    function drawTeam(this: sc.CombatUpperHud.CONTENT_GUI.PVP, party: MultiParty, left: boolean) {
        if (left) {
            drawTeamName(party)
            drawTeamHeads.call(this, party, left)
            drawTeamPoints.call(this, party, left)
        } else {
            drawTeamPoints.call(this, party, left)
            drawTeamHeads.call(this, party, left)
            drawTeamName(party)
        }
    }

    clazz.inject({
        updateDrawables(renderer1) {
            if (!sc.pvp.multiplayerPvp) return this.parent(renderer1)

            x = 0
            renderer = renderer1

            drawTeam.call(this, sc.pvp.parties[0], sc.pvp.parties.length == 2)

            for (let i = 1; i < sc.pvp.parties.length; i++) {
                drawVsGfx.call(this)
                drawTeam.call(this, sc.pvp.parties[i], false)
            }

            this.setSize(x + 5, 20)

            renderer = undefined as any
        },
    })
}

prestart(() => {
    ig.GUI.StatusBar.inject({
        updateSubHpHandler() {
            if (!sc.pvp.multiplayerPvp || sc.pvp.state == 0) return this.parent()

            const target = this.target
            if (!sc.pvp.isCombatantInPvP(target)) return

            assert(target instanceof dummy.DummyPlayer)

            const type = 'PVP'
            if (this.subHpType == type) return

            if (this.subHpHandler) {
                this.subHpHandler.remove()
                this.subHpHandler = null
            }
            this.subHpType = type

            const targetAsEnemy = target as unknown as ig.ENTITY.Enemy
            targetAsEnemy.visibility = {
                analyzable: false,
                hpBar: sc.ENEMY_HP_BAR.VISIBLE,
            }
            targetAsEnemy.enemyType = {
                hpBreaks: [] as sc.EnemyType.HpBreak[],
            } satisfies Partial<sc.EnemyType> as sc.EnemyType

            this.subHpHandler = new sc.SUB_HP_EDITOR[type](targetAsEnemy)
            ig.gui.addGuiElement(this.subHpHandler)
            this.subHpHandler.initWithParams()
        },
    })
})

declare global {
    namespace sc.SUB_HP_EDITOR {
        interface PVP {
            order: number
            relation: ReturnType<sc.PvpModel['getPlayerInstanceRelation']>
            usernameText: ig.TextBlock
        }
    }
    namespace ig {
        var pvpHpBarOrder: number
    }
}

prestart(() => {
    sc.SUB_HP_EDITOR.PVP.inject({
        init(player) {
            this.parent(player)
            if (!multi.server) return
            assert(player instanceof dummy.DummyPlayer)

            sc.pvp.pushHpBar(this)

            this.relation = sc.pvp.getPlayerInstanceRelation(player)
            if (this.relation == 'same' || this.relation == 'ally') {
                this.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_BOTTOM)
                this.setPos(17, this.hook.pos.y)

                this.lowerColor = '#12d711'
                this.upperColor = '#7aff7a'
            }

            this.usernameText = new ig.TextBlock(
                sc.fontsystem.tinyFont,
                wrapColor(player.data.username, COLOR.YELLOW),
                {
                    maxWidth: undefined,
                }
            )
        },
        remove(immediately) {
            this.parent(immediately)
            if (!multi.server) return
            sc.pvp.eraseHpBar(this)
        },
        updateDrawables(renderer) {
            this.parent(renderer)
            if (this.usernameText) {
                const x = 37
                const y = -8
                const { x: w, y: h } = this.usernameText.size
                renderer.addColor('#000000', x - 1, y, w + 1, h - 1)
                renderer.addColor('#000000', x - 3, y, 2, 2)
                renderer.addGfx(this.spBGPatch.gfx, x + w, y, 20, 128, 10, 7)
                renderer.addText(this.usernameText, x, y)
            }
        },
        _isHpBarVisible() {
            if (!sc.pvp.multiplayerPvp) return this.parent()

            if (this.target.isDefeated() || (this.relation == 'same' && Opts.hideClientPvpHpBar)) return false
            return this.parent()
        },
    })
})
