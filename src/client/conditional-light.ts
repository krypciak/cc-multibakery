import { prestart } from '../loading-stages'

const force: Set<number> = new Set()
export function forceConditionalLightOnInst(instanceId: number) {
    force.add(instanceId)
}

prestart(() => {
    ig.DarknessHandle.inject({
        getIntensity() {
            if (this._instanceId != instanceinator.id && !force.has(this._instanceId)) return 0
            return this.parent()
        },
    })
    ig.LightHandle.inject({
        draw(baseAlpha, sizeOffset) {
            if (this._instanceId != instanceinator.id && !force.has(this._instanceId)) return 0
            return this.parent(baseAlpha, sizeOffset)
        },
    })
    ig.ScreenFlashHandle.inject({
        draw() {
            if (this._instanceId != instanceinator.id && !force.has(this._instanceId)) return 0
            return this.parent()
        },
    })
})
