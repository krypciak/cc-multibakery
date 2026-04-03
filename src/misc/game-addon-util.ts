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
