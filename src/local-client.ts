import { FromClientUpdatePacket, ToClientUpdatePacket } from './api'
import { assert } from './misc/assert'
import { Player } from './player'
import { prestart } from './plugin'

import { popLocalUpdatePacket } from './local-client-update-packet-gather'
import { EntityStateEntry } from './state/states'
import { emptyGatherInput } from './dummy-player'

import './misc/paused-virtual'
import './local-client-update-packet-gather'

export interface ClientSettings {
    username: string
    globalTps: number
}

export interface Client<T extends ClientSettings = ClientSettings> {
    player: Player
    s: T

    update(packet: FromClientUpdatePacket): void
}

prestart(() => {
    sc.CrossCode.inject({
        createPlayer() {
            if (multi.nowClient) return this.parent()
            const dummy = this.spawnEntity(ig.dummy.DummyPlayer, 0, 0, 0, {
                username: multi.client.player.name,
                ignoreInputForcer: false,
            })
            this.playerEntity = dummy
            sc.model.player = dummy.model
        },
    })

    ig.dummy.DummyPlayer.inject({
        gatherInput() {
            if (multi.nowClient && this === ig.game.playerEntity && ig.game.pausedVirtual) return emptyGatherInput()
            return this.parent()
        },
    })

    ig.Vars.inject({
        set(...args) {
            if (!multi.nowClient || multi.client.isExecutingUpdatePacketNow) {
                this.parent(...args)
            }
        },
    })
})

export interface LocalClientSettings extends ClientSettings {}

export class LocalClient implements Client<LocalClientSettings> {
    player: Player
    isExecutingUpdatePacketNow: boolean = false

    constructor(public s: LocalClientSettings) {
        this.player = new Player(s.username)
    }

    async sendDataToServer() {
        const data = popLocalUpdatePacket()
        /* insert artificial ping here */
        return multi.server.receiveDataFromClient(this.player.name, data)
    }

    update(packet: FromClientUpdatePacket) {
        console.log('update', packet)
    }
}

function runUpdatePacket(packet: ToClientUpdatePacket) {
    multi.client.isExecutingUpdatePacketNow = true
    if (packet.vars) {
        for (const { path, value } of packet.vars) {
            ig.vars.set(path, value)
        }
    }

    if (packet.entityStates && ig.game?.maps?.length > 0 /* check if the game has loaded already */) {
        for (const uuid in packet.entityStates) {
            const state = packet.entityStates[uuid]

            if (state.type == 'ig.dummy.DummyPlayer') {
                setPlayerState(state, uuid)
            } else throw new Error(`Entity uuid: ${uuid} type: ${state.type} is not implemeneted`)
        }
    }
    if (packet.playersLeft) {
        console.log(packet.playersLeft)
        for (const uuid of packet.playersLeft) {
            const player = ig.game.entitiesByUUID[uuid]
            if (!player) throw new Error('tried to "leave" a non exisitng player')
            if (player.type !== 'ig.dummy.DummyPlayer') throw new Error('tried to "leave" a non player')
            player.kill()
            delete ig.game.entitiesByUUID[player.uuid]
        }
    }
    multi.client.isExecutingUpdatePacketNow = false
}

function setPlayerState(state: EntityStateEntry<'ig.dummy.DummyPlayer'>, uuid: string) {
    let dummy = ig.game.entitiesByUUID[uuid] as ig.dummy.DummyPlayer | undefined
    if (dummy?._killed) dummy = undefined

    if (state.username == multi.client.player.name && !dummy) {
        assert(ig.game.playerEntity instanceof ig.dummy.DummyPlayer, 'not possible')
        dummy = ig.game.playerEntity
        delete ig.game.entitiesByUUID[dummy.uuid]
        dummy.uuid = uuid
        ig.game.entitiesByUUID[uuid] = dummy
        if (multi.server.s.godmode) ig.godmode(dummy.model)
    } else if (!dummy) {
        dummy = ig.game.spawnEntity(ig.dummy.DummyPlayer, 0, 0, 0, { username: state.username!, uuid })
        console.log('creating ', state.username, ig.loading, ig.ready)
        ig.game.entitiesByUUID[uuid] = dummy
        if (multi.server.s.godmode) ig.godmode(dummy.model)
        dummy.showUsernameBox()
        console.log('created')
    }

    dummy.setState(state)
}
