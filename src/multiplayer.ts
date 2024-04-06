import { Server } from 'http'
import { CCServer } from './server'

export const DEFAULT_PORT = 33405

import * as express from 'express'
import * as bodyParser from 'body-parser'
import { API_JOIN } from './types'
import { Player } from './player'
const axios: typeof import('axios') = require('axios')

declare global {
    interface Window {
        axios: typeof axios
    }
}

export class Multiplayer {
    headless: boolean = false

    ccservers: Record<string, CCServer> = {}
    /* current processed server */
    ccserver!: CCServer

    app!: express.Application
    webserver!: Server

    constructor() {
        import('./game-loop')
        import('./update-loop')
    }

    appendServer(server: CCServer) {
        ig.multiplayer.ccservers[server.s.name] = server
    }

    private validateJoin(data: any): data is API_JOIN {
        return typeof data.username === 'string'
    }

    start() {
        this.ccserver = Object.values(this.ccservers)[0]
        this.ccserver.start()

        this.app = express.default()
        const port = this.ccserver.s.port

        this.webserver = this.app.listen(port, () => {
            console.log(`Example app listening on port ${port}`)
        })

        window.addEventListener('beforeunload', () => {
            this.webserver.close()
        })

        this.app.get('/', (_req, res) => {
            res.send('krosskod')
        })

        this.app.get('/playernames', (_req, res) => {
            res.send(this.ccserver.getPlayers().map(p => p.name))
        })

        this.app.post('/join', bodyParser.json(), (req, res) => {
            const body: unknown = req.body
            if (this.validateJoin(body)) {
                this.playerJoin(body)
                res.status(200).send()
            } else {
                res.status(400).send()
            }
        })

        window.axios = axios
    }

    private async playerJoin(data: API_JOIN) {
        const player = await Player.new(data.username)
        this.ccserver.joinPlayer(player)
    }
}
