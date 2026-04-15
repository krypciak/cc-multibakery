import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../misc/assert'
import { copyTickInfo } from '../game-loop'

export abstract class InstanceUpdateable {
    inst!: InstanceinatorInstance

    destroyed: boolean = false

    abstract isActive(): boolean
    abstract isVisible(): boolean
    protected abstract attemptRecovery(e: unknown): void

    preUpdate() {
        // PROFILE && console.time(`${this.inst.name} preUpdate`)
        for (const addon of ig.game.addons.preUpdate) addon.onPreUpdate()
        // PROFILE && console.timeEnd(`${this.inst.name} preUpdate`)
    }

    update() {
        // PROFILE && console.time(`${this.inst.name} update`)
        const addonsPreUpdateBackup = ig.game.addons.preUpdate
        ig.game.addons.preUpdate = []
        try {
            ig.game.update()
        } catch (e) {
            this.attemptRecovery(e)
        } finally {
            if (instanceinator.id == this.inst.id) {
                assert(ig.game.addons.preUpdate.length == 0)
                ig.game.addons.preUpdate = addonsPreUpdateBackup
            }
        }
        // PROFILE && console.timeEnd(`${this.inst.name} update`)
    }

    deferredUpdate() {
        // PROFILE && console.time(`${this.inst.name} deferredUpdate`)
        try {
            ig.game.deferredUpdate()
            ig.input.clearPressed()
        } catch (e) {
            this.attemptRecovery(e)
        }
        // PROFILE && console.timeEnd(`${this.inst.name} deferredUpdate`)
    }

    destroy() {
        if (this.destroyed) return
        this.destroyed = true

        if (this.inst) {
            instanceinator.destroy(this.inst)
        }
    }
}

export function updateInstVisibility(inst: InstanceinatorInstance, visible: boolean) {
    if (inst.display != visible) {
        inst.display = visible
        instanceinator.retile()
    }
}

export function applyUpdateable(
    obj: InstanceUpdateable,
    timeInst: InstanceinatorInstance,
    firstTime?: boolean
): boolean {
    if (!obj.inst) return false

    if (firstTime) updateInstVisibility(obj.inst, obj.isVisible())
    if (!obj.isActive()) return false
    if (firstTime) copyTickInfo(timeInst, obj.inst)

    obj.inst.apply()

    return true
}
