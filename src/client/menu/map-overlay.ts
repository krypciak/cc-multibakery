import { COLOR, wrapColor } from '../../misc/wrap-color'
import { prestart } from '../../loading-stages'
import type { MapName, Username } from '../../net/binary/binary-types'
import type { PlayerInfoEntry } from '../../state/player-info'

declare global {
    namespace sc {
        interface MapFloor {
            roomClases: sc.MapRoom[]
        }
    }
}

interface PlayerDrawer extends ig.GuiElementBase {
    gfx: ig.Image
    floor: sc.MapFloor
}
interface PlayerDrawerConstructor extends ImpactClass<PlayerDrawer> {
    new (floor: sc.MapFloor): PlayerDrawer
}

prestart(() => {
    const iconSize = { x: 280, y: 436, w: 10, h: 9 }

    const PlayerDrawer: PlayerDrawerConstructor = ig.GuiElementBase.extend({
        gfx: new ig.Image('media/gui/menu.png'),

        init(floor) {
            this.parent()
            this.floor = floor
            this.setPos(0, 0)
            this.setSize(floor.hook.size.x, floor.hook.size.y)
        },
        updateDrawables(renderer) {
            this.parent(renderer)

            const drawConfigs: {
                pos: Vec2
                username: Username
            }[] = []

            const playerInfos = multi.server.getPlayerInfoEntries()
            const maps = Object.values(playerInfos).reduce(
                (acc, p) => {
                    ;(acc[p.tpInfo.map] ??= []).push(p)
                    return acc
                },
                {} as Record<MapName, PlayerInfoEntry[]>
            )
            for (const mapName in maps) {
                const mapNameCamel = mapName.toCamel()
                const room = this.floor.roomClases.find(room => room?.name == mapNameCamel || room?.name == mapName)
                if (!room) continue

                const mapRecord = maps[mapName]
                for (const { username, pos } of mapRecord) {
                    const realX = room.hook.pos.x + room.hook.size.x * pos.x
                    const realY = room.hook.pos.y + room.hook.size.y * pos.y

                    drawConfigs.push({ pos: { x: realX, y: realY }, username })
                }
            }

            for (const { pos } of drawConfigs) {
                const x = pos.x - iconSize.w / 2
                const y = pos.y - iconSize.h / 2
                renderer.addGfx(this.gfx, x, y, iconSize.x, iconSize.y, iconSize.w, iconSize.h)
            }
            for (const { pos, username } of drawConfigs) {
                const textBlock = new ig.TextBlock(sc.fontsystem.tinyFont, wrapColor(username, COLOR.YELLOW), {})
                const x = pos.x - textBlock.size.x / 2
                const y = pos.y - textBlock.size.y - iconSize.h / 2
                renderer.addText(textBlock, x, y)
            }
        },
    })

    sc.MapFloor.inject({
        _createIcons(rooms) {
            this.parent(rooms)
            this.roomClases = rooms
        },
        _createRooms() {
            if (!multi.server) return this.parent()

            const rooms = this.parent()

            /* draw in the child instead of in sc.MapFloor itself because
             * the child draw gets called later and doesnt get overdrawn with the map room */
            const drawer = new PlayerDrawer(this)
            this.addChildGui(drawer)

            return rooms
        },
    })
})
