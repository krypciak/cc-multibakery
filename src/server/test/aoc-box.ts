export {}
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
    previous: Set<ig.Entity>,
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
    collList = collList.filter(coll => coll.entity != this.entity)
    if (collList.some(coll => !(coll.entity instanceof ig.ENTITY.AocBox))) return []
    if (collList.length == 0 && isPushingBlocked) return []
    const prevLen = collList.length
    collList = collList.filter(coll => !previous.has(coll.entity))

    previous.add(this.entity)
    if (checkLinked && this.entity.linked && !previous.has(this.entity.linked)) {
        if (!isPulling || vx == 0) {
            collList.push(this.entity.linked.coll)
        }
        previous.add(this.entity.linked)
        retList.push(this.entity.linked.pushPullable)
    }
    if (checkLinked && isPushingBlocked && prevLen > 0 && collList.length == 0) return retList

    if (collList.length > 0) {
        for (const coll of collList) {
            const box = coll.entity as ig.ENTITY.AocBox
            if (box != this.entity.linked && previous.has(box)) continue

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
