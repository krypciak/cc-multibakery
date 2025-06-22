import { assert } from '../../misc/assert'
import { NetConnection } from '../../net/connection'
import { SocketNetManagerRemoteServer } from '../../net/socket'
import { prestart } from '../../plugin'
import { applyStateUpdatePacket } from '../../state/states'
import { PhysicsServerUpdatePacket } from '../physics/physics-server-sender'
import { ClientJoinAckData, ClientJoinData, Server, ServerSettings } from '../server'
import { Client } from '../../client/client'
import { NetServerInfoRemote } from '../../client/menu/server-info'
import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { showClientErrorPopup } from '../../client/menu/error-popup'
import { Opts } from '../../options'

import './remote-server-sender'
import './ignore-pause-screen'
import './entity-physics'

export type RemoteServerConnectionSettings = {
    host: string
    port: number
} & {
    type: 'socket'
}

export interface RemoteServerSettings extends ServerSettings {
    connection: RemoteServerConnectionSettings
}

export class RemoteServer extends Server<RemoteServerSettings> {
    remote = true
    netManager!: SocketNetManagerRemoteServer
    notifyReadyMaps?: string[]

    constructor(public settings: RemoteServerSettings) {
        console.info('ROLE: RemoteServer')
        super()
    }

    async start() {
        await super.start()

        const connS = this.settings.connection
        if (connS.type == 'socket') {
            this.netManager = new SocketNetManagerRemoteServer(connS.host, connS.port)
        } else assert(false)

        await this.netManager.connect()
        this.measureTraffic = Opts.showPacketNetworkTraffic
    }

    protected onInstanceUpdateError(inst: InstanceinatorInstance, error: unknown, whenApplingPacket?: boolean): never {
        showClientErrorPopup(inst, error, whenApplingPacket)
        super.onInstanceUpdateError(inst, error)
    }

    async tryJoinClient(
        joinData: ClientJoinData,
        remote: boolean
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }> {
        assert(!remote)

        const ackData = await this.netManager.sendJoin(joinData)
        let client: Client | undefined
        if (ackData.status == 'ok') {
            this.baseInst.display = false
            client = await this.createAndJoinClient({
                username: joinData.username,
                inputType: 'clone',
                remote,
            })
            assert(this.netManager.conn)
            this.netManager.conn.join(client)
        }

        return { client, ackData }
    }

    async onNetDisconnect() {
        if (this.destroyed) return
        console.log('server disconnected')
        await multi.destroyAndStartLoop()
        sc.Dialogs.showErrorDialog('Disconnected')
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        try {
            this.processPacket(conn, data as PhysicsServerUpdatePacket)
        } catch (e) {
            console.error(`Error applying packet!`, e)
        }
    }

    private processPacket(_conn: NetConnection, data: PhysicsServerUpdatePacket) {
        const msPing = Date.now() - data.sendAt
        for (const username in this.clients) {
            const client = this.clients[username]
            client.lastPingMs = msPing
        }

        for (const mapName in data.mapPackets) {
            const stateUpdatePacket = data.mapPackets[mapName]

            const map = multi.server.maps[mapName]
            if (!map?.ready) continue

            const prevId = instanceinator.id
            const inst = map.inst

            assert(inst)
            inst.apply()
            try {
                applyStateUpdatePacket(stateUpdatePacket, data.tick, map.noStateAppliedYet)
            } catch (e) {
                this.onInstanceUpdateError(inst, e, true)
            }
            map.noStateAppliedYet = false
            instanceinator.instances[prevId].apply()
        }
    }

    async loadMap(name: string) {
        await super.loadMap(name)
        ;(this.notifyReadyMaps ??= []).push(name)
    }

    async leaveClient(client: Client) {
        await super.leaveClient(client)
        if (!this.destroyed && Object.keys(this.clients).length == 0) {
            await multi.destroyAndStartLoop()
        }
    }

    async destroy() {
        await this.netManager.destroy?.()
        await super.destroy()
    }
}

prestart(() => {
    ig.EventManager.inject({
        update() {
            // TEMP fix todo
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            this.clear()
        },
    })

    dummy.DummyPlayer.inject({
        setAction(action, keepState, noStateReset) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(action, keepState, noStateReset)
            /* TODO: figure this out when event stuff */
            console.log('blocking player action', action)
        },
    })

    ig.Game.inject({
        spawnEntity(entity, x, y, z, settings, showAppearEffects) {
            if (multi.server instanceof RemoteServer && !ig.settingState && ig.ccmap?.ready) {
                const isOk =
                    typeof entity === 'function'
                        ? entity == ig.ENTITY.CopyParticle ||
                          entity == ig.ENTITY.Particle ||
                          entity == ig.ENTITY.OffsetParticle
                        : false
                if (!isOk) {
                    console.groupCollapsed('local entity spawn!', findClassName(entity))
                    console.warn(settings)
                    console.trace()
                    console.groupEnd()
                }
            }
            return this.parent(entity, x, y, z, settings, showAppearEffects)
        },
    })
}, 3)

export async function tryJoinRemote(
    serverInfo: NetServerInfoRemote,
    joinData: ClientJoinData
): Promise<ClientJoinAckData> {
    {
        const server = multi.server
        assert(!server)
    }
    assert(serverInfo.details)

    const server = new RemoteServer({
        displayServerInstance: Opts.serverDisplayServerInstance,
        displayMaps: Opts.serverDisplayMaps,
        displayClientInstances: Opts.serverDisplayClientInstances,
        displayRemoteClientInstances: Opts.serverDisplayRemoteClientInstances,

        globalTps: serverInfo.details.globalTps,
        forceConsistentTickTimes: serverInfo.details.forceConsistentTickTimes,
        connection: serverInfo.connection,
    })
    multi.setServer(server)
    await server.start()
    server.masterUsername = joinData.username

    const { ackData } = await server.tryJoinClient(joinData, false)
    if (ackData.status != 'ok') {
        await multi.destroyAndStartLoop()
    }
    return ackData
}
