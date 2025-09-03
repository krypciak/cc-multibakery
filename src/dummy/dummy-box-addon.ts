import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'

export function removeAddon(addon: ig.GameAddon, game: ig.Game) {
    for (const key in game.addons) {
        const arr = game.addons[key as keyof ig.Game['addons']]
        arr.erase(addon as any)
    }
}

export function addAddon(addon: ig.GameAddon, game: ig.Game) {
    game.addons.all.push(addon)
    if (addon.onLevelLoadStart) game.addons.levelLoadStart.push(addon as any)
    if (addon.onLevelLoaded) game.addons.levelLoaded.push(addon as any)
    if (addon.onTeleport) game.addons.teleport.push(addon as any)
    if (addon.onPreUpdate) game.addons.preUpdate.push(addon as any)
    if (addon.onPostUpdate) game.addons.postUpdate.push(addon as any)
    if (addon.onDeferredUpdate) game.addons.deferredUpdate.push(addon as any)
    if (addon.onPreDraw) game.addons.preDraw.push(addon as any)
    if (addon.onMidDraw) game.addons.midDraw.push(addon as any)
    if (addon.onPostDraw) game.addons.postDraw.push(addon as any)
    if (addon.onReset) game.addons.reset.push(addon as any)
    if (addon.onVarsChanged) game.addons.varsChanged.push(addon as any)
    if (addon.onWindowFocusChanged) game.addons.windowFocusChanged.push(addon as any)
}

declare global {
    namespace dummy {
        namespace BoxGuiAddon {
            interface BoxGuiAddon extends ig.GameAddon {
                guiRefs: Map<dummy.DummyPlayer, sc.SmallEntityBox>
                textGetter: (player: dummy.DummyPlayer) => string
                condition: (player: dummy.DummyPlayer) => boolean
                boxTime?: number
                boxAlign?: sc.SmallBoxAlign
                boxOffY?: number
                boxHideSmall?: boolean

                removeAll(this: this): void
                removeFor(this: this, player: dummy.DummyPlayer, skipTransition?: boolean): void
                addFor(this: this, player: dummy.DummyPlayer, skipTransition?: boolean): void
                updateText(this: this, player: dummy.DummyPlayer, newText: string): void
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
            this.guiRefs = new Map()

            this.textGetter = textGetter
            this.condition = condition
            this.boxTime = time
            this.boxAlign = align
            this.boxOffY = offY
            this.boxHideSmall = small

            addAddon(this, game)
        },
        removeAll() {
            for (const player of this.guiRefs.keys()) this.removeFor(player)
        },
        removeFor(player, skipTransition = false) {
            const gui = this.guiRefs.get(player)
            if (!gui) return

            this.guiRefs.delete(player)
            gui.doStateTransition(gui.hideSmall ? 'HIDDEN_SMALL' : 'HIDDEN', skipTransition, true)
        },
        addFor(player, skipTransition = false) {
            assert(!this.guiRefs.has(player))
            const gui = new sc.SmallEntityBox(
                player,
                this.textGetter(player),
                this.boxTime ?? 1e100,
                this.boxAlign,
                this.boxOffY
            )
            gui.hideSmall = !!this.boxHideSmall
            gui.doStateTransition('DEFAULT', skipTransition)

            this.guiRefs.set(player, gui)
            ig.gui.addGuiElement(gui)
        },
        updateText(player, newText) {
            const gui = this.guiRefs.get(player)
            assert(gui)
            if (gui.textGui && gui.textGui.text?.toString() != newText) {
                gui.textGui.setText(newText)
                gui.setSize(gui.textGui.hook.size.x + 16, 11)
            }
        },
        onPostUpdate() {
            const playersPresent: Set<dummy.DummyPlayer> = new Set()
            for (const player of ig.game.getEntitiesByType(dummy.DummyPlayer)) {
                const gui = this.guiRefs.get(player)
                if (gui && gui.entity != player) continue
                playersPresent.add(player)

                if (!gui && this.condition(player)) this.addFor(player)
            }
            for (const player of this.guiRefs.keys()) {
                if (!playersPresent.has(player) || !this.condition(player)) {
                    this.removeFor(player)
                } else this.updateText(player, this.textGetter(player))
            }
        },
    })
}, 2)
