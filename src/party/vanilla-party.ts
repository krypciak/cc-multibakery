import { runTask } from 'cc-instanceinator/src/inst-util'
import { runTaskInMapInst } from '../client/client'
import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { assertPhysics } from '../server/physics/is-physics-server'

declare global {
    namespace sc {
        interface PartyMemberEntity {
            ownerPlayer: dummy.DummyPlayer
        }
    }
}
let pickModelFromInst: number | undefined
prestart(() => {
    sc.PartyModel.inject({
        addPartyMember(name, npc, noEntityUpdate, skipEffect, temporary) {
            this.parent(name, npc, noEntityUpdate, skipEffect, temporary)

            if (!multi.server) return
            assert(ig.client)
            const player = ig.client.dummy
            const party = multi.server.party.getPartyOfEntity(player)
            multi.server.party.joinPartyVanillaMember(name, party)
        },
        removePartyMember(name, npc, skipEffect) {
            this.parent(name, npc, skipEffect)

            if (!multi.server) return
            assert(ig.client)
            const player = ig.client.dummy
            const party = multi.server.party.getPartyOfEntity(player)
            multi.server.party.leavePartyVanillaMember(name, party)
        },
        _spawnPartyMemberEntity(name, showEffects, idx, npc) {
            if (!multi.server) return this.parent(name, showEffects, idx, npc)
            assertPhysics(multi.server)
            assert(ig.client)

            const player = ig.game.playerEntity as dummy.DummyPlayer
            const party = multi.server.party.getPartyOfEntity(player)

            pickModelFromInst = instanceinator.id
            runTaskInMapInst(() => {
                ig.game.playerEntity = player
                this.parent(name, showEffects, idx, npc)
                ig.game.playerEntity = null as any
            })
            pickModelFromInst = undefined
            const partyMember = this.partyEntities[name]
            multi.server.party.updateVanillaMemberInfo(partyMember, party)
        },
        getPartyMemberModel(name) {
            if (pickModelFromInst)
                return runTask(instanceinator.instances[pickModelFromInst], () => sc.party.models[name])
            return this.parent(name)
        },
        getCurrentPartyIndex(name) {
            if (!multi.server || !ig.client?.dummy) return this.parent(name)
            const party = multi.server.party.getPartyOfEntity(ig.client.dummy)
            return party.vanillaMembers.indexOf(name)
        },
        getPartySize() {
            if (!multi.server || !ig.client?.dummy) return this.parent()
            const party = multi.server.party.getPartyOfEntity(ig.client.dummy)
            if (!party) return 0
            return party.vanillaMembers.length
        },
        getPartySizeAlive(unused) {
            if (!multi.server) return this.parent(unused)
            if (!ig.client) return 0
            if (this.isDungeonBlocked()) return 0

            let count = 0
            for (const modelName of this.currentParty) {
                const model = this.getPartyMemberModel(modelName)
                if (model.isAlive()) count++
            }
            return count
        },
        /* TODO */
        // getDmgFactor() {},
    })
})

prestart(() => {
    sc.PartyMemberEntity.inject({
        update() {
            if (!multi.server) return this.parent()
            assertPhysics(multi.server)
            assert(this.ownerPlayer)

            const client = this.ownerPlayer.getClient(true)
            if (client && client.getMap().name == ig.game.mapName) {
                runTask(client.inst, () => this.parent())
            } else {
                this.kill()
            }
        },
    })
})
