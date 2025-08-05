import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../misc/assert'
import { addCombatantParty } from '../misc/combatant-party-api'
import { prestart } from '../plugin'
import { PhysicsServer } from '../server/physics/physics-server'
import { waitForScheduledTask } from '../server/server'

import './gui'

export interface PvpTeam {
    name: string
    party: sc.COMBATANT_PARTY
    players: dummy.DummyPlayer[]
}

declare global {
    namespace sc {
        interface PvpModel {
            multiplayerPvp?: boolean
            teams: PvpTeam[]
            roundGuis: Record<number, sc.PvpRoundGui>

            createPvpTeam(this: this, name: string, players: dummy.DummyPlayer[]): PvpTeam
            startMultiplayerPvp(this: this, winPoints: number, teams: PvpTeam[]): void
            getAllPlayers(this: this): dummy.DummyPlayer[]
            getAllInstances(this: this, includeCurrent?: boolean): InstanceinatorInstance[]
            forEachInst<T>(this: this, func: () => T, includeCurrent?: boolean): T[]
            removeRoundGuis(this: this): void
            getOnlyTeamAlive(this: this): PvpTeam | undefined
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

            this.state = 1
            this.round = 0
            this.winPoints = winPoints
            this.points[sc.COMBATANT_PARTY.PLAYER] = 0
            this.points[sc.COMBATANT_PARTY.ENEMY] = 0

            for (const team of teams) {
                this.points[team.party] = 0
            }

            this.enemies = []

            this.forEachInst(() => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STARTED, null)
                sc.model.setCombatMode(true, true)
            }, true)
        },
        getAllPlayers() {
            return this.teams.flatMap(team => team.players)
        },
        getAllInstances(includeCurrent) {
            const insts = this.getAllPlayers().map(player => multi.server.clients[player.data.username].inst)
            if (includeCurrent) insts.push(instanceinator.instances[instanceinator.id])
            return insts
        },
        forEachInst(func, includeCurrent) {
            const prevId = instanceinator.id

            const arr = this.getAllInstances(includeCurrent).map(inst => {
                inst.apply()
                return func()
            })

            instanceinator.instances[prevId].apply()

            return arr
        },
        removeRoundGuis() {
            this.forEachInst(() => {
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
            if (onlyTeamAlive) {
                return this.showKO(onlyTeamAlive.party)
            }
        },
        showKO(party) {
            if (!this.multiplayerPvp) return this.parent(party)

            const points = ++this.points[party]!
            this.lastWinParty = party

            assert(!sc.arena.active)

            this.state = 3
            ig.game.varsChangedDeferred()

            this.forEachInst(() => {
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
                this.forEachInst(() => {
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

            this.forEachInst(() => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STOPPED, null)
                sc.model.setCombatMode(false, true)
            }, true)
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

            this.multiplayerPvp = false
            this.teams = []
            this.removeRoundGuis()
        },
    })
})

export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function stagePvp() {
    assert(multi.server instanceof PhysicsServer)
    const teamConfigs: { name: string; count: number }[] = [
        { name: '1', count: 1 },
        { name: '2', count: 1 },
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

    const masterUsername = teams[0].players[0].data.username
    multi.server.masterUsername = masterUsername

    const masterClient = multi.server.clients[masterUsername]
    assert(masterClient)

    const map = multi.server.maps[masterClient.player.mapName]
    assert(map)

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
