import { assert } from '../misc/assert'
import { addCombatantParty } from '../misc/combatant-party-api'
import { prestart } from '../plugin'
import { PhysicsServer } from '../server/physics/physics-server'
import { runTasks, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { CCMap, OnLinkChange } from '../server/ccmap/ccmap'

import './gui'
import './steps'

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

            clearPvpTeams(this: this): void
            addPvpTeam(this: this, name: string, players: dummy.DummyPlayer[]): void
            startMultiplayerPvp(this: this, winPoints: number): void
            removeRoundGuis(this: this): void
            getPlayerInstanceRelation(this: this, player: dummy.DummyPlayer): 'same' | 'ally' | 'enemy'
            getOnlyTeamAlive(this: this): PvpTeam | undefined
            getAllPlayers(this: this): dummy.DummyPlayer[]
            pushHpBar(this: this, bar: sc.SUB_HP_EDITOR.PVP): void
            eraseHpBar(this: this, bar: sc.SUB_HP_EDITOR.PVP): void
            rearrangeHpBars(this: this): void
            removeLink(this: this): void
            getPlayerTeam(this: this, player: dummy.DummyPlayer): PvpTeam | undefined
            resetMultiState(this: this): void
        }
    }
    namespace dummy {
        interface DummyPlayer {
            oldParty?: number
        }
    }
}

prestart(() => {
    sc.PvpModel.inject({
        clearPvpTeams() {
            assert(multi.server)
            this.teams = []
        },
        addPvpTeam(name, players) {
            assert(multi.server)
            assert(players.length > 0)

            const party = addCombatantParty(`pvpTeam_${name}`)
            const team: PvpTeam = {
                name,
                party,
                players,
            }

            assert(this.teams)
            this.teams.push(team)
        },
        startMultiplayerPvp(winPoints) {
            assert(this.teams.length > 1)
            assert(multi.server)

            this.multiplayerPvp = true
            this.roundGuis = {}
            this.hpBars = {}

            this.state = 1
            this.round = 0
            this.winPoints = winPoints
            this.points[sc.COMBATANT_PARTY.PLAYER] = 0
            this.points[sc.COMBATANT_PARTY.ENEMY] = 0

            for (const team of this.teams) {
                this.points[team.party] = 0

                for (const player of team.players) {
                    player.oldParty = player.party
                    player.party = team.party
                }
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

            if (aliveTeamCount == 1) {
                const winningTeam: PvpTeam = this.teams[teamsAlive.findIndex(alive => alive)]
                assert(winningTeam)

                return winningTeam
            }
        },
        getPlayerInstanceRelation(player) {
            const instancePlayer = ig.game.playerEntity
            if (!ig.game.playerEntity) return 'enemy'

            assert(instancePlayer instanceof dummy.DummyPlayer)
            if (ig.game.playerEntity == player) return 'same'

            return instancePlayer.party == player.party ? 'ally' : 'enemy'
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
            this.hpBars[instanceinator.id]?.erase(bar)
            this.rearrangeHpBars()
        },
        rearrangeHpBars() {
            runTasks(
                Object.keysT(this.hpBars).map(id => instanceinator.instances[id]),
                () => {
                    const hpBars = this.hpBars[instanceinator.id]
                    hpBars.sort((a, b) => a.order - b.order)
                    let y = 5

                    for (let i = 0; i < hpBars.length; i++) {
                        const bar = hpBars[i]
                        if (bar.target.isDefeated()) continue
                        bar.setPos(bar.hook.pos.x, y)
                        y += 15
                    }
                }
            )
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
        resetMultiState() {
            for (const team of this.teams) {
                for (const player of team.players) {
                    assert(player.oldParty !== undefined)
                    player.party = player.oldParty
                }
            }

            runTasks(
                Object.keysT(this.hpBars).map(id => instanceinator.instances[id]),
                () => {
                    const hpBars = this.hpBars[instanceinator.id]
                    for (let i = hpBars.length - 1; i >= 0; i--) {
                        const bar = hpBars[i]
                        bar.remove()
                    }
                }
            )
            this.hpBars = {}

            this.removeRoundGuis()

            this.multiplayerPvp = false
            this.teams = []
            this.points = {}
            this.map = undefined as any
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

            this.rearrangeHpBars()

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

            this.rearrangeHpBars()
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
        // onVarAccess different team points??
        onVarAccess(path, keys) {
            if (keys[0] == 'pvp') {
                if (keys[1] == 'teamCount') return this.teams.length
            }
            return this.parent(path, keys)
        },
        onPostUpdate() {
            if (!this.multiplayerPvp) return this.parent()

            if (this.state == 3) {
                const onlyTeamAlive = this.getOnlyTeamAlive()
                if (onlyTeamAlive) this.onPostKO(onlyTeamAlive.party)
            }
        },
        stop() {
            if (!this.multiplayerPvp) return this.parent()

            this.state = 0

            this.map.forEachPlayerInst(() => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STOPPED, null)
                sc.model.setCombatMode(false, true)
            }, true)

            this.resetMultiState()
        },
        onReset() {
            this.parent()
            if (!multi.server) return

            this.map.forEachPlayerInst(() => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STOPPED, null)
            })

            this.resetMultiState()
        },
    })
})

export async function stagePvp() {
    assert(multi.server instanceof PhysicsServer)
    const teamConfigs: { name: string; count: number }[] = [
        { name: '1', count: 2 },
        { name: '2', count: 2 },
    ]
    const winningPoints = 1
    let masterPlayer!: dummy.DummyPlayer

    const teams = await Promise.all(
        teamConfigs.map(async ({ name, count }, _teamI) => {
            const players = await Promise.all(
                new Array(count).fill(null).map(async (_, i) => {
                    const isMaster = _teamI == 0 && i == 0
                    const client = await multi.server.createAndJoinClient({
                        username: `${name}_${i}`,
                        inputType: 'clone',
                        remote: false,
                        // noShowInstance: !isMaster,
                    })
                    if (isMaster) masterPlayer = client.player.dummy

                    assert(client.player.dummy)
                    return client.player.dummy
                })
            )
            return { name, players }
        })
    )

    multi.server.masterUsername = masterPlayer.data.username

    const map = masterPlayer.getMap()

    await scheduleTask(map.inst, () => {
        sc.pvp.clearPvpTeams()
        for (const { name, players } of teams) {
            sc.pvp.addPvpTeam(name, players)
        }
        sc.pvp.startMultiplayerPvp(winningPoints)
    })
}
