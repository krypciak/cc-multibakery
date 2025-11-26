import { assert } from '../misc/assert'
import { COMBATANT_PARTY } from '../net/binary/binary-types'
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
} from '../net/binary/binary-types'
import { PhysicsServer } from '../server/physics/physics-server'
import { RemoteServer } from '../server/remote/remote-server'
import { addCombatantParty } from './combatant-party-api'

import './social-list-gui'

export type MultiPartyId = string

export interface MultiParty {
    id: MultiPartyId
    owner: Username
    /* not necessarily unique */
    combatantParty: COMBATANT_PARTY

    title: string
    players: Username[]
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

export class MultiPartyManager implements sc.Model {
    observers: sc.Model.Observer<this>[] = []
    parties: Record<MultiPartyId, MultiParty> = {}

    /* not enforced by anything */
    static maxPartySize: number = 9

    static isPartyTitleValid(title: string) {
        /* all ascii pritable characters */
        return title.length >= 3 && title.length <= 16 && /^[\x20-\x7E]+$/.test(title)
    }

    static sizeOf(party: MultiParty) {
        return party.players.length
    }

    addParty(party: MultiParty) {
        assert(!this.parties[party.id])
        assert(MultiPartyManager.isPartyTitleValid(party.title))
        this.parties[party.id] = party
        this.onChanged()
    }

    createPersonalParty(username: Username) {
        const id = 'personal_' + username
        const combatantParty = addCombatantParty(id)
        const party: MultiParty = {
            id,
            owner: username,
            combatantParty,
            title: `${username}`,
            players: [],
        }
        this.addParty(party)
        this.joinParty(username, party)

        return party
    }

    getPartyOf(username: Username): MultiParty {
        for (const partyName in this.parties) {
            const party = this.parties[partyName]
            if (party.players.includes(username)) return party
        }
        assert(false, `party of ${username} not found!`)
    }

    private getOwnerPartyOf(username: Username): MultiParty {
        for (const partyName in this.parties) {
            const party = this.parties[partyName]
            if (party.owner == username) return party
        }
        assert(false, `owner party of ${username} not found!`)
    }

    private leaveParty(username: Username) {
        const party = this.getPartyOf(username)
        assert(party.players.includes(username))
        party.players.erase(username)
    }

    leaveCurrentParty(username: Username) {
        this.leaveParty(username)

        const ownerParty = this.getOwnerPartyOf(username)
        this.joinParty(username, ownerParty)
        this.onChanged()
    }

    joinParty(username: Username, party: MultiParty) {
        assert(!party.players.includes(username))
        party.players.push(username)

        if (multi.server instanceof PhysicsServer) {
            const client = multi.server.clients.get(username)
            assert(client)
            client.dummy.party = party.combatantParty
        }

        this.onChanged()
    }

    invitePlayerTo(username: Username, party: MultiParty) {
        this.leaveParty(username)
        this.joinParty(username, party)
    }

    clickedParty(party: MultiParty, newTitle: string) {
        party.title = newTitle
        this.onChanged()
    }

    private onChanged() {
        sc.Model.notifyObserver(this, 0)
    }

    getPlayerInfoOf(username: Username): PlayerInfoEntry {
        if (multi.server instanceof RemoteServer) throw new Error('RemoteServer#getPlayerList not implemented!')

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
