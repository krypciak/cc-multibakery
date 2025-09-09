import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { getDummyBoxGuiConfigs } from './configs'
import { runTask } from 'cc-instanceinator/src/inst-util'

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

export interface DummyBoxGuiConfig {
    yPriority: number
    hideSmall?: boolean
    time?: number

    textGetter: (player: dummy.DummyPlayer) => string | undefined
    condition: (player: dummy.DummyPlayer) => boolean
    onCreate?: (box: dummy.BoxGuiAddon.SmallEntityBox, player: dummy.DummyPlayer) => void
    onRemove?: (player: dummy.DummyPlayer) => void
}

declare global {
    namespace dummy {
        namespace BoxGuiAddon {
            interface SmallEntityBox extends sc.SmallEntityBox {
                entity: dummy.DummyPlayer
                config: DummyBoxGuiConfig
                onRemove?: () => void

                isBoxVisible(this: this): boolean
                updateOffsetY(this: this, y: number): void
            }
            interface SmallEntityBoxConstructor extends ImpactClass<SmallEntityBox> {
                new (player: dummy.DummyPlayer, config: DummyBoxGuiConfig, onRemove: () => void): SmallEntityBox
            }
            var SmallEntityBox: SmallEntityBoxConstructor

            interface BoxGuiAddon extends ig.GameAddon {
                guis: Map<dummy.DummyPlayer, Map<DummyBoxGuiConfig, SmallEntityBox>>
                configs: DummyBoxGuiConfig[]

                rearrangeBoxes(this: this, player: dummy.DummyPlayer): void
                removeFor(this: this, player: dummy.DummyPlayer, config: DummyBoxGuiConfig): void
                addFor(this: this, player: dummy.DummyPlayer, config: DummyBoxGuiConfig): void
                updateText(this: this, player: dummy.DummyPlayer, newText: string): void
                reorderBoxes(this: this): void
            }
            interface BoxGuiAddonConstructor extends ImpactClass<BoxGuiAddon> {
                new (game: ig.Game): BoxGuiAddon
            }
            var BoxGuiAddon: BoxGuiAddonConstructor
        }
    }
}

prestart(() => {
    dummy.BoxGuiAddon ??= {} as any
    dummy.BoxGuiAddon.SmallEntityBox = sc.SmallEntityBox.extend({
        init(player, config, onRemove) {
            this.parent(player, config.textGetter(player) ?? '', config.time ?? 1e100, sc.SMALL_BOX_ALIGN.TOP)
            this.config = config
            this.onRemove = onRemove

            this.hideSmall = !!config.hideSmall

            config.onCreate?.(this, player)

            ig.gui.addGuiElement(this)
        },
        remove() {
            if (this.finished) return
            runTask(instanceinator.instances[this._instanceId], () => {
                this.parent()
                this.onRemove?.()
                this.config.onRemove?.(this.entity)
            })
        },
        update() {
            this.parent()

            if (!this.isBoxVisible()) return

            const newText = this.config.textGetter(this.entity)
            if (newText && this.textGui.text?.toString() != newText) {
                this.textGui.setText(newText)
                this.setSize(this.textGui.hook.size.x + 16, 11)
                this.setPivot(this.hook.size.x / 2, this.hook.size.y / 2)
            }
        },
        isBoxVisible() {
            return this.hook.currentStateName == 'DEFAULT'
        },
        updateOffsetY(y) {
            this.offY = y
        },
    })

    dummy.BoxGuiAddon.BoxGuiAddon = ig.GameAddon.extend({
        init(game) {
            this.parent('dummy.BoxGuiAddon.BoxGuiAddon')

            this.guis = new Map()
            this.configs = getDummyBoxGuiConfigs()

            addAddon(this, game)
        },
        rearrangeBoxes(player) {
            const configMap = this.guis.get(player)
            assert(configMap)
            let y = 0
            for (const gui of [...configMap.values()].sort((a, b) => a.config.yPriority - b.config.yPriority)) {
                if (!gui.isBoxVisible()) continue
                gui.updateOffsetY(y)
                y += 11
            }
        },
        removeFor(player, config) {
            const configMap = this.guis.get(player)!
            const gui = configMap.get(config)
            if (!gui) return
            configMap.delete(config)
            gui.onRemove = undefined
            gui.remove()
            this.rearrangeBoxes(player)
        },
        addFor(player, config) {
            const configMap = this.guis.get(player)!

            assert(!configMap.has(config))
            const gui = new dummy.BoxGuiAddon.SmallEntityBox(player, config, () => {
                this.removeFor(player, config)
            })

            configMap.set(config, gui)
            this.rearrangeBoxes(player)
        },
        onPreUpdate() {
            const playersPresent: Set<dummy.DummyPlayer> = new Set()

            for (const player of ig.game.getEntitiesByType(dummy.DummyPlayer)) {
                let configMap = this.guis.get(player)
                if (!configMap) {
                    configMap = new Map()
                    this.guis.set(player, configMap)
                }

                for (const config of this.configs) {
                    const gui = configMap.get(config)
                    if (gui && gui.entity != player) continue
                    playersPresent.add(player)

                    if (!gui && config.condition(player)) this.addFor(player, config)
                }
            }

            for (const player of this.guis.keys()) {
                if (!playersPresent.has(player)) {
                    for (const config of this.configs) this.removeFor(player, config)
                } else {
                    for (const config of this.configs) {
                        if (!config.condition(player)) {
                            this.removeFor(player, config)
                        }
                    }
                }
            }
        },
    })
}, 2)
