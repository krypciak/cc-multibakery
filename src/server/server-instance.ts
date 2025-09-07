import { removeAddon } from '../dummy/dummy-box-addon'
import { InstanceUpdateable } from './instance-updateable'

export class ServerInstance extends InstanceUpdateable {
    constructor() {
        super()
    }

    isActive() {
        return true
    }

    isVisible() {
        return !!multi.server.settings.displayServerInstance
    }

    protected attemptRecovery(e: unknown) {
        throw e
    }

    async init() {
        this.inst = await instanceinator.copy(multi.server.baseInst, 'server', this.isVisible())
        this.inst.apply()
        this.safeguardInst()

        removeAddon(this.inst.ig.gamepad, this.inst.ig.game)
        this.inst.ig.gamepad = new multi.class.SingleGamepadManager()
    }

    private safeguardInst() {
        Object.defineProperty(this.inst.ig.game.entities, 'push', {
            get() {
                console.warn('push on server entities!', instanceinator.id)
                debugger
                return () => {}
            },
        })
    }
}
