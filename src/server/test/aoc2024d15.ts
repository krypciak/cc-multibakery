import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../../misc/assert'
import Multibakery from '../../plugin'
import { scheduleTask } from 'cc-instanceinator/src/inst-util'
import { PhysicsServer } from '../physics/physics-server'
import { InputData } from '../../dummy/dummy-input-puppet'

declare global {
    namespace ig.ENTITY {
        namespace AocBox {
            interface Settings extends ig.Entity.Settings {
                wide: boolean
                linked?: ig.ENTITY.AocBox
            }
        }
        interface AocBox extends ig.ENTITY.PushPullBlock {
            pushPullable: sc.AocPushPullable
            linked?: ig.ENTITY.AocBox
            motherLinked?: boolean

            moveBox(this: this, vx: number, vy: number): void
        }
        interface AocBoxConstructor extends ImpactClass<AocBox> {
            new (x: number, y: number, z: number, settings: ig.ENTITY.AocBox.Settings): AocBox
        }
        var AocBox: AocBoxConstructor
    }
    namespace sc {
        interface AocPushPullable extends sc.PushPullable {
            entity: ig.ENTITY.AocBox
        }
        interface AocPushPullableConstructor extends ImpactClass<AocPushPullable> {
            new (entity: PullableEntity): AocPushPullable
        }
        var AocPushPullable: AocPushPullableConstructor
    }
}

function traceMap(
    res: ig.Physics.TraceResult,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    width: number,
    height: number,
    zHeight: number
): boolean {
    let level = ig.game.maxLevel - 1
    while (level && ig.game.levels[level].height! > z) {
        level--
    }

    if (!res.levelUp) {
        // prettier-ignore
        if (ig.game.levels[level].collision!.trace(res, x, y - ig.game.levels[level].height!, vx, vy, width, height, true, false))
            return true
    }
    if (level + 1 < ig.game.maxLevel && level + zHeight > ig.game.levels[z + 1].height!) {
        // prettier-ignore
        if (ig.game.levels[z + 1].collision!.trace(res, x, y - ig.game.levels[level + 1].height!, vx, vy, width, height, true, false))
            return true
    }
    return false
}

function recursiveMoveCheck(
    this: sc.AocPushPullable,
    vx: number,
    vy: number,
    isPulling: boolean,
    previous: Set<string>,
    depth: number,
    checkLinked: boolean
): sc.AocPushPullable[] {
    const player = ig.game.playerEntity

    const _ = ig.game.physics.initTraceResult({})
    let collList: ig.CollEntry[] = []
    // prettier-ignore
    let isPushingBlocked: boolean

    {
        const x = this.entity.coll.pos.x + 0
        const y = this.entity.coll.pos.y + 0
        const z = this.entity.coll.pos.z + 1
        const width = this.entity.coll.size.x
        const height = this.entity.coll.size.y
        const zHeight = this.entity.coll.size.z - 0

        const isPushingBlockedByWall = traceMap(_, x, y, z, vx, vy, width, height, zHeight)
        if (isPushingBlockedByWall) return []

        // prettier-ignore
        isPushingBlocked = ig.game.physics.trace(_, x, y, z, vx, vy, width, height, zHeight, ig.COLLTYPE.BLOCK, player.coll, collList)
    }

    const retList: sc.AocPushPullable[] = [this]

    if (depth > 100) throw new Error('oopsie daisy depth')
    collList = collList.filter(coll => coll.entity.netid != this.entity.netid)
    if (collList.some(coll => !(coll.entity instanceof ig.ENTITY.AocBox))) return []
    if (collList.length == 0 && isPushingBlocked) return []
    const prevLen = collList.length
    collList = collList.filter(coll => !previous.has(coll.entity.netid))

    previous.add(this.entity.netid)
    if (checkLinked && this.entity.linked && !previous.has(this.entity.linked.netid)) {
        if (!isPulling || vx == 0) {
            collList.push(this.entity.linked.coll)
        }
        previous.add(this.entity.linked.netid)
        retList.push(this.entity.linked.pushPullable)
    }
    if (checkLinked && isPushingBlocked && prevLen > 0 && collList.length == 0) return retList

    if (collList.length > 0) {
        for (const coll of collList) {
            const box = coll.entity as ig.ENTITY.AocBox
            if (box.netid != this.entity.linked?.netid && previous.has(box.netid)) continue

            const ret = recursiveMoveCheck.call(box.pushPullable, vx, vy, isPulling, previous, depth + 1, checkLinked)
            if (ret.length == 0) return []
            retList.push(...ret)
        }
        isPushingBlocked = false
    }

    // prettier-ignore
    const isPushing = ig.game.traceEntity(_, player, vx, vy, 0, 0, ig.COLLISION.HEIGHT_TOLERATE, ig.COLLTYPE.BLOCK, null, player)
    if (!isPushingBlocked && (!isPulling || !isPushing)) {
        return retList
    }
    return []
}
function moveBox(this: sc.AocPushPullable, vx: number, vy: number, isPulling: boolean) {
    if (!this.soundHandle) this.soundHandle = sc.PushPullSounds.Loop.play(true)
    ;(this.entity as ig.AnimatedEntity).setCurrentAnim(vx ? 'moveH' : 'moveV')

    if (this.dustTimer >= 0.13) {
        this.dustTimer = this.dustTimer - 0.13
        const effectName = vx
            ? vx > 0
                ? 'boxMediumEast'
                : 'boxMediumWest'
            : vy > 0
              ? 'boxMediumSouth'
              : 'boxMediumNorth'
        ig.game.effects.dust.spawnOnTarget(effectName, this.entity)
    }
    this.dragState = isPulling ? 2 : 3
    Vec2.assign(this.targetPos, this.entity.coll.pos)
    Vec2.addC(this.targetPos, vx, vy)
    // this.targetPos.x = Math.round(this.targetPos.x / 4) * 4
    // this.targetPos.y = Math.round(this.targetPos.y / 4) * 4
}

sc.AocPushPullable = sc.PushPullable.extend({
    init(entity) {
        this.parent(entity)
        this.navBlocker = undefined as any
    },
    moveBox(vx, vy) {
        const isPulling: boolean = vx
            ? (this.gripDir == 'EAST' && vx < 0) || (this.gripDir == 'WEST' && vx > 0)
            : !!vy && ((this.gripDir == 'NORTH' && vy > 0) || (this.gripDir == 'SOUTH' && vy < 0))

        const checkLinked = !!this.entity.linked && (this.gripDir == 'NORTH' || this.gripDir == 'SOUTH' || isPulling)
        const list = recursiveMoveCheck.call(this, vx, vy, isPulling, new Set(), 0, checkLinked)
        list.reverse()

        for (const box of list) moveBox.call(box, vx, vy, isPulling)
    },
    onUpdate() {
        /* fix boxes clipping into each other */
        this.speedTimer = 4238
        this.parent()
    },
})

ig.ENTITY.AocBox = ig.ENTITY.PushPullBlock.extend({
    init(x, y, z, settings) {
        this.parent(x, y, z, { pushPullType: 'Large' })
        this.pushPullable = new sc.AocPushPullable(this)
        if (settings.wide) {
            if (settings.linked) {
                this.linked = settings.linked
            } else {
                this.motherLinked = true
                this.linked = ig.game.spawnEntity(ig.ENTITY.AocBox, x + 32, y, z, {
                    wide: true,
                    linked: this,
                })
            }
        }
    },
})

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

    input.mainInputData.setInput(moveInp)

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
    input.mainInputData.setInput(emptyInput)

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
                input.mainInputData.setInput(inp)
            })
        }
    }

    input.mainInputData.setInput(emptyInput)
}

function genTest(name: string, moves: string, map: string, expected: number, part2: boolean = false) {
    window.crossnode.registerTest<{
        moveI: number
        moveDone: boolean
        sum: number
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
        async setup() {
            multi.setServer(
                new PhysicsServer({
                    globalTps: this.fps!,
                    displayMaps: !this.skipFrameWait,
                    disableMapDisplayCameraMovement: true,
                })
            )
            await multi.server.start()
        },
        async postSetup() {
            await multi.server.createAndJoinClient({
                username: 'aoc',
                inputType: 'puppet',
                remote: false,
                mapName: map,
            })
        },
        update() {
            const ccmap = multi.server.maps[map]
            const p = ccmap.players[0].dummy
            const client = p.getClient()

            // scheduleTask(ccmap.inst, () => {
            //     const path = `/home/krypek/Temp/frames/${frame.toString().padStart(5, '0')}.png`
            //     const data = ig.system.canvas.toDataURL().split(',')[1]
            //     require('fs').promises.writeFile(path, Buffer.from(data, 'base64'))
            // })
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
                    scheduleTask(ccmap.inst, () => {
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

                    moveDummy(p, client.inst, dir).then(() => {
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
