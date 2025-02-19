import { Client, ClientSettings } from './client'
import './misc/paused-virtual'

export interface LocalClientSettings extends ClientSettings {}

export class LocalClient implements Client<LocalClientSettings> {
    isExecutingUpdatePacketNow: boolean = false

    constructor(public s: LocalClientSettings) {}
}
