import { prestart } from '../../loading-stages'
import { Opts } from '../../options'
import { getCCMap } from '../../client/client-map-util'

prestart(() => {
    function calcDist(point: Vec2, soundPos: Vec2, range: number, rangeType: ig.SOUND_RANGE_TYPE | undefined) {
        const vec: Vec2 = Vec2.create(point)
        Vec2.sub(vec, soundPos)

        if (rangeType == ig.SOUND_RANGE_TYPE.HORIZONTAL) vec.x = 0
        else if (rangeType == ig.SOUND_RANGE_TYPE.VERTICAL) vec.y = 0

        const minimumRange = range * 0.1
        const b = range * 0.9

        let dist = Vec2.length(vec)
        if (dist < minimumRange) {
            dist = 0
        } else {
            dist = KEY_SPLINES.EASE_SOUND.get(((dist - minimumRange) / b).limit(0, 1)) * range
        }
        Vec2.length(vec, dist)

        return { vec, dist }
    }
    function closestDist(point: Vec2, range: number, rangeType: ig.SOUND_RANGE_TYPE | undefined) {
        const clients = getCCMap().getAllInstances()

        let { dist: smallestDist, vec: smallestVec } = calcDist(point, ig.game.soundPos, range, rangeType)

        if (Opts.useClosestSoundPos) {
            for (const soundPos of clients.map(client => client.ig.game.soundPos)) {
                const { vec, dist } = calcDist(point, soundPos, range, rangeType)
                if (dist < smallestDist) {
                    smallestDist = dist
                    smallestVec = vec
                }
            }
        }

        return smallestVec
    }

    ig.SoundHandleWebAudio.inject({
        _setPosition() {
            if (!multi.server) return this.parent()

            if (!this.pos) return

            this._updateEntityPos()

            if (!this._nodePosition) return

            const rangeType: ig.SOUND_RANGE_TYPE =
                typeof this.pos.rangeType == 'string'
                    ? ig.SOUND_RANGE_TYPE[this.pos.rangeType as keyof typeof ig.SOUND_RANGE_TYPE]
                    : this.pos.rangeType

            const vec = closestDist(this.pos.point, this.pos.range, rangeType)

            // setPosition is deprecated
            // this._nodePosition.setPosition(vec.x, vec.y, -0.1 * this.pos.range)
            this._nodePosition.positionX.value = vec.x
            this._nodePosition.positionY.value = vec.y
            this._nodePosition.positionZ.value = -0.1 * this.pos.range
        },
    })
})
