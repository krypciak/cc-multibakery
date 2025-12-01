import type { Client } from '../client/client'
import { assert } from '../misc/assert'
import type { COMBATANT_PARTY } from '../net/binary/binary-types'
import type {
    AttackType,
    DefenceType,
    ExpType,
    FocusType,
    HpType,
    SpLevelType,
    SpType,
    ArmorType,
    LevelType,
    Username,
    MapName,
} from '../net/binary/binary-types'
import { addCombatantParty } from './combatant-party-api'
import { assertPhysics, isPhysics } from '../server/physics/is-physics-server'
import { isRemote } from '../server/remote/is-remote-server'

import './social-list-gui'
import './party-var-access'
import './vanilla-party'

export type MultiPartyId = string

export interface MultiParty {
    id: MultiPartyId
    owner: Username
    /* not necessarily unique */
    combatantParty: COMBATANT_PARTY

    title: string
    players: Username[]
    vanillaMembers: string[]
}

// export type PlayerInfoStatus = 'online' | 'in-party' | 'current-party'

export interface PlayerInfoEntry {
    username: Username
    character: string
    // status: PlayerInfoStatus

    stats: {
        level: LevelType
        maxhp: HpType
        attack: AttackType
        defense: DefenceType
        focus: FocusType

        hp: HpType
        spLevel: SpLevelType
        sp: SpType
        exp: ExpType
    }
    equip: {
        head: ArmorType
        leftArm: ArmorType
        rightArm: ArmorType
        torso: ArmorType
        feet: ArmorType
    }
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
        /* all ascii pritable characters */
        return title.length >= 3 && title.length <= 16 && /^[\x20-\x7E]+$/.test(title)
    }

    sizeOf(party: MultiParty) {
        return party.players.length
    }

    getPartyCombatants(party: MultiParty, onMap?: MapName): dummy.DummyPlayer[] {
        const combatants: dummy.DummyPlayer[] = []
        for (const username of party.players) {
            const client = multi.server.clients.get(username)
            assert(client?.dummy)
            if (!onMap || client.getMap().name == onMap) {
                combatants.push(client.dummy)
            }
        }
        return combatants
    }

    getPartiesWithCombatantParty(combatantParty: COMBATANT_PARTY): MultiParty[] {
        return Object.values(this.parties).filter(party => party.combatantParty == combatantParty)
    }

    addParty(party: MultiParty) {
        assert(!this.parties[party.id])
        assert(this.isPartyTitleValid(party.title))
        this.parties[party.id] = party

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.PARTY_ADDED, { party })
    }

    createPersonalParty(username: Username) {
        const id = 'personal_' + username
        if (this.parties[id]) {
            this.setPlayerData(username, this.parties[id])
            return
        }
        const combatantParty = addCombatantParty(id)
        const party: MultiParty = {
            id,
            owner: username,
            combatantParty,
            title: `${username}`,
            players: [],
            vanillaMembers: [],
        }
        this.addParty(party)
        this.joinParty(username, party)

        return party
    }

    getPartyOfUsername(username: Username): MultiParty {
        for (const partyName in this.parties) {
            const party = this.parties[partyName]
            if (party.players.includes(username)) return party
        }
        assert(false, `party of ${username} not found!`)
    }

    getPartyOfEntity(entity: dummy.DummyPlayer): MultiParty
    getPartyOfEntity(entity: sc.PartyMemberEntity): MultiParty
    getPartyOfEntity(entity: ig.Entity): MultiParty | undefined
    getPartyOfEntity(entity: ig.Entity): MultiParty | undefined {
        if (entity instanceof sc.PlayerBaseEntity) return entity.multiParty
    }

    private getOwnerPartyOf(username: Username): MultiParty {
        for (const partyName in this.parties) {
            const party = this.parties[partyName]
            if (party.owner == username) return party
        }
        assert(false, `owner party of ${username} not found!`)
    }

    private leaveParty(username: Username) {
        const party = this.getPartyOfUsername(username)
        assert(party.players.includes(username))
        party.players.erase(username)

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.LEAVE, { username, party })
    }

    leaveCurrentParty(username: Username) {
        this.leaveParty(username)

        const ownerParty = this.getOwnerPartyOf(username)
        this.joinParty(username, ownerParty)
    }

    private setPlayerData(username: Username, party: MultiParty) {
        if (isPhysics(multi.server)) {
            const client = multi.server.clients.get(username)
            assert(client?.dummy)
            this.setCombatantData(client.dummy, party)
        }
    }

    private setCombatantData(combatant: sc.PlayerBaseEntity, party: MultiParty) {
        combatant.party = party.combatantParty
        combatant.multiParty = party
    }

    joinParty(username: Username, party: MultiParty) {
        assert(!party.players.includes(username))
        party.players.push(username)

        this.setPlayerData(username, party)

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.JOIN, { username, party })
    }

    invitePlayerTo(username: Username, party: MultiParty) {
        this.leaveParty(username)
        this.joinParty(username, party)
    }

    changePartyTitle(party: MultiParty, newTitle: string) {
        party.title = newTitle

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.PARTY_TITLE_CHANGED, { party })
    }

    joinPartyVanillaMember(model: string, party: MultiParty) {
        assert(!party.vanillaMembers.includes(model))
        party.vanillaMembers.push(model)

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.VANILLA_MEMBER_JOIN, { model, party })
    }

    leavePartyVanillaMember(model: string, party: MultiParty) {
        assert(party.vanillaMembers.includes(model))
        party.vanillaMembers.erase(model)

        sc.Model.notifyObserver(this, MULTI_PARTY_EVENT.VANILLA_MEMBER_LEAVE, { model, party })
    }

    updateVanillaMemberInfo(member: sc.PartyMemberEntity, party: MultiParty) {
        assertPhysics(multi.server)
        this.setCombatantData(member, party)
        const ownerClient = multi.server.clients.get(party.owner)
        assert(ownerClient?.dummy)
        member.ownerPlayer = ownerClient.dummy
    }

    onClientDestroy(this: this, client: Client) {
        if (!isPhysics(multi.server)) return
        if (!client.dummy) return
        this.leaveCurrentParty(client.username)
    }

    getPlayerInfoOf(username: Username): PlayerInfoEntry {
        if (isRemote(multi.server)) throw new Error('RemoteServer#getPlayerList not implemented!')

        const client = multi.server.clients.get(username)
        assert(client?.dummy)
        const model = client.dummy.model
        return {
            username: client.username,
            character: model.name,
            stats: {
                level: model.level,
                maxhp: model.params.getStat('hp'),
                attack: model.params.getStat('attack'),
                defense: model.params.getStat('defense'),
                focus: model.params.getStat('focus'),

                hp: model.params.currentHp,
                spLevel: model.params.maxSp,
                sp: model.params.currentSp,
                exp: model.exp,
            },
            equip: model.equip,
        }
    }

    getPlayerInfoList(): PlayerInfoEntry[] {
        return [...multi.server.clients.values()]
            .filter(client => client.dummy)
            .map(client => this.getPlayerInfoOf(client.username))
    }
}
