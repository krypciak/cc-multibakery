import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { PvpTeam } from './pvp'

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

function getPlayerHeadIdx(player: dummy.DummyPlayer): number {
    const playerName = player.model.config.name
    return sc.party.models[playerName].getHeadIdx()
}

declare global {
    namespace sc.CombatUpperHud.CONTENT_GUI {
        interface PVP {}
    }
}

let injectedIntoPvpUpperGui = false
function injectIntoPvpUpperGui(clazz: sc.CombatUpperHud.CONTENT_GUI.PVP_CONSTRUCTOR) {
    if (injectedIntoPvpUpperGui) return
    injectedIntoPvpUpperGui = true

    let x!: number
    let renderer!: ig.GuiRenderer

    function drawTeamName(team: PvpTeam) {
        const text = new ig.TextBlock(sc.fontsystem.smallFont, team.name, {
            maxWidth: undefined,
        })
        renderer.addDraw().setText(text, x, 0)
        x += text.size.x
    }

    function drawTeamHeads(this: sc.CombatUpperHud.CONTENT_GUI.PVP, team: PvpTeam, left: boolean) {
        const heads: number[] = team.players.map(getPlayerHeadIdx)
        if (left) x += (heads.length - 1) * 16
        this._renderHeads(renderer, x + (left ? 24 : 0), left, heads)
        if (left) x += 16
        else x += heads.length * 16
        x += 8
    }

    function drawTeamPoints(this: sc.CombatUpperHud.CONTENT_GUI.PVP, team: PvpTeam, left: boolean) {
        if (sc.pvp.winPoints != 1) {
            x += 4
            if (left) x += (sc.pvp.winPoints - 2) * 5
            this._renderPoints(renderer, x, left ? -1 : 1, sc.pvp.winPoints, sc.pvp.points[team.party]!, 0)

            if (left) x += 5
            else x += sc.pvp.winPoints * 5
        }
    }

    function drawVsGfx(this: sc.CombatUpperHud.CONTENT_GUI.PVP) {
        x += 4
        renderer.addGfx(this.gfx, x, 0, 136, 160, 16, 16)
        x += 16
    }

    function drawTeam(this: sc.CombatUpperHud.CONTENT_GUI.PVP, team: PvpTeam, left: boolean) {
        if (left) {
            drawTeamName(team)
            drawTeamHeads.call(this, team, left)
            drawTeamPoints.call(this, team, left)
        } else {
            drawTeamPoints.call(this, team, left)
            drawTeamHeads.call(this, team, left)
            drawTeamName(team)
        }
    }

    clazz.inject({
        updateDrawables(renderer1) {
            if (!sc.pvp.multiplayerPvp) return this.parent(renderer)

            x = 0
            renderer = renderer1

            drawTeam.call(this, sc.pvp.teams[0], sc.pvp.teams.length == 2)

            for (let i = 1; i < sc.pvp.teams.length; i++) {
                drawVsGfx.call(this)
                drawTeam.call(this, sc.pvp.teams[i], false)
            }

            this.setSize(x + 5, 20)

            renderer = undefined as any
        },
    })
}
