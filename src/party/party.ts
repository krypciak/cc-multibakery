import type { Client } from '../client/client'
import { assert } from '../misc/assert'
import type { COMBATANT_PARTY, MapName, Username } from '../net/binary/binary-types'
import { addCombatantParty } from './combatant-party-api'
import { assertPhysics, isPhysics } from '../server/physics/physics-server-types'
import { runTask } from 'cc-instanceinator/src/inst-util'

import './social-list-gui'
import './party-var-access'
import './vanilla-party'

export type MultiPartyId = string

export interface MultiParty {
    id: MultiPartyId
    owner: Username
    originalOwner: Username
    /* not necessarily unique */
    combatantParty: COMBATANT_PARTY

    title: string
    players: Username[]
    vanillaMembers: string[]
}
/* unfortunately I cant use type magic to create this type automatically since ts-binarifier bugs out on such a type :( */
export interface PartialMultiParty {
    id?: MultiPartyId
    owner?: Username
    originalOwner?: Username
    combatantParty?: COMBATANT_PARTY

    title?: string
    players?: Username[]
    vanillaMembers?: string[]
}

export const MULTI_PARTY_EVENT = {
    JOIN: 1,
    LEAVE: 2,
    PARTY_ADDED: 3,
    PARTY_TITLE_CHANGED: 4,
    VANILLA_MEMBER_JOIN: 5,
    VANILLA_MEMBER_LEAVE: 6,
} as const
export type MULTI_PARTY_EVENT = (typeof MULTI_PARTY_EVENT)[keyof typeof MULTI_PARTY_EVENT]

declare global {
    namespace sc {
        interface PlayerBaseEntity {
            multiParty?: MultiParty
        }
    }
}

export class MultiPartyManager implements sc.Model {
    observers: sc.Model.Observer<this>[] = []

    listeners: MULTI_PARTY_EVENT[] = []
    parties: Record<MultiPartyId, MultiParty> = {}

    /* not enforced by anything */
    maxPartySize: number = 9

    isPartyTitleValid(title: string) {
        /* all ascii printable characters */
        return (TEST || (title.length >= 3 && title.length <= 16)) && /^[\x20-\x7E]+$/.test(title)
    }

    sizeOf(party: MultiParty) {
        return party.players.length + this.vanillaSizeOf(party)
    }

    vanillaSizeOf(party: MultiParty) {
        return party.vanillaMembers.length
    }

    getVanillaMemberEntity(party: MultiParty, modelName: string): { entity?: sc.PartyMemberEntity; map?: string } {
        if (isPhysics(multi.server)) {
            const ownerClient = multi.server.clients.get(party.owner)
            assert(ownerClient)
            const entity = ownerClient.inst.sc.party.getPartyMemberEntity(modelName)
            return { entity, map: ownerClient.getMap().name }
        } else {
            for (const entity of ig.game.entities) {
                if (
                    entity instanceof sc.PartyMemberEntity &&
                    entity.multiParty == party &&
                    entity.model.name == modelName
                ) {
                    return { entity, map: ig.game.mapName }
                }
            }
            return {}
        }
    }

    getPartyCombatants(party: MultiParty, onMap?: MapName): ig.ENTITY.Combatant[] {
        const combatants: ig.ENTITY.Combatant[] = []
        if (isPhysics(multi.server)) {
            for (const username of party.players) {
                const client = multi.server.clients.get(username)
                assert(client?.dummy)
                if (!onMap || client.getMap().name == onMap) {
                    combatants.push(client.dummy)
                }
            }
        } else {
            assert(onMap == ig.game.mapName)
            for (const entity of ig.game.entities) {
                if (entity instanceof dummy.DummyPlayer && party.players.includes(entity.username)) {
                    combatants.push(entity)
                }
            }
        }
        for (const modelName of party.vanillaMembers) {
            const { entity, map } = this.getVanillaMemberEntity(party, modelName)
            assert(entity)
            if (!onMap || map == onMap) {
                combatants.push(entity)
            }
        }
        return combatants
    }

    addParty(party: MultiParty) {
        assert(!this.parties[party.id])
        assert(this.isPartyTitleValid(party.title))
        this.parties[party.id] = party

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.PARTY_ADDED, { party })
    }

    onPlayerCreate(username: Username) {
        const inParty = this.getPartyOfUsername(username, true)
        if (inParty) {
            this.setPlayerData(username, inParty)
        } else {
            const personalParty = this.createPersonalParty(username)

            this.setPlayerData(username, personalParty)
            if (!personalParty.players.includes(username)) {
                this.joinParty(username, personalParty)
                this.transferPartyOwnership(username, personalParty)
            }
        }
    }

    private createPersonalParty(username: Username) {
        const id = 'personal_' + username
        let personalParty: MultiParty = this.parties[id]
        if (personalParty) return personalParty

        const combatantParty = addCombatantParty(id)
        personalParty = {
            id,
            owner: username,
            originalOwner: username,
            combatantParty,
            title: `${username}`,
            players: [],
            vanillaMembers: [],
        }
        this.addParty(personalParty)
        this.joinParty(username, personalParty)

        return personalParty
    }

    getPartyOfUsername(username: Username, noAssert?: false): MultiParty
    getPartyOfUsername(username: Username, noAssert: true): MultiParty | undefined
    getPartyOfUsername(username: Username, noAssert?: boolean): MultiParty | undefined {
        for (const partyName in this.parties) {
            const party = this.parties[partyName]
            if (party.players.includes(username)) return party
        }
        if (!noAssert) assert(false, `party of ${username} not found!`)
    }

    getPartyOfEntity(entity: dummy.DummyPlayer): MultiParty
    getPartyOfEntity(entity: sc.PartyMemberEntity): MultiParty
    getPartyOfEntity(entity: ig.Entity): MultiParty | undefined
    getPartyOfEntity(entity: ig.Entity): MultiParty | undefined {
        if (entity instanceof sc.PlayerBaseEntity) return entity.multiParty
    }

    private getOriginalOwnerPartyOf(username: Username): MultiParty {
        for (const partyName in this.parties) {
            const party = this.parties[partyName]
            if (party.originalOwner == username) return party
        }
        assert(false, `owner party of ${username} not found!`)
    }

    private leaveParty(username: Username) {
        const party = this.getPartyOfUsername(username)
        assert(party.players.includes(username))
        party.players.erase(username)

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.LEAVE, { party })
    }

    leaveCurrentParty(username: Username) {
        this.leaveParty(username)

        const ownerParty = this.getOriginalOwnerPartyOf(username)
        this.joinParty(username, ownerParty)
    }

    private setPlayerData(username: Username, party: MultiParty) {
        if (isPhysics(multi.server)) {
            const client = multi.server.clients.get(username)
            assert(client?.dummy)
            runTask(client.inst, () => this.setCombatantData(client.dummy, party))
        }
    }

    /* has to be run in the context where the combatant is */
    private setCombatantData(combatant: sc.PlayerBaseEntity, party: MultiParty) {
        if (combatant instanceof dummy.DummyPlayer) sc.combat.removeActiveCombatant(combatant)
        sc.combat.changeCombatantParty(combatant, party.combatantParty)
        if (combatant instanceof dummy.DummyPlayer) sc.combat.addActiveCombatant(combatant)

        combatant.multiParty = party
    }

    joinParty(username: Username, party: MultiParty) {
        assert(!party.players.includes(username), 'joinParty: player is already in this party!')
        assert(!this.getPartyOfUsername(username, true), 'joinParty: player is in a different party!')
        party.players.push(username)

        this.setPlayerData(username, party)

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.JOIN, { party })
    }

    switchParty(username: Username, party: MultiParty) {
        this.leaveParty(username)
        this.joinParty(username, party)
    }

    invitePlayerTo(username: Username, party: MultiParty) {
        assertPhysics(multi.server)
        this.switchParty(username, party)
    }

    changePartyTitle(party: MultiParty, newTitle: string) {
        assert(this.isPartyTitleValid(newTitle))
        party.title = newTitle

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.PARTY_TITLE_CHANGED, { party })
    }

    joinPartyVanillaMember(model: string, party: MultiParty) {
        assert(!party.vanillaMembers.includes(model))
        party.vanillaMembers.push(model)

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.VANILLA_MEMBER_JOIN, { party })
    }

    leavePartyVanillaMember(model: string, party: MultiParty) {
        assert(party.vanillaMembers.includes(model))
        party.vanillaMembers.erase(model)

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.VANILLA_MEMBER_LEAVE, { party })
    }

    updateVanillaMemberInfo(member: sc.PartyMemberEntity, party: MultiParty) {
        assertPhysics(multi.server)
        this.setCombatantData(member, party)
        const ownerClient = multi.server.clients.get(party.owner)
        assert(ownerClient?.dummy)
        member.ownerPlayer = ownerClient.dummy
    }

    private transferPartyOwnership(toUsername: Username, party: MultiParty) {
        party.owner = toUsername
        for (const modelName of [...party.vanillaMembers]) {
            this.leavePartyVanillaMember(modelName, party)
        }
    }

    onClientDestroy(this: this, client: Client) {
        if (!isPhysics(multi.server)) return
        if (!client.dummy) return

        const party = this.getPartyOfEntity(client.dummy)
        if (!party) return
        if (party.owner == client.username) {
            const nextPlayer = party.players.find(username => username != client.username)
            if (nextPlayer) {
                this.transferPartyOwnership(nextPlayer, party)
            }
        }
        this.leaveParty(client.username)
    }
}
