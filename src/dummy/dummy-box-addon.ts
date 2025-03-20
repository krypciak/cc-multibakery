import { assert } from '../misc/assert'
import { prestart } from '../plugin'

declare global {
    namespace dummy {
        namespace BoxGuiAddon {
            interface BoxGuiAddon extends ig.GameAddon {
                guiRefs: Record<string, sc.SmallEntityBox>
                textGetter: (player: dummy.DummyPlayer) => string
                condition: (player: dummy.DummyPlayer) => boolean
                boxTime?: number
                boxAlign?: sc.SmallBoxAlign
                boxOffY?: number
                boxHideSmall?: boolean

                removeAll(this: this): void
                removeFor(this: this, uuid: string, skipTransition?: boolean): void
                addFor(this: this, player: dummy.DummyPlayer, skipTransition?: boolean): void
                updateText(this: this, uuid: string, newText: string): void
            }
            interface BoxGuiAddonConstructor extends ImpactClass<BoxGuiAddon> {
                new (
                    name: string,
                    game: ig.Game,
                    textGetter: (player: dummy.DummyPlayer) => string,
                    condition?: (player: dummy.DummyPlayer) => boolean,
                    time?: number,
                    align?: sc.SmallBoxAlign,
                    offY?: number,
                    small?: boolean
                ): BoxGuiAddon
            }
            var BoxGuiAddon: BoxGuiAddonConstructor
        }
    }
}
prestart(() => {
    dummy.BoxGuiAddon ??= {} as any
    dummy.BoxGuiAddon.BoxGuiAddon = ig.GameAddon.extend({
        init(name, game, textGetter, condition = () => true, time, align, offY, small) {
            this.parent(name)
            this.guiRefs = {}

            this.textGetter = textGetter
            this.condition = condition
            this.boxTime = time
            this.boxAlign = align
            this.boxOffY = offY
            this.boxHideSmall = small

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
            gui.doStateTransition(gui.hideSmall ? 'HIDDEN_SMALL' : 'HIDDEN', skipTransition, true)
        },
        addFor(player, skipTransition = false) {
            assert(!this.guiRefs[player.uuid])
            const gui = new sc.SmallEntityBox(
                player,
                this.textGetter(player),
                this.boxTime ?? 1e100,
                this.boxAlign,
                this.boxOffY
            )
            gui.hideSmall = !!this.boxHideSmall
            gui.doStateTransition('DEFAULT', skipTransition)

            this.guiRefs[player.uuid] = gui
            ig.gui.addGuiElement(gui)
        },
        updateText(uuid, newText) {
            const gui = this.guiRefs[uuid]
            if (gui.textGui && gui.textGui.text?.toString() != newText) {
                gui.textGui.setText(newText)
                gui.setSize(gui.textGui.hook.size.x + 16, 11)
            }
        },
        onPostUpdate() {
            const uuidsPresent: Record<string, boolean> = {}
            for (const player of ig.game.getEntitiesByType(dummy.DummyPlayer)) {
                uuidsPresent[player.uuid] = true

                if (!this.guiRefs[player.uuid] && this.condition(player)) this.addFor(player)
            }
            for (const uuid in this.guiRefs) {
                const player = ig.game.entitiesByUUID[uuid] as dummy.DummyPlayer
                if (!uuidsPresent[uuid] || !this.condition(player)) {
                    this.removeFor(uuid)
                } else this.updateText(uuid, this.textGetter(player))
            }
        },
    })
}, 2)
