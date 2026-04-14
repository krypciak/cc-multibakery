import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../../misc/assert'
import Multibakery from '../../plugin'
import { scheduleTask } from 'cc-instanceinator/src/inst-util'
import { PhysicsServer } from '../physics/physics-server'
import type { InputData } from '../../dummy/dummy-input-puppet'
import type { Client } from '../../client/client'
import type { CCMap } from '../ccmap/ccmap'
import { isPhysics } from '../physics/is-physics-server'

import './aoc-box'

async function moveDummy(e: dummy.DummyPlayer, inst: InstanceinatorInstance, dir: ig.Input.KnownAction) {
    const input = e.inputManager
    assert(input instanceof dummy.input.Puppet.InputManager)

    async function waitFrames(count: number) {
        for (let frame = 0; frame < count; frame++) {
            await scheduleTask(inst, () => {})
        }
    }
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

    await waitFrames(1)

    input.mainInputData.pushInput(moveInp)

    let collided: string = 'none'
    for (let frame = 0; collided == 'none' && frame < 10; frame++) {
        await scheduleTask(inst, () => {
            if (e.coll._collData.collided) {
                const entities = ig.game.getEntitiesInCircle(
                    {
                        x: e.coll.pos.x + dirVec.x * 4,
                        y: e.coll.pos.y + dirVec.y * 4,
                        z: e.coll.pos.z,
                    },
                    4,
                    1,
                    16
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
}

function genTest(name: string, moves: string, map: string, expected: number, part2: boolean = false) {
    if (!PHYSICS) return

    window.crossnode.registerTest<{
        moveI: number
        moveDone: boolean
        sum: number
        client: Client
        map: CCMap
    }>({
        fps: 60,
        timeoutSeconds: 400,
        skipFrameWait: true,
        flushPromises: true,

        modId: Multibakery.mod.id,
        name,

        moveI: -1,
        moveDone: true,
        sum: 0,
        client: undefined as any,
        map: undefined as any,
        async setup() {
            multi.setServer(
                new PhysicsServer({
                    tps: this.fps!,
                    displayMaps: !this.skipFrameWait,
                    displayClientInstances: !this.skipFrameWait,
                    disableMapDisplayCameraMovement: true,
                })
            )
            await multi.server.start()
        },
        async postSetup() {
            assert(isPhysics(multi.server))
            this.client = await multi.server.forceCreateClient({
                username: 'aoc',
                inputType: 'puppet',
                remote: false,
                tpInfo: { map },
            })
            this.map = multi.server.maps.get(map)!
            assert(this.map)
        },
        update() {
            if (this.moveI == moves.length) {
                if (this.sum == expected) {
                    this.finish(true)
                } else {
                    this.finish(false, `sum is equal ${this.sum}, expected ${expected}`)
                }
            } else if (this.moveDone) {
                do {
                    this.moveI++
                } while (this.moveI < moves.length && moves[this.moveI].trim().length == 0)
                if (this.moveI == moves.length) {
                    scheduleTask(this.map.inst, () => {
                        const boxes = ig.game
                            .getEntitiesByType(ig.ENTITY.AocBox)
                            .filter(box => !box.linked || box.motherLinked)
                        const positions = boxes.map(b => ({
                            x: b.coll.pos.x / 32 + 0.5 + (part2 ? 1 : 0),
                            y: b.coll.pos.y / 32 - 3,
                        }))
                        for (const { x, y } of positions) {
                            assert(x % 1 == 0, 'misalligned box!')
                            assert(y % 1 == 0, 'misalligned box!')
                            this.sum += y * 100 + x
                        }
                    })
                } else {
                    this.moveDone = false
                    const move = moves[this.moveI]
                    let dir!: ig.Input.KnownAction
                    if (move == '>') dir = 'right'
                    else if (move == '<') dir = 'left'
                    else if (move == 'v') dir = 'down'
                    else if (move == '^') dir = 'up'

                    moveDummy(this.client.dummy, this.client.inst, dir).then(() => {
                        this.moveDone = true
                    })
                }
            }
        },
        cleanup() {
            multi.destroy()
        },
    })
}

if (window.crossnode) {
    genTest(`aoc2024d15 p1 easy :)`, `<^^>>>vv<v>>v<<`, 'multibakery/test/aoc8x8-1', 2028)

    //     genTest(
    //         `aoc2024d15 p2 medium`,
    //         `
    // <vv>^<v^>v>^vv^v>v<>v^v<v<^vv<<<^><<><>>v<vvv<>^v^>^<<<><<v<<<v^vv^v>^
    // vvv<<^>^v^^><<>>><>^<<><^vv^^<>vvv<>><^^v>^>vv<>v<<<<v<^v>^<^^>>>^<v<v
    // ><>vv>v^v^<>><>>>><^^>vv>v<^^^>>v^v^<^^>v^^>v^<^v>v<>>v^v^<v>v^^<^^vv<
    // <<v<^>>^^^^>>>v^<>vvv^><v<<<>^^^vv^<vvv>^>v<^^^^v<>^>vvvv><>>v^<<^^^^^
    // ^><^><>>><>^^<<^^v>>><^<v>^<vv>>v>>>^v><>^v><<<<v>>v<v<v>vvv>^<><<>^><
    // ^>><>^v<><^vvv<^^<><v<<<<<><^v<<<><<<^^<v<^^^><^>>^<v^><<<^>>^v<v^v<v^
    // >^>>^v>vv>^<<^v<>><<><<v<<v><>v<^vv<<<>^^v^>^^>>><<^v>>v^v><^^>>^<>vv^
    // <><^^>^^^<><vvvvv^v<v<<>^v<v>v<<^><<><<><<<^^<<<^<<>><<><^^^>^^<>^>v<>
    // ^^>vv<^v^v<vv>^<><v<^v>^^^>>>^^vvv^>vvv<>>>^<^>>>>>^<<^v>^vvv<>^<><<v>
    // v^^>>><<^^<>>^v^<v^vv<>v^<<>^<^v^v><^<<<><<^<v><v<>vv>>v><v^<vv<>v^<<^`,
    //         'multibakery/test/aoc20x10-2',
    //         9021,
    //         true
    //     )

    //     genTest(
    //         `aoc2024d15 p1 ...what`,
    //         `
    // <><v>^vv<^<v<>^>^^<^^>>^>><vv^>^>^<v<>>^^>>v^>^<v><v><v>>^<^<<^^>^>^<<v^<<^^v><<><v>v^>^^<v<<<>v<>^>^^^><v<><v^<><vv^v>^>^>><^<vv<^>^<^<<<<<^<^vv><v>^v^^><<>>v<v>vvv^<>v<>v><<<v^<^<^vv<^v<>v<<<<<>v<^<<<^<^v^<^>^>>vv>>^^<>^^<^v<^v<<vv<vvv^<^^<>v^^><^^^v^>^>^^<<<^<v<^<><v^<^v^<>>v><^^v^vv><vv>^v>>^vv>v><v<>>>^>>^v>v^^<vv^<v>vv<^<>^>>^v^v><^v^>>^>^<<<<<><v<v<vvv><><^^v^^^<>v<>vv>v^>>>^<>>^^^><v<^<>v<^>^<vvv^>^>vvv>>v<>v<>v<><><<^vv>^<^<<>^^<v<^^>v^v<v<>>^^><>^>>>^v^<>^^^<>><v><>v><>v>^<>vvv>>><><v<><>v^vv^>v^^>>v<^<^<v^>>>^^>>v<<<v^vvvv>^^v>^v<^>^vv^v^v<^^>v>^vv<<v^^^v^<v<^v^<v><v>^^v<^^><^^<^vvv<v<<><>v^<>><<<^vv<^^<<>^^<^<^>^<><v><^>v>><><v^vv<<>>^^>vvv^><<^v<<^>^<^<<><^<>^<>vv>><v>^^<v<v>v^v^^<<>^>>^^v>>v>^^>^<><^>v<vvv>^>v<><vv<><^v>>^<^^<<<<<>^vv<<<v>^<><^<v>v^<v<v<v^<v^<>^v<vv^vv>v^^>v^>^^<v^<<v>^^v>v><<<<<^vv><v>>v><^^^v<^^vvv^^>^^^>vv<>v^<>><><<><^>^^^v^<v>>>v<>vv>vvvv^>>v<<<^vv>>>^v^v><<^vvv^<<>v<><^v><>^v>>v>^^<<>v^vvv><^^<>>^<<<<>>^>>v^^<>>>>vv>v<v^>^<^v>v>>^^>v^^v<^vv><^<^^<vv
    // <<^<><v<^vvv<<vv<vv<><v^v><>><<v^<>^>>^>>^^^<^^v<vvv^v>v<>^>><^v>^^vvv^<>>>v>>vvv><^^v>vvv<vv<><v>>vv^^<>^^<^>v^<v>vv^<><v<^<>^vv>^^><>^>^v^<vvv><>^>><^<^>v>v>><v<<vv^^^>^v^vvv>>vv^^<^^<>>v<<vvv^<^<^>>v>>v<<v^<^v><v^><^>v^<v<vvvvv>>>^^v><<^^>v><<<^^<<<^><^<<^v<>^<>v<<<v>v<v<<<^v^^^<v<^^^<^<vv<>>^<^<>v^>>v^v><^vvv>^>>v><<^<<v>v>v>^v<v^<v^^v>^>>^<v^v<>^v><<>>>>>^>^<v<v>>^^v<><><<v>vv><^<>><v>>>v^v<>^><v^v^><<v<^^<vvv<v>^>vvv<>^>>v>^v<^^^v>v>v<>>^<><^<^<<v^<^>vv^v^>v^^^^^v^v><>v<><<<v^vv^>v<v<><>>^^<^<v<>^><>v^^>^^><>v>v^^>v<>>^>^^<v<^^^<<^^>^^>vv<^<^><>^^^v^^^>>^>>v<<^v^^v^<^^^v<^^>>^>^<v<>>^^>><vvv>v<v<>^<vv<v^v>^<v>v>v<>v<v<<<><<<^>>>^>^v>vv>>v^vv^<vv>><<>>v^>^^>>^v>^^v^v^<^<v><><v>v><^^^>^><v>vv<><<^^^<v<^^vv<><v<v>vv^^><><^v^<^v>v<<v>>v<vvv<<^<<v<vvv>>vv<<^<vv><>>v><vv<<>v<vv^><><^v<^<><<>>v<>v^v^<v<><v>^>v>v^vv>v<<v^>>><<<v<^v<v^^v^^>v^v>vvv>v<^v<^<<^>v>><<<v<>>vv>v><vvvvv>vv>v^<^^^<v<v^v<<v^v<^^>>v<vvv<>v>>^<v>^<v^<>^^>>^>vv^<>v^v^<vv^<>>v^^^v^^^^>^v><v<>^>v<v><>>><><^v><^^v<>v^v^>
    // vv^^>v^^v<v<vvv<v<<v^>vv<>>>^v^>v>^><>v^><><v^^<^>v><vv>>><v<>v<<<^v<<>^^<vvvv^^>v>v<^>v^^<<vv^v>v^><><><<vvv>v>vv^<<<vv^<v<^>v^<^>vv<>>>vv>^^^^>vv>v^^v<>^^^>v><>>v<>v>>v<^<<>^>><^v<<^<^>><>vv>^><>^^^^^^>^<^<v<<^<<v<v^v>^vvv^<>^v^>><<<^^>^^<v>v^v<^>>><^^<v^<vv><<vvv<<^>v^^>v>v<v^v>v<^v>>v^>^<<v><v>^>^<v<><^>><>>^><^<<^v><^<<>v>><>v<<v<><^v>><^<vv>>v^<><>>^^<<v>>>v^>^v>v>^<v<>><v>^<v<v^^^>^>^vv^<vv<<<>><>><^<v<<<v>>v>^>^>v<><><^v<>><>vvv>^><<^^^<vv<vv><>vv>v^>vv>v><><<^vv>^vvvv<<<<v<v^<>>v>v><v^><v<<v>>^v^^v>^v<<v^^>v>><v<<v<^v<v^^<<<v^^<<v^>^^^^^^<><^>v^><><v^<^^<>>v^<v^v^^^<v^>^^v>v<>^><v>^^><^>^>v>>^<>vv<v<^^v<^^>v^^<>^<^>>>^<^v<vvvv>^<v^>v<<^^^<v<>^v<<<>>^<<^vv>>vvv>v<<>><>^^><vv><<<^v>>><<<vv<v><<v>^v^vv<v>^>>v<<v>v>>><v>><^^v^v^v<<>^>v^>><v^>>v><<vvv^<^vv^v>>^^>v^v<<<>^>v^^v<<vv>v^>v<<^^<<>>v<<v<v^>>^><>^vv^><^>v<<v><<<v<^vvv^v^^v^>><v>vv<>^>v^<<v><><v<^v>v>vv^^v^^<<>>^<v><>v^>>>v<^<vvv<<v<>v>v<v>vvvv>^v>v>^^>v>^><v<^>v><<>><v^vvv<^^v>v^^^^>^<v<>>^>v^<^<>^^>>><v^v>>^><^v^vv>^<v>v<
    // v<^^vv><>><<^v^<^v^>^^<^>vv<<^vvvvvv^<><<vv>^<^v>>>><^v<<^<>><>><>>>><<^>>v>>^>^^>^><^<<v^v>v^v>^<^v^<>vv^v>><>vv>><>^<<v><v^v>v>>^^^<<^v><v<v^^>>^vv^>^^>^^v^<<<^>^>^><>v<<<v^>^^^>v<>^<v^v<>>><<<v<>^>v<^^<>^^v<^v>>^>><v<v>>^><^v<^<><>v>v>>>^<<><^^^<<<vvv<^>>^><^><v^<v<v><^v^v<<<><v<vv><<^v<v<<v^^<^<^^^>v^^>v><>^v^><^>>>v>><^v^v>v^<<>v^v<<^<<vv^^<v^^v<>^>^>^<>v>^v<>v>>v>vv^vv>^><><v<^<><<<>>><<>^>^<v<>>>^^<>>^>v^><^vv><^<^>>v>vv<^<v<><^v<^>>><^v<^><v><v^v^<<^><^<><^^<^v^^v>vv^^<v<<>^>>^^v^^<vv<<^vv<vv^<>vv>^>^<v^><><<><<><^v>^^v^><<<v<^<vvv>^><<>>><<v><>vv^^>>^^><<v><^<v>vv^^<^<^^^>^<v<>^v^>v^^v^<>v^<v^v<v><^>v^^><<<>^^^<<v^v<<<<>>v<v^^v^vv^vv^v>v>>^>>^vv^v^<<^vv^<v^v^<>^<^<v>v^<<v<<>^^>><v^>v^^>v^>>>v><<>><v^^^<><><v<<v<<^v>v^>><v<>^vv>^><v<^v>^<>v<<><>>v^v^>^>v>><^<^^><v><^>vv>v<vv^><^^v>^^>v^v<>v<v^^^<<><v>^^vv>v<^>vv^^v^v>>^vv^<><^<^<<<v<>><>>^>^^^^><^v<<<>v^<^^vv><^v>v^vvv><>v>^<<^^^v^^<>>v<^^v<^^^>>^vv<v^^<vvv<^<<^>v^<>^^^<^v^^<v>^><^>^^^v^^>^<>>^v^>vv<v>^<vv^^><^v^^^>v<^v<<>v<^<v
    // <^><vv^v^>>^<>>>v><^vv<v^<^vv<<>v^>v<v^^^^>vv^><<v>^^^v<v^<<v<v><^^v>^<v<<^>^^^>v>v<^^>v^v><<vvv^^^>vv^v>^<vvv<vv><<>>>v>v<vv<><<><^v>vv><<^^^vv<><^<<^>^><<>^<v>^>^v<<>>v^<^vvv<v^>>v<<^>^>v<<<^v<><><^^<>^<^<v><<vv<>>^<v^^><^^v<<><vv><^>^^>v^vv^^<>^vv>v^>v>^v>v>^>^>^>><>v<^v>><^<>^v<>vv<^v<^v^<>^<>^<^^v><v^<vv>v<^>>v>>v^v^<^vvv>><v<vvv><<^^<^v<^<vvvvvv<v^^^>^^vv^^v>>>>>^^>v^>^><^><>>^<>v^>v<<<^v><v<v^^vv^<^^v>^v^<vvvv^^<^<^<<<v^v^^<v<<v><^<v><vv<^^>v<vv<^<^v<^>^^^vv^<>^<v>^v^<><>><v>v^<<><^^^>>vv<v^^<v>>^<<>v<vv>^<<v<^<<vv^^<v<vvv>^vv<v^><vv<><v>>^^>v>^<>>^^<v<v<v^<vv>><<^><v<v^<<vv^^^<v><<^<v<<<v>^<vv^><<<^^v<^>vv<>>^>^v^<v>^^v>>v^>>v>vv><<v<<v>v^vv^>vvv^^v<>^>^v><vv>^><v>v^>^v^^><>v<^<v>^<<^vv>^v<<><vv>v^>vv<>>^>>>><<^v<v>^<><v<<<<>>^v>v><^v^^>^<<<v<v^^v^<>v><^>^>^^^v><<<^>v><^><<^vvv<vv^v>v^><<><^>^<<vv^>v><>v>v<>v<vv<>v<<^v>^>^v>^^v<>v>v<<v^v>>>vv>>v>>><^^^v^>>vvv^^vv><^v^<vv^><<^v<vvv<^^v<<vv<<v<><vvv<><<>v<v>^><<>><v<v<>^<v<>vv<<><<v^>^^^^^><<><^v^v<^>v<^^^><<<^<^v><^v<>^>>v^v^<^^
    // >vvv^<<>vv>vv<^^vvv>vvvv^<^>v^<vv^^v>^v<<^<<v<<vv>^v^v<<><v<><<>>><><v><<>v<<>>v<<<^>><v<v<>>>>vv>>>>^v<>^><v>>^><v<>^v^v<>^v<^v>^v^^v^^v<><^v<<>^<>><v><^<^<<<><^v^vv<<<<>>>^vv<<><<v^^vv<>vv^>v<^v^>vv<>vv<<v^<>^<<<>^><v<vv><>^v>vv^><<^^<v<<v><>^>>v><>^>vv^^>>^^<^>^^<^vv^^<>><v<<^><<v^^^<v^v<<>>>>^v^<v^>>^><<v^<v^^>>v<<<v>>>^<v^^>v^v<>^>>>>>^^^>v>v>>vv<v^^>>^v>v^^vv<<vvv<<>^^v<<>>>^<><<<>v<>>^v^><<>^>v<>^^^>v>vv<vv>^<^^v<^^>v<^^^^<<<v>><<vv<v>v^>>><v^v>v^^^v<<<v^><>><^<^<^>><>^^v>v>v>>v<>>>v^^><^v<^>><v><v^<^<^>^^^>>>v^<>^>^v^v<vvv<^^^<>><<v<<>><^v>v^v<>>vvv<vv<<><v<>^<<^vv<^vv><>v<^v><^<>>>^<v<vvv<^vv<^vv><^v^><<<v^^<<^v^v>^>v^^^^v<>^^^<<><<vv<<^>vvvv^vv>^<vv<^^<^>^<^^^>v>v^<<>^>^<<v><>^v^^^><<><>v><<<><>v^>v>^<<<>v^>^<<^vv>>>^vvv<>>vv<vvv^<v<>>>v^vvv^v>^>>v<v^>><v^<^<^<^v<vv>v>^><><><^v>>v<^^^v>^vvv^^>>^<^<^^><<>^^<v<<^>^>^>v><>v<<v><<>><^v<>v>^<>^v^>v>^<>^>^>v^<v^><<>><<>v<^v>^<<<<<<v><<>><>><>><^v^^^vv<v^v<vv>v>vv<v^^^v^><v^^v<>v><<>v>>><<v><^<><>^v<v<><<<><>>^<v^<v<v<v^v<v<><v^<>vv
    // <<<v^>v>>^>v>v<v<>^^><<^^><^^vvv>>>^>^><<^^<v<><v<<>^^^^vv<^<v^><<v>>><<<<<<<vv<<><v<<<>v<v<<^vv^<v>^^^^^^><^vvv<>v^>^^vv<vv><^>><v<>><>^<<vv^^<>^>^><v><v>v<^v<v<^^^^><^<^^><^v^^<vv^<><<^>^v<v^^v^^<>><<v<^^^<>vv<^^vv^><v><<v^v>>vv^><v<^^^v<<v<<<>vv>>><v<vv>^<^<v<v<>^>v><^>v>v<^<>v^^>>^^<>^<^<v>><<^<<^^^v<v<^<^<<v<v>>^<>><^v^v^<>vv>><v^^><v>><^<^>>^^<<v^<<<>v<^<v^v<v><<^v<vv<v<<>^v^v<<><v^><>><^v^vv^>>v^^v^^^<v><<<v>>^v^><^<v<<>>>^v>^^v<><vv<^^<>^^<<v<<v<<v^^^<^v^<<>vv><<<vv^^<^^vv<^v>^<v>^^^vv^<>v<<>^vv<<vv^^<>v<><^^<vv<<v^<<^<^vv>><^>><>><v^<<v><>^<<^vvv^>v^^>v>v^^^^^^^^v^^^v^<^^^v^^vv^>>v>v^^<v><><<^>v>><^>^v^><^^v>v^vv<v^>^>^<<^^^vvvv<<>><>v<>vv<vvv<<v^^v^^vv><<>^<^>^^^^^vv>^><^^^<<><>^^v^>^^>>v^^^<^<><>^<<>>v^<v<^v<>>>^<vv>^v^>^<<>^v<<v><^v^>><>^<><<v<>><v<>^>^vvv^^>v^>>v>>^>vvvvvv>>v>^vvvv>>^^^<<v>^^^<vvv<<v<v^v^^v<><<<v^v<><<vv<<<<vvv^^^<^>v^v^v^^>^v>^<>^v>>><^vv>vv<^^^vv<>^<><><>vv^v>v>v>>>^v^<^<>^<v<v<v><^<<>^^<^<>^v>>^v^>v^>v^>v<v^>^<>v^<^<^<vvv<v<vv^v<<>>^<^v<^^^<<<^>^^>^<<v>
    // ^v<v^<^^>>^v><v<><^<><><>v^<>^><>v<<vvv<><>v<><<^^vv>>^^^><^^<>^>><<^^>v><v><^>^>^>><>v^<><><^^^v<^<v^<>v>vv>v>^<><<><^^<^^v<><^<<v^<<^>^^>>>^>>^^^^<^v><><<<^^<^v>v^<^v^><v>^^^><^>^vvv>^v<>v<v><<<^v>^<v<<>^^^<^>^^^<^<v<<>>>>v^>^v^>v^v<v<<^<^^<v^^>v<><^<><^>v^v><<v<v>^vv<^vv><v<v<^><>^v^<<^>vv<^^v<^vv<>>v>>^<>^>>^>>>>^v^<>><v^>vv^^>^v^>^<<<v>^><<>>>><<>^v<<>>>>>^>^^^>>><^>>v^vv^^v><vv>^v^vv^vvv^>^>v>v^vv>^v^^<vvv>vv>><<<<^<<<><>v^v^^^<>^v^<>><<^^^<>vv<<<v>v<<<^>><>^<><v<v>v<v<vv^vv<v^vv^^<<<<vv<>vv^vv<v<<v<v><><>^^><^>^<><^v^>>^<^>>>vv^><<><<^>><v<<v^v<>^v^^v^<><v>^v^^vvv<<v^v<<^^^^^<vvv<><^<>^v<<>><v^v^>>>v^^<^>v<><vv><<<<^<v<v<<<^>v<<<v^v<<^v>^^><<<v>vv<<>v<>v^v<^<>^>>><^v><>^^v><<>vv^v<^v><vvv<<vv<><^>>>v<v><<^^<v>^vv^^>^v<<^<>v^v<v><<>^vv><<<vv^v<>^<v^v<^v>^<<<>^>^vv^><>v^<>v<>>>^vv<vv^<^v^<v><>>v><vv<v>><^v^^^^>>v^>^>v^^<<^^v>vvvvv<>^vv^<^<>^<>v>>vv>v>v<>^><>v^^^vv^>v^<>^vvv<>>>v<<vv<<v>>v>><<^vvv^>v^<<v<v<<>^<><^v<<^>>>v^<^>v<<<<v>^^^^^v><>v>vv<>>^<v^^^v<>v<<>v^<>>v><^^^v^^^>^^>v>
    // <>^^<<vvvvv^>vv>>>^<>^v^vv<v^<^v>^^><^>><<^^vv>v<v><v^<^<^>><><<<>v^v>vv<v^v^v>><><v>>^<v^<><v<^^^v<v<<v<<^>^v<^^>^^^vv^><>>^<<<<v<^^<v^<<^^<v>>v^^vvvv^vv>v>>vv<^^>v^vv<>v<v<v<^<v>v^>v^>>^<v><<<<<^^<>>^v^<<v^><v><>vv<v>^^<^<><v<^v<^^vv^<><v>^<<^<>^^^^^>^vv>v>^>>vv>v<>v^^<><^^>^>><>^^v>v><v<^<<<^v<>^>^v^^v>v>>^>^vv><^>^>^<><^^v><v<^>v>vv^v>^v^>^>^v<v>>v>>v^<<v^>v^>v^>>v<^<<<><>^vv<>>v<^^^>v><<<><<<vvv<v<>v<^vv^v<v><^^vvv>^^vv^<>>v>^vv^^<^<>><<>v^v^^^^^<v>v^^<<^^<^v>>>^>^^^^v>^^v><^v^>^v>^^^<>^<<^v^v>v><^^v>^vvv<<>>^v^^>^>^v<v^>>>^v><v<>vv^v>v>v^v<^v>vv>>^>v^<^^^^>^<^>v^^>>^<>^^><v>vv<^>^^<^><<>>^>^v>>v>^<^v<<vvvv^vv<>>v<><^v^v>^v^^v^v<v><<^^v><^>^>^v<vv^^^^<^^v^v<v>^><<<v><<<>^v^>v>vv<^<><^^<>^<>>vv<v<<>^><^^^^v>v<>>v<<>vv^>^vv><<vvv><>v><^v^><vvv>vv<v^<>>^v^^<<<<>>><v<>>^^><^><v<^^<<<<^^^>vv^>^v<<v<vvvv<>^^v>^>v^^><<^<^v><v>^^^>v^<>>^>vv>><^^><^^^>^>><^<>>>>vv><><^<>>v<>v>^v^>^>^><v^^>v>>>^v^vv>v>><>v^^^>><v><>v<>v^^^vv<<vv<vv><><<^<<<>vv<vv>v>^^<v>>v^>>v><<v>^^<><>^>v^<>^vvv>^<^v<<vv<
    // v><^^>v>v>^<^<^<<v^<<v><^^<<<^^>><<<^>^^vv<^>vvv<>^^^<<>^vv^v>^^v>^v^^v^<>^vvvv^>vvv>^^<<v>v>^>vvv>><<<v>>v^><>>^<<v^<^^v>><<^^^^><v^<<^^>^^v>^vv^>vvv>v^v^vv^>>^<^<>>v<v^v><<^^^><^^vv^v>v>^>v<v>^><>^<>^>^>vvv>>^<^>^vv>^^<>^^>^><^>^<v<>>^vvv<vv^v>>><<<v^>^v^><^v^<v>vv<<<><<<vv^^vv>>v<v<>v<><^^vv<>>>^v^^<^<<>^<<^<vv^<v>>>v^<>^>>vv>>>^^v^v<vv<^v>v<<^v<^<v^v>v<v>^^><>v^v><<<<v<>>>v^vv<^>>^><v>^v>^<vv<<^>^>v^^<^^^^vv>><v^^v^>^>><^v<^v<>v^>v<<^<v<vv<<^<>vv<>^<v<>^^vv<^^^^<^>^^v>v>v>v<vv>v>v>vv^^<^^<vvvv>v^<^>vv>>>^^^>>>><^^<^<v>v^^v>>>>>v>^>>vv<v^>vv<<<><>v>vv>^><<>>v^<vv<v^v>^v^>>^v^<>^v<^v^<v<^v><^^>v<v<>>><>><^>>^v<>>><><<v>^>^<v><^<^<<v^>v>vv>>vvvv<^>^><>v^<>^><<v^^^^^v>^>v<v^v<>>>^^vv>v>><^^<>><<v>vv<<<>><^v><v>^^<vvv^^^^^<^v>^<<v>>^^vv><<<v<>v^<<><v<>><^<>v<<^v><vv>>^^^v>v><^^<v^><^<v>vv<v^^^^^>><>^^<<>^>>v^^>v^<><>^v<^v>>v^vv<>v<<^<v^v>>^>><v<^^vv<^^<^<v<><^vvvv^>v^<<<><<v>^^^><^><v>^<<^^vv^vv>v>v<^>>>>^v<^v>^v<<^>>>^<<^<v^^v<^<v^<v>^^^vv>^<>^<^<^><vv>>>^<>^^<<<<<v^^>>>vv<^^>>>v^<vv<^
    // >>^>^^>vvv<<^^vv^<^>v>^<^<^<^>v^<v>>v>>v>^^>^<<>>vv>>^>>>>>v^<v>><v<>^<vv<>>><v<^^^v<v^<v^>^>>>v>^v^v<^v<>^^v^^^>>>^>v<^>^<<><v<<<<v>v>^<^^^<<>^<v^>>^<<<^>>^>^^>^v^^><vv^<v<v^v^<^>^<v^vv>^><^^^><^v<<>v<^<^<v>^^>v>^v><>^<>v^v^<^<v><>vv<>vvvv<<<^v>v>v^^<<vv<<<<v>>v^^^v>>v><^^^><v<<^v^v>^<<>>><^^v>>^v>><><><<vvv<^^>^vv<^^v<>^vvv><<^^<v>>>^>vvvv^^vv<^v<v<><<vv><><>>>><><v>v^><^vvv>v<<>^^^v>><vv<v<^<v^^<<>><<^<><vv<>^><>>><^v>^<>>vv>><>^>^<>v>v<v>v^^>^^^>^><>><>v<<v<<<<v<<<^v<<<<<^>^v>^v<<<>v>><<><v<<^<>v^v^^v^^<^>>^^^^v^<<<v<>^^<^>>>>^^vvv<><^v<<^^>v>v>^v><v^<^>^^^^><<>^>^v<^v^><<<>^<^v<<v>^<^^^>^^^^^<^^<v<>vv>^<^<<vv<^^>v^vvv<^<vv<^><^^>^^v<^v<><><>>v><v^<><^vvv^v^vv^^<^<^<<><^<^<>>^<<<^^>v><<v^>^v<>>>>^v<^>^^^^v>>^v<^>>v><^^^<<^<<v^>vv>v<^^vvv^v>><<>^><<^v<v><v<><vvvv^>v>>v<^>^>>^<^v^>^v^v<<^<^>^vvv^>>v>^>v^vv>>><<<vvv<v>^><^>vvv<^v<v<<v<v^v^>>^vv^><v>^v>v>v^v<^<v>^vv>v<v>v>>>^^<vvv>>><<>^<>>^<v>>^^^<^^v^v><>>>v^^^vv>>^<^v^>>^v>>^<>vv^vv>^^><v>v><>^><<>^<>^^^<><^><v<<<<>>>v<<<v^^^v^^v>^<
    // >^^<<>v^><v>>^v^^<v<^<>^>^v<><>^><<>^^>>^^>><>>vv<^v<^<>^^v^v^v^^<>v<<><^vv^>vvv<vvv<v>v^v^<<vv<v><^^>>v<v>v>^vv>^^^v<v<>><v^>>v<^<v>v^v>vv><>v<>>><v^^<v<<v>><^>>><v>>v^>^v>v^^v<>vv^><^v^>^^^vv<v^>v<v>^^v^>>^v<>>><v<^>>v^<<^>>>^<^>>vvv><>^<v<v<^>^^<^<>>^^v><>>><>vvv>^<<v>><>>^>><^<v><^><>^^^<^v><^^<<<<^<<^v<><vv^><^^^>^<^<<><vv^>v^<^>><>>^><^<>^>v><>>v>>>vv>^vv^>^^><v^^v^<<>v^^^vv>v>v^>>v^<<<^vvv><><><vv<><>^v>v^<>>>>^>><v<^^^vv^^<>v>v<^v<<v^<^vvv<<><<^v>vvv^^v^^><^<^^<<v^^<<^<^<<<>v<v<><>v^>vvv^<^^^v^v^v^<><v>vv>>v>vvvv^>>^v<^>>^v^^^^><^<v<^^<><^^<<<><>vv<<>^^vvv><vv^v<v<>vv<<>v<v<v^v>v>><^v<<^>^>>^v^<^vv><^>v<^v><v>^^v>><^>^>^^vv^>^v^^^v<v<<<<<v^>v><>><^v^vv>>^>><^><>v<<>v<<<v>v^^<<^>v<^><^^^><<^<vv<vv<<>^>vv>v><^><<^<>>v><<<^v^^<<<vv<>^><<>v^v>vv<<v^v>>v<<v^^vvv^<>><^v^<v<^^^^>>>>vvv>v^>v>^v>v><^^^<v^^>>>v<v>^>^^>v>vv<>>v^^v^>vv><<>v^>^^v<<>vv^^^><<^<>v<vvvvv^^^>^vv><<v<^>v><><><<v^>^>^v<vvv>v><v>><<>><<^<^<v>>v<v<^<><<v^>>>^>><^^^>^^<><v>^^<^<<<v<^<v>v>>v<v>>^^v^>v>>^v>^^>><<>v^><>
    // ^<v^>^>v<<^^<<<vvvv<^v<v^^^><vvvv^^<>^>v>vv<v>^<<><><^^^v^<^>^>>^^<^>v>vv><^^>vv<>^v<v>^v<^v>^>><<>^<v><v^>v<>^^vv>>^vv>^v^^v^^^>>>^<<>v><><<^<><^^^vv<v>v^>>^><>^^^<<^^v<^vv<<>>>^v<>v>v^<v<>^v>vvvv><<<^v>^>v<vvv<>>>^<>^<v^>^<<^v>^><^<^<vvv>^^>v<v<v<>^vv>^>>>^v^<>^<vv<>v>v^><v<^^<><v<>><vvvv^<<^<^<^v<^<^>^v<><^<^<>^<v<v^<^><v^>^v^vv>>^<>v^<>^<v>v>>v>><>v<>>^<v>>v<vv<v<v><>^<>^^>^vv^v^<v>>^^^v^>vv^^>^^^<<^vv>^<v>vv<^v>^v<^><>>^v<v<>v<v>^v^<v>v>>v^v^>>^^^>^v<^v>^^v>><^v^<>^<v<<v^^v^^><^^v<><<>^v>^>vv>^<>><v>><<<>v>^v^>v>^><<>v<v^^v><^v>^^<^>^^v<vv><vv><><^<>^><^<>>^^<<>^v^^>^>^v<^^><v><^^^<<^><<v^<^v<<v>vvvv>^^v<v^v<<>v<<>^v>>vv>>v><>^^<v>v>v>>^^>^<vv<^v>^>v<<^>^vv<<<v<vv<^>v>v>^^<v<vv>^><^>^v><v<<^v^v^>^<<^^v<<v>^v^>>><^>>^<^v<^v^>^v<>v<^v^<^^><><<^^vvv<^><^^<v>v><v>>v<^>vv^v><^^^v^<>>vvv^v<^<<>v><><v^>^><<>^<v<<v^<v^^<^<><^vvv>^^>v^vv^>vv<v<<>^><<<<v>>v^<>>v^>^><vv^v^<^><^vv<^>>vvv><v^>v^<><^>^^v<^>^>^^<<^<<>><^v^>>><^v<v^^^^v<><>>^v^^v<<v<^<vv>>>v^>^v<<<>^v<<><v>>v<<<vvv>v>><^>><vvvv^^
    // >^^v<v^<v^<<v<v>^<<<^^><<>v^<^^<>v>^>vv>v>v^>^v^>v<>v<vvv^v>>v>vv<v>vv^>^><^^vvv<v<<><>^<<>>^^^v>>vv^vvv^<<v^v<v<^<<<<<<v>>>>^^^>>>>>>^v^><<v^<v<>^<v<v>>>^><<<v><^^<>>v^<^>^<>v^<^>^>^v^><^<^vvv>v<^v<>vv^^^>v<v>vvv<^<v<v^<<<>^<v<<^^<>^^>v^<vvv^<v^v>><<v>>^v>v>vv<><>>v<^v^><<v<v<^v<v<<><^<^>^<v<>>vv>v>^>v>^<v^v<^<^<<>vv<v^v^^v<>^^><>^<>vvv>>^^^>v>vvv<<><^v>>>^v^<v<><^^^vv>^^v>v>>v><v<^^^>v<<>^><^v<v<v^vv<><>v><<<<^v^>>^v>vv<>v^<vv^v^<^^>vv><^v^^<v<><v^<><^<<>v<<><<>>>^><<<v>^<^<v>v^^<<>>>><<<<<^>^v^v^>>><><>>>>>vv<<>^<v>v^vv><<^^<><^^<^^><<vv^<^v^^vv>>>>v>vv><>v>vv>v>vvv^<v<<^v<>v<<v><<v><><^^^^^>^^>><^v<^^<vv<<<<^v><<^v^<>>^^v<v^vv<><<vv<v<^<v<<><v^v>v><>><>v<^<v<>>>^><>>^^v>>>v>v<<><^<<vv^^><v<v>>vv><<>><<^>v^^v^>>>^v^<>vv<vv<vv<^^><<vvv^>^><^^v>^><>^<<<v^>^<v<<vv><v<^v<<v<>>><<><><<<vv>>v>>><>^v<<<^<^<^^^<<vvv^^>v<v^v<<^<><<v<^>><v<<v<^^v^v<>><<<>>^^^<v>>^<v<>^^>v^^^^<>vvv^<^<<<^^^>^<>vv^<>^^^^^<v^v>><<^<^^<^^vvv>v><<>>v^<<<>^^^><v>^>>v>^^><v<>^v>v<^^>v<^<>^^^<>^<>>v>^v><>v^<^>^>vv<v^
    // ><<^v<>v^v>v>^^>v^v<<^<<v^^>v<v<^>>^<v<^<>><vv>><<<^^v><v<><^>^<<>^>v^v>>>v<v>>v>^v>>v>v^<^<>^vv^><v<^v<v^<^v^<>v^v^v^>>^><><<v>^^<><^<v^>>^<>^<v<<<>>>><<>>v^<^<^<v>^><^v^v^<<^>>^^<v>^^<>v^v><>><<v<v<>^>><>>vvv<v>^<<v>^^<>^v<<^<<^^vv<^v<^>^<>><^v>>vv>v<<>><<>>^><vv^><>v<v^v^^v^>>^v^v>^^<^^<^^^<<vvv><>^^^<^<<<<vv<><v><^vv<>vv>^^>>^<^^v^>^vvv^^<v>^><>>^<<>>>><><v<^<>^>v>^<>v^v<<v>>^^v<^><^<^v><<>>>><><v^<><>>^<vv>>><vv>v<vvv>v^<^vvvvv^v>><<<v^>^>v<<<>^v^^vv<>^vv>^<v><^><><^>vvvvvv>v<^<>>v<><v^><^<>vv>>^^v>>vv<v^>v^v>^^><^^>><<<>>><v>>^v>v><v<^<>>^<^vv><^v<<v<^<^<vv><vv<>^^^>^>>>v>^>v<<><^^<<>>>^>><<v<v<<<^^>v><^>v^<<v^<>><<^<^<>>v^vvv<^^v><^<^v<>^v>v^><>vv<v<v<^v>^^>vv^^>^<v><^<^<><v<v><>>>v^>><<<^<^>vv<^^^>><<<v>^>v<>v^^>vvvv^<<<<>v<><v^>>^>>v^^^<v><vv>v<>>vv<^<^><v<^^<v>v<<v><^>vv>^v^>v>v<^<<><>>^v<<>v>^v^>^<v><<>v>^^<><><v><>>v<<v^<v<^><>^vv<><>v^<vv^^^>v<<vv>>>>>v^<>>^><>>v<<>v<vv^v><>vv<<vv^v<>>^^<v<^v<v>vv>^>>v>vv^v>v<>><>>v^v>>^>v<v^>>>^<v<^^>>v<<<vv<<>v><<><^v<>>vvvvv^v><<>^v<v>^
    // v>^>v<^v>v><^>vvvv<<v<>^^<<>vvvvvv<v<>^>>><v><v^<<^>^v<>v^>^<<v<><vv>^v^>>^<<v<v^>^>v<><v>^>^^v<^>v<>^><v^>v<v>v^^>^^<>^<<^<<<v>>v^<^>^>><v>>^>>v^<^vv^^^vv>v>v<v>v^>v>^><<^<><<<<>v<vvvvvv<><v>^<>^>>vv<<^vv>^>^^>^v>vvv^vv>>v<^^>^^>v^<<vv^>>vvv^vv>vv><>v^v<^><<>^^vv<<^vv><>^<>>^^^vv^v^>^>^<<vv>><^>>v^vv>^><v<<vv^v>>v<^<>v<v><v<><^^vv^^<^<v^v>>^<vv^<<v^<v^^^><<^>^<<^^^>>vv>^>><><^v^>vv<>^<vv>>v>^<<>><<v>^>>vv<>^>>>v<vv<v^>>>>^v^v^>v^<^v<<>v<<<v<^<>v><<^v^<<v^<vv<^v<><^<^>v^<v>^vv>>v<v><<<^v<v<v^^>>^>v^v^>><<>>vv>>>>v^v<<v^v>^>v<vv<v<<>v><<^<<>vv>^<^>v<vv^^>^^>^<^v<>^<^<v<v^^v<^>>^<><^<<>^>^v^v><<>vv^v<v><>^^v>>^v><<v^^^>^v<><^<^^^^<>><<^^<<<^<^<^v<>^<^<v>vv>><<vv^>vv<>>><^^><^vv>>^v^<<>>>v^^^<>>^^>>vv^<vv^>v>>v<>v><><v>vv>v<<v^<><<<v^v><v^^v<<vvv>^^<^v<>^><v>>>^^v^<^<>^^v<^<>>>><v^>^^^>^v>><v>>v>^>^v>><>v<v<v<>v<^^><<><>^v<<<><>vv><>v><<<>>>>v><<^<^^>v<v^v<<v<^>><vv>^>v<v^v<<^v^^>v^<v^vv^vv><^<v<^v<^<>v<v^>v>^>^>v><^v^<><<v>>^v^><><<>^>^^>^<v^>v>^^vv>>v<v>^<v<v^v^>^>v^v<vv<v^^vv<<v<<^>v>^
    // ^<<>>>v^^vv<>^<>v>^v>>^vvv<><v^^^<<^^v<^v<^><<<><v>^<v^<^^<^v>^>vv^v^vv^>>vvv<vvv<^><>><><^<v<^^><^^v^v^><vv><<^vv<^v<v<^v<^v<<v>^^<<><>v<>>>^v^v<>>v><<<<>><vvv<^<<>>>^v^<<<^v^>>vv^v<^<<>^^v>>^^^^<^>v<^v^<><v^<<<^v^v^v>^>^>vv><<^vv>><>vv><v<>^v>^>>vv<^^<>v^^<^v^<^v^^>v>>^<v<<>>>v>><v>^^v^>^<>><<>>v>v^>>><>vvv><>>>v>^<<^v<^v<^<>^v<^>>^<^^><^^v<^<^<>vv<<v<^^v^<<<>v<><>vv^v>^>v^<v>^^>v<<v^>>>>v<^<<v<>vv<v<^^>>v<^v^^^>^<><>^v<<^><<v>^<v^v^<^>^>vv<v^^^^v^^^v^<>><^>>v<^v>v<>>>^<^<^<v^>>^<<<v<<v^^<>^<v>>v>^<^^v<v>^>^vv>v^>v>>vv<<><v>^v>^v<<<<>^<<<<>v<vvv>>>>><<vv><>v<v^<><^v<>v^^<v^>^^<<><^><<^v<<^>^<v^<^v<^vvv<^^<v<>v^v<><<<v<>>><v<<v^><<^^>^<>>>v^<>>v>><>v><v^><^<>>v^<>v^<^>v^<^<<>v<<<vv>^>>v^<v^>^>v^^<<^>>^<^^>><v>><v<<v<<>^^^vv>vv<<>^<v^><v<>^v>^^^^>v>^^<<^<^<^<<v><vv^^^v^<>v>>vv^><<>^^^<^>>>vv<>>v>^<>^^^v<^vvvvvv^<^^>><^<^v^vv<<v<<<>^vv><>>^v<v^^><<v><v^>^v^v<^v>>v^v><^>vvv<<^^<v>^^<<v^v>><<<>v<^>>^v<v^<^vv^v>v>v<v<vv^^<^<>>vv<v<v^<>v>^>v><^^^^<>^>>v<>>^<v><^vvvv>vvv^>^v^<<v>^>>^<<^>vv<>
    // vvvv^v^^^<<^>^^vv<<^>v>^v>^>^>^^^^^^>v>>vv^>>^^>^vv<vv^<v<<<^<^<<<<^<<v^^^v^<<><<>^>^>v^<vv<vv>^>>^^v<v<v>^^v^^^^v^<<>^<>v<>>^><><v>^<vv><v^<vv<v^>>^v^^vv^>^v><<^><^^vvv>^^><>>^v>^^>v><>>^<>><^<^>vvv<>v^<><><^v>><^>^>^^^v>><>^>><>^<vv<v>^<v><>^>^vv<vv^^^<^<v^^v>>^>><v^^<>vv>v^vv<vv<v<<<^v>^<v>v^<<^<>vvv^v<<v<<vv>>vv<v<v<>v^>>><><v><^v<<^><vv<^^>^vv>>v<>vv>v^vv>^<^v<<><<^>^>vv<v^<v<<><>^>^><v^^<<>^^><>v<><^^^><v><vv<^^vv><v<^<v<^vv^<<^>vv>^>>>v^v>v^>^>v^vv>>><v<v<<v^>>v^^^<>^>^>v>>^^^>>>><><^<>>^vvvv<vvv^^vvv^<vv>>>>^v^>vvv<vv>^><^><v><<v<^v><v^<v<<>>><<v<v<<^>^v^<v^^<>^v^<^^>><v^>^vv>^v<<v>>v>v<v^vv><<><<^><^<<>^<>>>^vv^^^>v<^^^v>^v<>v^^><vv<<^^>^^^v>v>v><<^^<>><><<<^><>v<^<<>><v<<vvv<<vvv^>v^vv<vv<>^^^<^<^><<vv>v^>>v<<v<v>>v<<v^<><v^^>^^<>^v<><vv^<^v<<<>^<<^^v>v<^vvvvv>v^<^><v<><<<^<v<<<v<vv<^^>^<v<v^>^>v^^v>>^vv^>v<<<v><>^v><v>v<>v>^v^v^<^>^>^^v>><v^v<v>><<>^^^^^<vv^v^^<^>>>v<<vv^><v^v^^>><>^>v^>v>^>v^>vv><v<^<^>^>^v^>v<>><<<>^v>>vv^v<<^v>>><<><<<>^<vvvv<v<^<<>vv<vv<v<><vv><<^^vv>^><
    // <^^^<v><^<vv^^v^><><^v<^>v^<v<>^v^v>^^v>>v^^>^v<<<vv<^v^><vvv><^vvv>>><>><^>><>>v<>v<<<^^<>^^^^>>^<^v^^<v<><<<vv>v^^^>>^<><^<>>v>v^>^^>>^v^>^^^^>v<^><>^<>>v<^v^<<>v^v^<>^<<<>v>^>>v^^v>v^v>^>v^^>>>v<^^v^^>>v^>><^^<^<<vv>>v^<vv<<v<^^^v<<v<v<v<>^v><^>v^<^vv<>>^v<v>^>v>^>^>><vv<<><<vv^v>>^^v><^<^^<<^vv><vv><<^v<^^^^>>^><v<^v>>v>>^>^<><^vvv^^<v^^><^><^^v^<v<<^v<><^><><<^v<v<^<v>^>v<>vv>^^^vv^^^^^<>v<<>vv<>^vv<^<^>^^>^^<^v<<<>^<v^<v<>vv^<v>^v><^>^v^<<<^<>v<<^<vv^v<^v<v>>v^^v^^v^v><<v<vvv<^<<^vvv^^v>v<<v^>vv><<^<^<^>^>^<>><>v<><>><^^><<<v<>><v>^<<<<^<<^^^^v>><^^v<v><v^v<^v^v>^>>>>v<>v<v^v<vv>^^<v^^^<v^v^<<^>v^><>>>v<>^v>v^^>><>v>^v^<^^v^v^^^v>^><<^v^vv<>>>^<<<>^^<>^^^vv^<v^>v<<<v>v<>>><v^><<^>v^^^v>^<v<^<>^^>vv^>>><><<^<v^^vv^>v><vv^^v<^^><<v>v^>>v<v^^^<vvv^^<<<^><<^>><>^^v<^^v<^^>^<<>^vv^v^^<><>v>v^^^<^^<v>><>v^^vv>>^vv^^>><>v^vv>vvvv^^vv^><v^^^>vv>^vv<v^^^^^v>^^><v^<^vv<>>>v<>>>^^>><<>v<^vv<<><v><>v><v^<<<<><>^^vv^^<^v<^>>>>vv<<^<>v<^<><^v^<<v<<>^<<<>^>><^v<vv>v>><^^>>^>^<>^^>>v<>^<<^v<><v^
    // ^<>vv<vv^^>^<^<vv><>>^<^^>^>^<^^v^>><>v^>v>v>vv><^>^>^>><<>^><vv>vvvvvv<<v>^^<<<><<^v<<^^^<>v<<<<vv^^v<><>^v^^v^>^^><vv><^vvv^^<^v^><>v>v<>v<<v^>>^v^>^^^^>>^v<vv>>><>^<^vv^^<v^vv^^^>^>^v^>>^^>>v><>><v^<>>vv^>^>v>v^<>v<<^<<^>v<<v<>v>vv^>^>v^<v<>^<>^v<>><vv<>><<>vv^^>^>^^v^^>v>^<<^<><v>>^<>v><>^>>v^><^^v<vv^v<v^>v^^<v^>v><>v^^><<><<><>^^<^<>vvv>v>v<>v>^<<>>^v<^><<<vv^>^<<<>v<^v>><^^>>>^<^<>v^^^>>>>v^>^<><^<<^><^^^<>^^>^^^v><^^<^v<>><<>^v<><^<<^^>><<><<^>^<^^>^>^<<>>vv<<<>v<vv>^<>v^>><>v>^^^>^><<^^^>>^^v^^<<><^^vv<>v^<<v>v>^vv>>vv<v<v<v<>v^^<>><^<<v<><>^v>^>v>^^vv<>^v^^>>^<>^<<^><^^^v>^v><v^^<>v^^<^v<<<><><<vv<>^>vv>>^>^<>^>v<<v<<><>><^vvv>>><v^^<^vvvv^v<^><><<>v><><<>v><^^^v><^<^vv>>><^^<^v><^<^^<v><^^<v^vvv<vv>v<<>^^^v><<><<vv<^<<^v<v<v><>v^>^<<<<v^v>>>vv>v^^^<>>>^<v>v<v>^^>><v<>^vv><><<<>v><^><v<v<<<vv><<vv^<<>^v^v<<^<<>>^>^^vv^>>>v>^><^vv><v<vv>^>><<^>>>^>>^>^>>v^^v>^<v><v^<<<^v<^<<^<>v^<<^<<v<><><v>^^v^^v<<^>v^v^>v>v>v>><>><<v<v<<><^>v^<<<^>^^<<<>^v>><v>v<vv<><^><<^<v>^v<<v<^>^v^^>vv
    // `,
    //         `multibakery/test/aoc50x50-1`,
    //         1436690
    //     )
}
