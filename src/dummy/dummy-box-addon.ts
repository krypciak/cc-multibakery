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
                guiRefs: Record<string, sc.SmallEntityBox>
                textGetter: (player: dummy.DummyPlayer) => string
                condition: (player: dummy.DummyPlayer) => boolean
                boxTime?: number
                boxAlign?: sc.SmallBoxAlign
                boxOffY?: number
                boxHideSmall?: boolean

                removeAll(this: this): void
                removeFor(this: this, netid: string, skipTransition?: boolean): void
                addFor(this: this, player: dummy.DummyPlayer, skipTransition?: boolean): void
                updateText(this: this, netid: string, newText: string): void
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

            addAddon(this, game)
        },
        removeAll() {
            for (const netid in this.guiRefs) this.removeFor(netid)
        },
        removeFor(netid, skipTransition = false) {
            const gui = this.guiRefs[netid]
            if (!gui) return

            delete this.guiRefs[netid]
            gui.doStateTransition(gui.hideSmall ? 'HIDDEN_SMALL' : 'HIDDEN', skipTransition, true)
        },
        addFor(player, skipTransition = false) {
            assert(!this.guiRefs[player.netid])
            const gui = new sc.SmallEntityBox(
                player,
                this.textGetter(player),
                this.boxTime ?? 1e100,
                this.boxAlign,
                this.boxOffY
            )
            gui.hideSmall = !!this.boxHideSmall
            gui.doStateTransition('DEFAULT', skipTransition)

            this.guiRefs[player.netid] = gui
            ig.gui.addGuiElement(gui)
        },
        updateText(netid, newText) {
            const gui = this.guiRefs[netid]
            if (gui.textGui && gui.textGui.text?.toString() != newText) {
                gui.textGui.setText(newText)
                gui.setSize(gui.textGui.hook.size.x + 16, 11)
            }
        },
        onPostUpdate() {
            const netidsPresent: Record<string, boolean> = {}
            for (const player of ig.game.getEntitiesByType(dummy.DummyPlayer)) {
                netidsPresent[player.netid] = true

                if (!this.guiRefs[player.netid] && this.condition(player)) this.addFor(player)
            }
            for (const netid in this.guiRefs) {
                const player = ig.game.entitiesByNetid[netid] as dummy.DummyPlayer
                if (!netidsPresent[netid] || !this.condition(player)) {
                    this.removeFor(netid)
                } else this.updateText(netid, this.textGetter(player))
            }
        },
    })
}, 2)
