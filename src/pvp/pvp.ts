import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import { runTask, runTasks, wait } from 'cc-instanceinator/src/inst-util'
import type { CCMap } from '../server/ccmap/ccmap'
import type { OnLinkChange } from '../server/ccmap/ccmap'
import { MULTI_PARTY_EVENT, type MultiParty } from '../party/party'
import { runTaskInMapInst } from '../client/client'
import type { COMBATANT_PARTY as COMBATANT_PARTY1 } from '../net/binary/binary-types'
import { isPhysics } from '../server/physics/is-physics-server'

import './gui'
import './steps'
import './pvp-var-access'

declare global {
    namespace sc {
        interface PvpModel extends OnLinkChange, sc.Model.Observer {
            multiplayerPvp?: boolean
            parties: MultiParty[]
            roundGuis: Record<number, sc.PvpRoundGui>
            map: CCMap
            hpBars: Record<number, sc.SUB_HP_EDITOR.PVP[]>
            points: PartialRecord<COMBATANT_PARTY1, number>

            clearParties(this: this): void
            addParty(this: this, party: MultiParty): void
            startMultiplayerPvp(this: this, winPoints: number): void
            removeRoundGuis(this: this): void
            getPlayerInstanceRelation(this: this, player: dummy.DummyPlayer): 'same' | 'ally' | 'enemy'
            getOnlyPartyAlive(this: this): MultiParty | undefined
            pushHpBar(this: this, bar: sc.SUB_HP_EDITOR.PVP): void
            eraseHpBar(this: this, bar: sc.SUB_HP_EDITOR.PVP): void
            rearrangeHpBars(this: this): void
            resetMultiState(this: this): void
            removePvpGuis(this: this): void
            showKOGuis(this: this): void
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
        init() {
            this.parent()
            this.parties = []
        },
        clearParties() {
            assert(multi.server)
            this.parties = []
        },
        addParty(party) {
            assert(multi.server)
            assert(multi.server.party.sizeOf(party) > 0)
            assert(!this.parties.includes(party))
            this.parties.push(party)
        },
        startMultiplayerPvp(winPoints) {
            assert(this.parties?.length > 1)
            assert(multi.server)

            sc.Model.addObserver(multi.server.party, this)

            this.multiplayerPvp = true
            this.roundGuis = {}
            this.hpBars = {}

            this.state = 1
            this.round = 0
            this.winPoints = winPoints
            this.points[sc.COMBATANT_PARTY.PLAYER] = 0
            this.points[sc.COMBATANT_PARTY.ENEMY] = 0

            for (const party of this.parties) {
                this.points[party.combatantParty] = 0
            }

            this.enemies = []

            runTaskInMapInst(() => {
                this.map = ig.ccmap!
            })

            runTasks(this.map.getAllInstances(true), () => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STARTED, null)
                sc.model.setCombatMode(true, true)
            })

            this.map.onLinkChange.push(this)
        },
        removeRoundGuis() {
            runTasks(this.map.getAllInstances(true), () => {
                const id = instanceinator.id
                this.roundGuis[id]?.remove()
            })
            this.roundGuis = {}
        },
        getOnlyPartyAlive() {
            const partiesAlive = this.parties.filter(party =>
                multi.server.party.getPartyCombatants(party).some(combatant => !combatant.isDefeated())
            )

            if (partiesAlive.length == 1) {
                return partiesAlive[0]
            }
        },
        getPlayerInstanceRelation(player) {
            const instancePlayer = ig.game.playerEntity
            if (!ig.game.playerEntity) return 'enemy'

            assert(instancePlayer instanceof dummy.DummyPlayer)
            if (ig.game.playerEntity == player) return 'same'

            return instancePlayer.party == player.party ? 'ally' : 'enemy'
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
                    let enemyY = 5
                    let allyY = 5
                    const height = 20

                    for (let i = 0; i < hpBars.length; i++) {
                        const bar = hpBars[i]
                        if (!bar._isHpBarVisible()) continue

                        if (bar.relation == 'enemy') {
                            bar.setPos(bar.hook.pos.x, enemyY)
                            enemyY += height
                        } else {
                            bar.setPos(bar.hook.pos.x, allyY)
                            allyY += height
                        }
                    }
                }
            )
        },
        modelChanged(model, message, data) {
            if (!this.multiplayerPvp || !isPhysics(multi.server)) return this.parent?.(model, message, data)

            if (model == multi.server.party) {
                if (message == MULTI_PARTY_EVENT.LEAVE) {
                    const { party } = data as { party: MultiParty }

                    if (multi.server.party.sizeOf(party) == 0) {
                        this.parties.erase(party)

                        const onlyPartyAlive = this.getOnlyPartyAlive()
                        if (onlyPartyAlive) {
                            if (this.parties.length == 1) {
                                this.points[onlyPartyAlive.combatantParty] = this.winPoints
                            }
                            this.onPostKO(onlyPartyAlive.combatantParty)
                        }
                    }
                }
            }
        },
        onClientLink(client) {
            if (this.multiplayerPvp) {
                runTask(client.inst, () => {
                    sc.model.setCombatMode(true, true)
                })
            }
        },
        onClientUnlink(client) {
            const player = client.dummy

            delete this.hpBars[client.inst.id]
            for (const key in this.hpBars) {
                this.hpBars[key] = this.hpBars[key].filter(bar => bar.target != (player as any))
            }
            this.rearrangeHpBars()
        },
        resetMultiState() {
            this.multiplayerPvp = false
            this.parties = []
            this.points = {}
            this.map = undefined as any
        },
        removePvpGuis() {
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
        },
        showKOGuis() {
            runTasks(this.map.getAllInstances(true), () => {
                const koGui = new sc.PvpKoGui()
                ig.gui.addGuiElement(koGui)
            })
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

            for (const party of this.parties) {
                if (multi.server.party.getPartyCombatants(party).includes(combatant)) return true
            }
            return false
        },
        onPvpCombatantDefeat(combatant) {
            if (!this.multiplayerPvp) return this.parent(combatant)

            if (!this.isActive() || !(combatant instanceof dummy.DummyPlayer)) return false

            this.rearrangeHpBars()

            const onlyTeamAlive = this.getOnlyPartyAlive()
            if (onlyTeamAlive) return this.showKO(onlyTeamAlive.combatantParty)
        },
        showKO(combatantParty) {
            if (!this.multiplayerPvp) return this.parent(combatantParty)

            const points = ++this.points[combatantParty]!
            this.lastWinParty = combatantParty

            assert(!sc.arena.active)

            this.state = 3
            ig.game.varsChangedDeferred()

            this.showKOGuis()

            return sc.DRAMATIC_EFFECT[points == this.winPoints ? 'PVP_FINAL_KO' : 'PVP_KO']
        },
        onPostKO(combatantParty) {
            if (!this.multiplayerPvp) return this.parent(combatantParty)

            for (const party of this.parties) {
                const regenAmount = party.combatantParty == combatantParty ? 0.5 : 1
                for (const combatant of multi.server.party.getPartyCombatants(party)) {
                    combatant.regenPvp(regenAmount)
                }
            }
            this.state = this.isOver() ? 5 : 4
            ig.game.varsChangedDeferred()

            this.rearrangeHpBars()
        },
        startNextRound(autoContinue) {
            if (!this.multiplayerPvp) return this.parent(autoContinue)

            this.round += 1

            this.roundGuis = Object.fromEntries(
                runTasks(this.map.getAllInstances(true), () => {
                    const roundGui = new sc.PvpRoundGui(this.round, autoContinue)
                    ig.gui.addGuiElement(roundGui)
                    return [instanceinator.id, roundGui]
                })
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
        onPostUpdate() {
            if (!this.multiplayerPvp) return this.parent()

            if (this.state == 3) {
                const onlyPartyAlive = this.getOnlyPartyAlive()
                if (onlyPartyAlive) this.onPostKO(onlyPartyAlive.combatantParty)
            }
        },
        stop() {
            if (!this.multiplayerPvp) return this.parent()

            sc.Model.removeObserver(multi.server.party, this)

            this.state = 0

            this.removePvpGuis()
            /* wait for sc.CombatUpperHud.CONTENT_GUI.PVP to hide */
            wait(this.map.inst, 1).then(() => {
                this.resetMultiState()
            })

            runTasks(this.map.getAllInstances(true), () => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STOPPED, null)
                sc.model.setCombatMode(false, true)
            })
        },
        onReset() {
            this.parent()
            if (!multi.server) return

            runTasks(this.map.getAllInstances(), () => {
                sc.Model.notifyObserver(this, sc.PVP_MESSAGE.STOPPED, null)
            })

            this.removePvpGuis()
            this.resetMultiState()
        },
    })
})
