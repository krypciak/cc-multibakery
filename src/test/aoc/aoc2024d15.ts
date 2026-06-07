import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import type { CCMap } from '../../server/ccmap/ccmap'
import type { Client } from '../../client/client'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { InputData } from '../../dummy/dummy-input-puppet'
import type { TestConfig } from '../tester'
import { prestart } from '../../loading-stages'
import configs from './aoc2024d15-correct-moves.json'

import './aoc-box'

async function waitFrames(inst: InstanceinatorInstance, count: number) {
    for (let frame = 0; frame < count; frame++) {
        await scheduleTask(inst, () => {})
    }
}

async function moveDummy(e: dummy.DummyPlayer, inst: InstanceinatorInstance, dir: ig.Input.KnownAction) {
    const input = e.inputManager
    assert(input instanceof dummy.input.Puppet.InputManager)

    const emptyInput = {
        currentDevice: ig.INPUT_DEVICES.GAMEPAD,
        presses: {
            aim: false,
            left: false,
            up: false,
            right: false,
            down: false,
        },
        actions: {
            aim: false,
            left: false,
            up: false,
            right: false,
            down: false,
        },
    } satisfies Partial<InputData> as NonNullable<InputData>

    const inp: InputData = ig.copy(emptyInput)

    const moveInp = ig.copy(emptyInput)
    moveInp['actions']![dir] = true
    moveInp['presses']![dir] = true

    let dirVec!: Vec2
    if (dir == 'right') dirVec = { x: 1, y: 0 }
    else if (dir == 'left') dirVec = { x: -1, y: 0 }
    else if (dir == 'down') dirVec = { x: 0, y: 1 }
    else if (dir == 'up') dirVec = { x: 0, y: -1 }

    // await waitFrames(inst, 1)

    input.mainInputData.pushInput(moveInp)

    let collided: string = 'none'
    for (let frame = 0; collided == 'none' && frame < 11; frame++) {
        await scheduleTask(inst, () => {
            if (e.coll._collData.collided) {
                const entities = ig.game.getEntitiesInCircle(
                    {
                        x: e.getCenter().x + dirVec.x * 8,
                        y: e.getCenter().y + dirVec.y * 8,
                        z: e.coll.pos.z,
                    },
                    12,
                    1,
                    64,
                    undefined,
                    undefined,
                    undefined,
                    e
                )
                if (entities.length == 0) {
                    collided = 'wall'
                } else {
                    collided = 'box'
                }
            }
        })
    }
    input.mainInputData.pushInput(emptyInput)

    if (collided == 'box') {
        const holdTime = 20
        const pushTime = 23
        for (let frame = 0; frame < pushTime + holdTime; frame++) {
            await scheduleTask(inst, () => {
                if (frame == 0) {
                    inp.presses!['aim'] = true
                } else {
                    inp.actions!['aim'] = true
                }
                if (frame >= holdTime) {
                    inp.actions![dir] = true
                }
                input.mainInputData.pushInput(inp)
            })
        }
    }

    input.mainInputData.pushInput(emptyInput)
    // await waitFrames(inst, 8)
}

type AocConfig = (typeof configs)[number] & { expectedMoves: Record<string, Vec2 & { sum: number }> }

class Aoc2024d15Test implements TestConfig {
    id: string
    name: string
    timeout: number

    private moves: string

    moveI = -1
    sum = 0

    client!: Client
    map!: CCMap

    constructor(private config: AocConfig) {
        this.id = config.id
        this.name = config.name

        const arr: string[] = []
        for (const c of config.moves) {
            if (c == '>' || c == '<' || c == '^' || c == 'v') arr.push(c)
        }
        this.moves = arr.join('')
        this.timeout = config.moves.length * 2e3
    }

    async run() {
        await multi.test.setupServerIfNeeded()
        const { client, map } = await multi.test.createClient({ map: this.config.mapName })
        this.client = client
        this.map = map

        await multi.test.updateLoop(this.client.inst, this.update.bind(this))

        tester.expect(this.sum).toEqual(this.config.expectedSum)
    }

    private getGridPos(entity: ig.Entity): Vec2 {
        return {
            x: entity.coll.pos.x / 32 + 0.5 + (entity instanceof ig.ENTITY.AocBox && this.config.part2 ? 1 : 0),
            y: entity.coll.pos.y / 32 - 3,
        }
    }

    private calculateSum() {
        let sum = 0
        runTask(this.map.inst, () => {
            const boxes = ig.game.getEntitiesByType(ig.ENTITY.AocBox).filter(box => !box.linked || box.motherLinked)
            const positions = boxes.map(b => this.getGridPos(b))
            for (const { x, y } of positions) {
                assert(x % 1 == 0, 'misalligned box!')
                assert(y % 1 == 0, 'misalligned box!')
                sum += y * 100 + x
            }
        })
        return sum
    }

    private getCenteredPlayerPos(player: ig.Entity): Vec2 {
        const x = Math.floor(Math.max(0, player.coll.pos.x - 16) / 32) * 32 + 16 + 8
        const y = Math.floor(player.coll.pos.y / 32) * 32 + 8
        return { x, y }
    }

    private async move() {
        const move = this.moves[this.moveI]
        let dir!: ig.Input.KnownAction
        if (move == '>') dir = 'right'
        else if (move == '<') dir = 'left'
        else if (move == 'v') dir = 'down'
        else if (move == '^') dir = 'up'

        await moveDummy(this.client.dummy, this.client.inst, dir)
        await waitFrames(this.client.inst, 11)
        const { x, y } = this.getCenteredPlayerPos(this.client.dummy)
        this.client.dummy.setPos(x, y)

        if (this.config.expectedMoves) {
            const expected = this.config.expectedMoves[this.moveI]
            if (expected) {
                const posDiv = this.getGridPos(this.client.dummy)
                const pos = { x: Math.floor(posDiv.x), y: Math.floor(posDiv.y) }

                tester.expect(pos, `position mismatch on move ${this.moveI}`).toEqual({ x: expected.x, y: expected.y })

                const sum = this.calculateSum()
                tester.expect(sum, `sum mismatch on move ${this.moveI}`).toEqual(expected.sum)
            }
        }
    }

    private async update() {
        do {
            this.moveI++
        } while (this.moveI < this.moves.length && this.moves[this.moveI].trim().length == 0)

        if (this.moveI == this.moves.length) {
            this.sum = this.calculateSum()
            return true
        }

        await this.move()
    }

    cleanup() {
        if (this.client) multi.server.leaveClient(this.client)
        if (this.map) multi.server.unloadMap(this.map)
    }
}

prestart(() => {
    for (const config of configs) {
        tester.addTest(new Aoc2024d15Test(config as any))
    }
})
