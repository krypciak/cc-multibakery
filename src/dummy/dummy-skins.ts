import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { RemoteServer } from '../server/remote/remote-server'

export type PlayerSkin = string

declare global {
    namespace dummy {
        interface DummyPlayer {
            currentSkinName?: string

            setSkin(this: this, skinName: string | undefined, noSpawnFx: boolean): void
        }
    }
}

prestart(() => {
    const skinCache: WeakMap<dummy.DummyPlayer, sc.PLAYER_SKIN.Appearance | undefined | true> = new WeakMap()

    dummy.DummyPlayer.inject({
        setSkin(skinName, noSpawnFx) {
            this.currentSkinName = skinName || undefined
            this.updateAnimSheet(noSpawnFx)
        },
        updateAnimSheet(noSpawnFx) {
            const skinName = this.currentSkinName
            let skin: sc.PLAYER_SKIN.Appearance | undefined
            if (skinName) {
                const cached = skinCache.get(this)
                if (cached !== true) {
                    if (cached?.name == skinName) {
                        skin = cached
                    } else {
                        skinCache.set(this, true)
                        skin = sc.playerSkins._createSkin(skinName) as sc.PLAYER_SKIN.Appearance
                        skinCache.set(this, skin)
                    }
                }
            }

            const client = this.getClient(true)
            if (client) {
                runTask(client.inst, () => {
                    sc.playerSkins.currentSkins['Appearance'] = skin
                })
            }

            const backup = sc.playerSkins.getCurrentSkin
            sc.playerSkins.getCurrentSkin = function (this: sc.PlayerSkinLibrary, _type: string) {
                return skin as any
            }
            this.parent(noSpawnFx)

            sc.playerSkins.getCurrentSkin = backup
        },
    })

    sc.PlayerSkinLibrary.inject({
        updateSkinSet(type) {
            this.parent(type)
            if (!ig.client) return
            assert(ig.game.playerEntity instanceof dummy.DummyPlayer)
            ig.game.playerEntity.setSkin(this.getCurrentSkin('Appearance')?.name, false)
        },
        _notifyLoaded(skin) {
            this.parent(skin)
            if (!multi.server || multi.server.inst.id != instanceinator.id) return

            for (const map of multi.server.maps.values()) {
                if (!map.ready) continue
                runTask(map.inst, () => {
                    sc.playerSkins._notifyLoaded(skin)
                })
            }
        },
    })
})

prestart(() => {
    if (!REMOTE) return

    dummy.DummyPlayer.inject({
        updateAnimSheet(noSpawnFx) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(noSpawnFx)
            this.parent(true)
        },
    })

    sc.PlayerSkinLibrary.inject({
        checkItemSet(toggleSetName) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(toggleSetName)
        },
    })
})
