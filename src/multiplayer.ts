import { LocalClient } from './local-client'
import { Server } from './local-server'
import { assert } from './misc/assert'
import { injectEntityStateDefinitions } from './state/states'
import type {} from 'crossnode/crossnode.d.ts'

export const DEFAULT_PORT = 33405

export class Multiplayer {
    headless: boolean = false

    server!: Server
    client!: LocalClient

    nowClient: boolean = false
    nowServer: boolean = false

    constructor() {
        this.headless = !!window.crossnode
        this.init()
    }

    private async init() {
        // await import('./game-loop')
        // await import('./update-loop')
        await import('./dummy-player')
        // teleportFix()
        injectEntityStateDefinitions()
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
    }
}
