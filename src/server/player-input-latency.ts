import { prestart } from '../loading-stages'
import type { GlobalStateHandler, GlobalStateKey } from '../state/global-state-handlers'
import type { u24 } from 'ts-binarifier/src/type-aliases'
import { StateMemory } from '../state/state-util'
import type { Client } from '../client/client'
import type { RemoteServerUpdatePacket } from './remote/remote-server-sender'
import { assertRemote, isRemote } from './remote/remote-server-types'
import { assertPhysics, isPhysics } from './physics/physics-server-types'
import { assert } from '../misc/assert'

export type InputSequenceNumber = u24

export interface PlayerInputLatencyEntry {
    username?: string
    inputAt?: number
    applyAt?: number
    updateAt?: number
    drawAt?: number
    drawFinishedAt?: number
}
export interface RemotePlayerInputLatencyEntry extends PlayerInputLatencyEntry {
    sentAt?: number
    physicsSentAt?: number
    physicsServerEntry?: PlayerInputLatencyEntry
    receivedAt?: number
}

const playerInputLatencyData = new WeakMap<Client, Record<number, Partial<RemotePlayerInputLatencyEntry>>>()

function getPlayerInputLatencyEntry(client: Client, seq: InputSequenceNumber) {
    let rec = playerInputLatencyData.get(client)
    if (!rec) {
        rec = {}
        playerInputLatencyData.set(client, rec)
    }
    const entry = (rec[seq] ??= { username: client.username })
    return entry
}

function printFinalStats(client: Client, seq: InputSequenceNumber) {
    const entry = getPlayerInputLatencyEntry(client, seq) as Required<RemotePlayerInputLatencyEntry>
    if (entry.updateAt === undefined) return

    const { action } = seqToInputInfoMap[seq]

    let sum = 0
    function prettyDiff(a: number, b: number, includeInSum = true): number {
        const diff = b - a
        if (includeInSum) sum += diff
        return diff.round(1)
    }

    if (isPhysics(multi.server)) {
        // prettier-ignore
        console.log('player input latency', action, 'total:', prettyDiff(entry.inputAt, entry.drawFinishedAt, false), 'ms', '\n',
                'input -> apply', prettyDiff(entry.inputAt, entry.applyAt), 'ms', '\n',
                'apply -> update', prettyDiff(entry.applyAt, entry.updateAt), 'ms', '\n',
                'update -> drawAt', prettyDiff(entry.updateAt, entry.drawAt), 'ms', '\n',
                'drawAt -> drawFinished', prettyDiff(entry.drawAt, entry.drawFinishedAt), 'ms'
        )
    } else {
        const serverEntry = entry.physicsServerEntry as Required<PlayerInputLatencyEntry>
        // prettier-ignore
        console.log('player input latency', action, 'total:', prettyDiff(entry.inputAt, entry.drawFinishedAt, false), 'ms', '\n',
                'input -> apply', prettyDiff(entry.inputAt, entry.applyAt), 'ms', '\n',
                'apply -> sent', prettyDiff(entry.applyAt, entry.sentAt), 'ms', '\n', 
                '\n',
                'sent -> physics input', prettyDiff(entry.sentAt, serverEntry.inputAt!), 'ms', '\n',
                'physics input -> physics apply', prettyDiff(serverEntry.inputAt, serverEntry.applyAt!), 'ms', '\n',
                'physics apply -> physics update', prettyDiff(serverEntry.applyAt, serverEntry.updateAt), 'ms', '\n',
                'physics update -> physics sent', prettyDiff(serverEntry.updateAt, entry.physicsSentAt), 'ms', '\n', 
                'physics sent -> received', prettyDiff(entry.physicsSentAt, entry.receivedAt), 'ms', '\n', 
                '\n',
                'received -> update', prettyDiff(entry.receivedAt, entry.updateAt), 'ms', '\n',
                'update -> drawAt', prettyDiff(entry.updateAt, entry.drawAt), 'ms', '\n',
                'drawAt -> drawFinished', prettyDiff(entry.drawAt, entry.drawFinishedAt), 'ms'
        )
    }
    assert(entry.drawFinishedAt - entry.inputAt == sum, 'player input latency stats not summed correctly!')
}
function offsetPhysicsServerEntry(entry: Required<PlayerInputLatencyEntry>, clockOffset: number) {
    for (const [k, v] of Object.entries(entry).filter(([_k, v]) => typeof v === 'number') as [
        keyof Omit<PlayerInputLatencyEntry, 'username'>,
        number,
    ][]) {
        entry[k] = v - clockOffset
    }
}

export function addPlayerInputLatencyTime<T extends keyof RemotePlayerInputLatencyEntry>(
    client: Client,
    seq: InputSequenceNumber,
    key: keyof RemotePlayerInputLatencyEntry,
    value: NonNullable<RemotePlayerInputLatencyEntry[T]>
) {
    const entry = getPlayerInputLatencyEntry(client, seq)
    // @ts-expect-error
    entry[key] = value

    if (key == 'physicsServerEntry') {
        assertRemote(multi.server)
        assert(multi.server.netManager.conn)
        const offset = multi.server.netManager.conn?.wrapper.heartbeat.clockOffset ?? 0
        offsetPhysicsServerEntry(value as Required<PlayerInputLatencyEntry>, offset)
    }

    // console.log(client.username, sequenceNumber, key, value)

    if (key == 'drawFinishedAt') {
        const diff = entry.drawFinishedAt! - entry.inputAt!
        // label name used in other places
        multi.perf.addTimePoint('player input latency', client.username, diff)

        printFinalStats(client, seq)
    }

    return entry
}

interface InputSequenceNumberEntry {
    stage: 'notYetSent' | 'awaitingServerResponse' | 'ready'
}

declare global {
    namespace ig {
        interface Input {
            inputSequenceNumbers: Record<InputSequenceNumber, InputSequenceNumberEntry>
        }
    }
}

const seqToInputInfoMap: Record<InputSequenceNumber, { action?: string }> = {}

function pushSeq(
    input: ig.Input,
    seq: InputSequenceNumber,
    entry: InputSequenceNumberEntry,
    key?: ig.Input.KnownAction
) {
    input.inputSequenceNumbers[seq] = entry
    seqToInputInfoMap[seq] = { action: key }
}

/* physics clients and remote clients on remote inputAt and applyAt */
prestart(() => {
    if (!PROFILE) return

    let inputSequenceNumberCounter = 1

    dummy.input.Clone.Input.inject({
        init(realInput, block) {
            this.parent(realInput, block)

            this.inputSequenceNumbers = realInput.inputSequenceNumbers = []
            realInput.actions = new Proxy(realInput.actions, {
                set(target, key: ig.Input.KnownAction, newValue, receiver) {
                    if (
                        newValue &&
                        target[key] !== newValue &&
                        ig.client?.dummy &&
                        (!isPhysics(multi.server) || !ig.client.settings.remote)
                    ) {
                        const now = performance.now()

                        const seq = inputSequenceNumberCounter++
                        addPlayerInputLatencyTime(ig.client, seq, 'inputAt', now)
                        addPlayerInputLatencyTime(ig.client, seq, 'applyAt', now)

                        pushSeq(realInput, seq, { stage: isRemote(multi.server) ? 'notYetSent' : 'ready' }, key)
                    }
                    return Reflect.set(target, key, newValue, receiver)
                },
            })
        },
    })
})

/* remote clients on physics inputAt and applyAt */
prestart(() => {
    if (!PROFILE || !PHYSICS) return

    dummy.input.Puppet.Input.inject({
        pushInput(inputData) {
            if (inputData?.sequenceNumbers !== undefined) {
                const now = performance.now()
                assert(ig.client)
                assertPhysics(multi.server)

                for (const seq of inputData.sequenceNumbers) {
                    addPlayerInputLatencyTime(ig.client, seq, 'inputAt', now)
                }
            }

            this.parent(inputData)
        },
        popInput() {
            const inputData = this.inputQueue[0]
            if (inputData?.sequenceNumbers !== undefined) {
                const now = performance.now()
                assert(ig.client)

                const input = ig.client.inputManager.input
                for (const seq of inputData.sequenceNumbers) {
                    pushSeq(input, seq, { stage: 'ready' })
                    addPlayerInputLatencyTime(ig.client, seq, 'applyAt', now)
                }
            }

            this.parent()
        },
    })
})

/* remote sentAt */
export function playerInputProfilingOnRemotePacketSent(packet: RemoteServerUpdatePacket) {
    const now = performance.now()
    for (const username in packet.clients ?? {}) {
        const client = multi.server.clients.get(username)
        const input = client?.inputManager?.input
        if (!input) continue
        for (const [seq, entry] of Object.entries(input.inputSequenceNumbers)) {
            if (entry.stage != 'notYetSent') continue
            addPlayerInputLatencyTime(client, Number(seq), 'sentAt', now)
            entry.stage = 'awaitingServerResponse'
        }
    }
}

/* updateAt */
prestart(() => {
    if (!PROFILE) return

    dummy.DummyPlayer.inject({
        update() {
            const client = this.getClient(true)
            if (client) {
                const now = performance.now()
                for (const [seq, entry] of Object.entries(client.inputManager.input.inputSequenceNumbers)) {
                    if (entry.stage != 'ready') continue
                    addPlayerInputLatencyTime(client, Number(seq), 'updateAt', now)
                }
            }
            this.parent()
        },
    })
})

/* drawAt and drawFinishedAt */
prestart(() => {
    if (!PROFILE) return

    ig.Game.inject({
        draw() {
            const input = ig.client?.inputManager.input
            if (!ig.client || !input) return this.parent()

            const drawStart = performance.now()
            this.parent()
            const drawEnd = performance.now()

            for (const [seq, entry] of Object.entries(input.inputSequenceNumbers)) {
                if (entry.stage != 'ready') continue
                addPlayerInputLatencyTime(ig.client, Number(seq), 'drawAt', drawStart)
                addPlayerInputLatencyTime(ig.client, Number(seq), 'drawFinishedAt', drawEnd)
            }

            for (const [seq, e] of Object.entries(input.inputSequenceNumbers)) {
                if (e.stage == 'ready') delete input.inputSequenceNumbers[Number(seq)]
            }
        },
    })
})

/* das */
declare global {
    interface GlobalStateUpdatePacket {
        playerInputLatency?: Record<InputSequenceNumber, PlayerInputLatencyEntry>
    }
}

const playerInputLatencyStateMemory: StateMemory.MapHolder<GlobalStateKey> = {}
export const playerInputLatencyGlobalStateHandler: GlobalStateHandler = {
    get(packet, conn) {
        const memory = StateMemory.getBy(playerInputLatencyStateMemory, conn)

        const entries = conn.clients
            .flatMap(client => Object.entries(playerInputLatencyData.get(client) ?? {}))
            .filter(([_, e]) => e.inputAt && e.updateAt)

        const data = Object.fromEntries(entries)

        packet.playerInputLatency = memory.diffRecord(data)
    },
    set(packet) {
        if (!packet.playerInputLatency) return
        const now = performance.now()

        assertRemote(multi.server)
        const physicsSentAt = multi.server.netManager.conn?.wrapper.heartbeat.lastReceivedPacketServerTime ?? 0

        for (const [seqStr, physicsEntry] of Object.entries(packet.playerInputLatency)) {
            if (!physicsEntry) continue
            const username = physicsEntry.username!
            const client = multi.server.clients.get(username)
            if (!client) continue

            const seq = Number(seqStr) as InputSequenceNumber
            addPlayerInputLatencyTime(client, seq, 'physicsSentAt', physicsSentAt)
            addPlayerInputLatencyTime(client, seq, 'physicsServerEntry', physicsEntry)
            addPlayerInputLatencyTime(client, seq, 'receivedAt', now)

            const inputEntry = client.inputManager.input.inputSequenceNumbers[seq]
            assert(inputEntry)
            assert(inputEntry.stage == 'awaitingServerResponse')
            inputEntry.stage = 'ready'
        }
    },
}
