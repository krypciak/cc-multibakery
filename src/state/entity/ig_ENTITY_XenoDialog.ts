import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import { type StateKey } from '../states'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace ig.ENTITY {
        interface XenoDialog extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.XenoDialog': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.XenoDialog, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        running: memory.diff(this.running),
        currentTextIndex: memory.diff(this.currentTextIndex),
    }
}

function setState(this: ig.ENTITY.XenoDialog, state: Return) {
    this._initMembers()

    if (state.running !== undefined) {
        this.running = state.running
        if (this.running) {
            this.startDialog()
        } else {
            this.cancelDialog()
        }
    }

    if (state.currentTextIndex !== undefined) {
        this.currentTextIndex = state.currentTextIndex

        if (!this.running && this.currentTextIndex == -1) {
            this._clearCurrentIndex()
        }
    }

    if (state.currentTextIndex !== undefined) {
        this.currentTextIndex = state.currentTextIndex - 1

        if (this.running) {
            /* prevent crashes */
            this.currentEntity ??= this.dialog[0].entity
            this.currentEntity.xenoDialogGui ??= new sc.XenoDialogIcon()

            if (this.currentTextIndex == -2) this.currentTextIndex = this.dialog.length - 1
            this._showNextMessage()
        }
    }
}

prestart(() => {
    ig.ENTITY.XenoDialog.inject({
        getState,
        setState,
    })
    ig.ENTITY.XenoDialog.create = () => {
        throw new Error('ig.ENTITY.XenoDialog.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.XenoDialog, isStatic: true })

    if (REMOTE) {
        ig.ENTITY.XenoDialog.inject({
            update() {
                if (!isRemote(multi.server)) return this.parent()
            },
            _showNextMessage() {
                if (!isRemote(multi.server) || ig.settingState) return this.parent()
                return false
            },
        })
    }
}, 2)
