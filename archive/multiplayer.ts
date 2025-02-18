import { LocalClient } from './local-client'
import { Server } from './local-server'
import { assert } from './misc/assert'
import type {} from 'crossnode/crossnode.d.ts'

import './dummy-player'
import './state/states'

export const DEFAULT_PORT = 33405

export class Multiplayer {
    headless: boolean = false

    server!: Server
    client!: LocalClient

    nowServer: boolean = false

    constructor() {
        this.headless = !!window.crossnode
        this.init()
    }

    private async init() {
        await import('./game-loop')
        // await import('./update-loop')
        // teleportFix()
    }

    setServer(server: Server) {
        assert(!this.server, 'Server already set!')
        this.server = server
    }

    async setClient(client: LocalClient) {
        assert(!this.client, 'Client already set!')
        this.client = client
        const res = await this.server.joinClient(client)
        console.log(res)
        this.client.notifyJoin(res)
    }
}
