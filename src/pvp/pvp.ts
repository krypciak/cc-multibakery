import { assert } from '../misc/assert'
import { addCombatantParty } from '../misc/combatant-party-api'
import { prestart } from '../plugin'
import { PhysicsServer } from '../server/physics/physics-server'
import { waitForScheduledTask } from '../server/server'

import './gui'
import { CCMap, OnLinkChange } from '../server/ccmap/ccmap'

export interface PvpTeam {
    name: string
    party: sc.COMBATANT_PARTY
    players: dummy.DummyPlayer[]
}

declare global {
    namespace sc {
        interface PvpModel extends OnLinkChange {
            multiplayerPvp?: boolean
            teams: PvpTeam[]
            roundGuis: Record<number, sc.PvpRoundGui>
            map: CCMap
            hpBars: Record<number, sc.SUB_HP_EDITOR.PVP[]>

            createPvpTeam(this: this, name: string, players: dummy.DummyPlayer[]): PvpTeam
            startMultiplayerPvp(this: this, winPoints: number, teams: PvpTeam[]): void
            removeRoundGuis(this: this): void
            getOnlyTeamAlive(this: this): PvpTeam | undefined
            getAllPlayers(this: this): dummy.DummyPlayer[]
            pushHpBar(this: this, bar: sc.SUB_HP_EDITOR.PVP): void
            eraseHpBar(this: this, bar: sc.SUB_HP_EDITOR.PVP): void
            rearrangeHpBars(this: this): void
            removeHpBars(this: this): void
            removeLink(this: this): void
            getPlayerTeam(this: this, player: dummy.DummyPlayer): PvpTeam | undefined
        }
    }
}

prestart(() => {
    sc.PvpModel.inject({
        createPvpTeam(name, players) {
            const party = addCombatantParty(`pvpTeam_${name}`)

            return {
                name,
                party,
                players,
            }
        },
        startMultiplayerPvp(winPoints, teams) {
            assert(teams.length > 1)
            assert(multi.server)

            this.multiplayerPvp = true
            this.teams = teams
            this.roundGuis = {}
            this.hpBars = {}

            this.state = 1
            this.round = 0
            this.winPoints = winPoints
            this.points[sc.COMBATANT_PARTY.PLAYER] = 0
            this.points[sc.COMBATANT_PARTY.ENEMY] = 0

            for (const team of teams) {
                this.points[team.party] = 0
            }

            this.enemies = []

            this.map = this.teams[0].players[0].getMap()

            this.map.forEachPlayerInst(() => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STARTED, null)
                sc.model.setCombatMode(true, true)
            }, true)

            this.map.onLinkChange.push(this)
        },
        removeRoundGuis() {
            this.map.forEachPlayerInst(() => {
                const id = instanceinator.id
                this.roundGuis[id]?.remove()
            }, true)
            this.roundGuis = {}
        },
        getOnlyTeamAlive() {
            const teamsAlive = this.teams.map(team => team.players.some(player => !player.isDefeated()))
            const aliveTeamCount = teamsAlive.reduce((acc, v) => acc + Number(v), 0)
            assert(aliveTeamCount > 0)

            if (aliveTeamCount == 1) {
                const winningTeam: PvpTeam = this.teams[teamsAlive.findIndex(alive => alive)]
                assert(winningTeam)

                return winningTeam
            }
        },
        getAllPlayers() {
            return this.teams.flatMap(team => team.players)
        },
        pushHpBar(bar) {
            bar.order = ig.pvpHpBarOrder++
            ;(this.hpBars[instanceinator.id] ??= []).push(bar)
            this.rearrangeHpBars()
        },
        eraseHpBar(bar) {
            this.hpBars[instanceinator.id].erase(bar)
            this.rearrangeHpBars()
        },
        rearrangeHpBars() {
            for (let hpBars of Object.values(this.hpBars)) {
                hpBars = hpBars.sort((a, b) => a.order - b.order)
                for (let i = 0; i < hpBars.length; i++) {
                    const bar = hpBars[i]
                    const y = i * 15 + 5
                    bar.setPos(bar.hook.pos.x, y)
                }
            }
        },
        removeHpBars() {
            const prevId = instanceinator.id
            for (const [id, hpBars] of Object.entriesT(this.hpBars)) {
                instanceinator.instances[id].apply()
                for (let i = hpBars.length - 1; i >= 0; i--) {
                    const bar = hpBars[i]
                    bar.remove()
                }
            }
            instanceinator.instances[prevId].apply()
            this.hpBars = {}
        },
        onClientLink() {},
        onClientDestroy(client) {
            const player = client.player.dummy
            const team = this.getPlayerTeam(player)
            if (!team) return

            team.players.erase(player)
            if (team.players.length == 0) this.teams.erase(team)

            delete this.hpBars[client.inst.id]
            for (const key in this.hpBars) {
                this.hpBars[key] = this.hpBars[key].filter(bar => bar.target != (player as any))
            }
            this.rearrangeHpBars()

            const onlyTeamAlive = this.getOnlyTeamAlive()
            if (onlyTeamAlive) {
                if (this.teams.length == 1) {
                    this.points[onlyTeamAlive.party] = this.winPoints
                }
                this.onPostKO(onlyTeamAlive.party)
            }
        },
        getPlayerTeam(player) {
            for (const team of this.teams) {
                if (team.players.includes(player)) return team
            }
        },

        start(winPoints, enemies) {
            this.points = {}
            this.parent(winPoints, enemies)
        },
        getDmgFactor() {
            if (!this.multiplayerPvp) return this.parent()
            return 1
        },
        isOver() {
            if (!this.multiplayerPvp) return this.parent()
            return Object.values(this.points).some(points => points == this.winPoints)
        },
        isCombatantInPvP(combatant) {
            if (!this.multiplayerPvp) return this.parent(combatant)

            if (!this.isActive() || !(combatant instanceof dummy.DummyPlayer)) return false

            for (const team of this.teams) {
                if (team.players.includes(combatant)) return true
            }
            return false
        },
        onPvpCombatantDefeat(combatant) {
            if (!this.multiplayerPvp) return this.parent(combatant)

            if (!this.isActive() || !(combatant instanceof dummy.DummyPlayer)) return false

            const onlyTeamAlive = this.getOnlyTeamAlive()
            if (onlyTeamAlive) return this.showKO(onlyTeamAlive.party)
        },
        showKO(party) {
            if (!this.multiplayerPvp) return this.parent(party)

            const points = ++this.points[party]!
            this.lastWinParty = party

            assert(!sc.arena.active)

            this.state = 3
            ig.game.varsChangedDeferred()

            this.map.forEachPlayerInst(() => {
                const koGui = new sc.PvpKoGui()
                ig.gui.addGuiElement(koGui)
            }, true)

            return sc.DRAMATIC_EFFECT[points == this.winPoints ? 'PVP_FINAL_KO' : 'PVP_KO']
        },
        onPostKO(party) {
            if (!this.multiplayerPvp) return this.parent(party)

            for (const player of this.getAllPlayers()) {
                player.regenPvp(1)
            }
            this.state = this.isOver() ? 5 : 4
            ig.game.varsChangedDeferred()
        },
        startNextRound(autoContinue) {
            if (!this.multiplayerPvp) return this.parent(autoContinue)

            this.round += 1

            this.roundGuis = Object.fromEntries(
                this.map.forEachPlayerInst(() => {
                    const roundGui = new sc.PvpRoundGui(this.round, autoContinue)
                    ig.gui.addGuiElement(roundGui)
                    return [instanceinator.id, roundGui]
                }, true)
            )

            this.blocking = true
        },
        finalizeRoundStart() {
            if (!this.multiplayerPvp) return this.parent()

            this.state = 2

            this.removeRoundGuis()

            assert(!sc.arena.active)

            ig.game.varsChangedDeferred()
            this.releaseBlocking()
        },
        stop() {
            if (!this.multiplayerPvp) return this.parent()

            this.state = 0

            this.map.forEachPlayerInst(() => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STOPPED, null)
                sc.model.setCombatMode(false, true)
            }, true)

            this.removeHpBars()
        },
        // onVarAccess different team points??
        onPostUpdate() {
            if (!this.multiplayerPvp) return this.parent()

            if (this.state == 3) {
                const onlyTeamAlive = this.getOnlyTeamAlive()
                if (onlyTeamAlive) this.onPostKO(onlyTeamAlive.party)
            }
        },
        onReset() {
            this.parent()

            this.map.forEachPlayerInst(() => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STOPPED, null)
            })

            this.multiplayerPvp = false
            this.teams = []
            this.map = undefined as any
            this.removeHpBars()
            this.removeRoundGuis()
        },
    })
})

export async function stagePvp() {
    assert(multi.server instanceof PhysicsServer)
    const teamConfigs: { name: string; count: number }[] = [
        { name: '1', count: 1 },
        { name: '2', count: 1 },
        { name: '3', count: 1 },
    ]
    const winningPoints = 2

    const teams: PvpTeam[] = await Promise.all(
        teamConfigs.map(async ({ name, count }) => {
            const players = await Promise.all(
                new Array(count).fill(null).map(async (_, i) => {
                    const client = await multi.server.createAndJoinClient({
                        username: `${name}_${i}`,
                        inputType: 'clone',
                        remote: false,
                    })
                    assert(client.player.dummy)
                    return client.player.dummy
                })
            )
            return sc.pvp.createPvpTeam(name, players)
        })
    )

    const masterPlayer = teams[0].players[0]
    multi.server.masterUsername = masterPlayer.data.username

    const map = masterPlayer.getMap()

    await waitForScheduledTask(map.inst, () => {
        sc.pvp.startMultiplayerPvp(winningPoints, teams)
        sc.pvp.startNextRound(true)

        ig.game.spawnEntity(ig.ENTITY.EventTrigger, 0, 0, 0, {
            startCondition: 'pvp.brake',
            triggerType: 'ALWAYS',
            name: 'pvpBrake',
            eventType: 'PARALLEL',
            endCondition: 'false',
            event: [
                //
                { type: 'WAIT', ignoreSlowDown: false, time: 1 },
                { type: 'PREPARE_PVP_ROUND', autoContinue: false },
                { type: 'WAIT', ignoreSlowDown: false, time: 1 },
                { type: 'START_PVP_ROUND' },
            ],
        })

        ig.game.spawnEntity(ig.ENTITY.EventTrigger, 0, 0, 0, {
            startCondition: 'pvp.finished',
            triggerType: 'ALWAYS',
            name: 'pvpEnd',
            eventType: 'PARALLEL',
            endCondition: 'false',
            event: [
                //
                { type: 'WAIT', ignoreSlowDown: false, time: 0.5 },
                { type: 'STOP_PVP_BATTLE' },
            ],
        })
    })
}
