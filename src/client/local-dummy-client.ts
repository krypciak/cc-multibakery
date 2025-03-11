import { ServerPlayer } from '../server/server-player'
import { Client, ClientSettings } from './client'
// import './misc/paused-virtual'

export interface LocalDummyClientSettings extends ClientSettings {}

export class LocalDummyClient implements Client<LocalDummyClientSettings> {
    player!: ServerPlayer

    constructor(public s: LocalDummyClientSettings) {
        this.player = new ServerPlayer(s.username)
    }
}
