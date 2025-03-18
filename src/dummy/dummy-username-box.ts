import { assert } from '../misc/assert'
import { prestart } from '../plugin'

declare global {
    namespace dummy {
        interface UsernameGuiAddon extends ig.GameAddon {
            guiRefs: Record<string, sc.SmallEntityBox>

            removeAll(this: this): void
            removeFor(this: this, uuid: string, skipTransition?: boolean): void
            addFor(this: this, player: dummy.DummyPlayer): void
        }
        interface UsernameGuiAddonConstructor extends ImpactClass<UsernameGuiAddon> {
            new (game: ig.Game): UsernameGuiAddon
        }
        var UsernameGuiAddon: UsernameGuiAddonConstructor
    }
    namespace sc {
        var dummyUsernameGui: dummy.UsernameGuiAddon
    }
}
prestart(() => {
    dummy.UsernameGuiAddon = ig.GameAddon.extend({
        init(game) {
            this.parent('DummyUsernameGui')
            this.guiRefs = {}

            game.addons.all.push(this)
            game.addons.postUpdate.push(this as any)
        },
        removeAll() {
            for (const uuid in this.guiRefs) this.removeFor(uuid)
        },
        removeFor(uuid, skipTransition = false) {
            const gui = this.guiRefs[uuid]
            if (!gui) return

            delete this.guiRefs[uuid]
            gui.doStateTransition('HIDDEN', skipTransition, true)
        },
        addFor(player) {
            assert(!this.guiRefs[player.uuid])
            const gui = new sc.SmallEntityBox(player, player.username, 1e100)
            this.guiRefs[player.uuid] = gui
            ig.gui.addGuiElement(gui)
        },
        onPostUpdate() {
            const uuidsPresent: Record<string, boolean> = {}
            for (const player of ig.game.getEntitiesByType(dummy.DummyPlayer)) {
                uuidsPresent[player.uuid] = true

                if (!this.guiRefs[player.uuid]) this.addFor(player)
            }
            for (const uuid in this.guiRefs) {
                if (!uuidsPresent[uuid]) {
                    this.removeFor(uuid)
                }
            }
        },
    })
}, 2)
