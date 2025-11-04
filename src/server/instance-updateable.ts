import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../misc/assert'
import { copyTickInfo } from '../game-loop'

export abstract class InstanceUpdateable {
    inst!: InstanceinatorInstance

    protected destroyed: boolean = false

    abstract isActive(): boolean
    abstract isVisible(): boolean
    protected abstract attemptRecovery(e: unknown): void

    preUpdate() {
        for (const addon of ig.game.addons.preUpdate) addon.onPreUpdate()
    }

    update() {
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
    }

    deferredUpdate() {
        try {
            ig.game.deferredUpdate()
            ig.input.clearPressed()
        } catch (e) {
            this.attemptRecovery(e)
        }
    }

    destroy() {
        if (this.destroyed) return
        this.destroyed = true

        if (this.inst) {
            instanceinator.delete(this.inst)
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
