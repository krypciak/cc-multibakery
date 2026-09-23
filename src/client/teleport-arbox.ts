import { Opts } from '../options'
import type { Client } from './client'
import { prestart } from '../loading-stages'
import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { normalizeMapName } from '../server/ccmap/teleport-fix'
import { assert } from '../misc/assert'
import type { CCMap } from '../server/ccmap/ccmap'

declare global {
    namespace ig.ENTITY {
        namespace ARBoxEntity {
            interface Settings extends ig.Entity.Settings {
                text: string
                time: number
                size: Vec3
                usernameShowException?: string
            }
        }
        interface ARBoxEntity extends ig.Entity {
            text: string
            initialTime: number
            timer: number
            usernameShowException?: string
        }
        interface ARBoxEntityConstructor extends ImpactClass<ARBoxEntity> {
            new (x: number, y: number, z: number, settings: ig.ENTITY.ARBoxEntity.Settings): ARBoxEntity
        }
        var ARBoxEntity: ARBoxEntityConstructor
    }
}
prestart(() => {
    ig.ENTITY.ARBoxEntity = ig.Entity.extend({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)

            this.coll.setType(ig.COLLTYPE.NONE)
            this.setSize(settings.size.x, settings.size.y, settings.size.z)

            this.text = settings.text
            this.initialTime = settings.time
            this.usernameShowException = settings.usernameShowException
        },
        show(noShowFx) {
            this.parent(noShowFx)

            this.timer = this.initialTime

            const text = this.text
            const spawnBox = () => {
                const box = new ig.GUI.ARBox(this, text, this.timer, sc.AR_BOX_MODE.NO_LINE, sc.AR_COLOR.GREEN)
                ig.gui.addGuiElement(box)
                return box
            }
            if (ig.mapShared?.ccmap) {
                let clients = ig.mapShared.ccmap.clients
                if (this.usernameShowException) clients = clients.filter(c => c.username != this.usernameShowException)
                const insts = clients.map(c => c.inst)
                runTasks(insts, spawnBox)
            } else {
                spawnBox()
            }
        },
        update() {
            this.parent()
            this.timer -= ig.system.tick
            if (this.timer <= 0) this.kill()
        },
    })
})

const alreadyShownEventCallDataKey = 'alreadyShownTeleportArMsg'

interface PreTeleportInfo {
    map?: CCMap
    pos: Vec3
}
export function getPreTeleportInfoForArMsg(client: Client): PreTeleportInfo {
    return {
        map: client.getMap(true),
        pos: { ...client.dummy.coll.pos },
    }
}

export async function showTeleportArMsg(
    client: Client,
    mapName: string,
    eventCall?: ig.EventCall,
    preTeleportInfo: PreTeleportInfo = getPreTeleportInfoForArMsg(client)
) {
    if (!Opts.showClientLeaveArBox) return
    const map = preTeleportInfo.map
    if (!map) return

    const player = client.dummy
    const { x, y, z } = preTeleportInfo.pos

    mapName = normalizeMapName(mapName)
    const destMap = multi.server.getMap({ map: mapName })
    await runTask(multi.server.inst, () => destMap.initIfNeeded())
    assert(destMap.levelData)
    const { areaTitle, mapTitle } = (await getMapAndAreaTitles(destMap.levelData)) ?? {}

    if (eventCall) {
        const data = (eventCall.data ??= {}) as Record<string, unknown>
        if (data[alreadyShownEventCallDataKey]) return
        data[alreadyShownEventCallDataKey] = true
    }

    const text = areaTitle && mapTitle ? '-> ' + areaTitle + ' - ' + mapTitle : mapName

    runTask(map.inst, () => {
        ig.game.spawnEntity('ARBoxEntity', x, y, z, {
            text,
            time: 1.5,
            size: player.coll.size,
            usernameShowException: player.username,
        })
    })
}

prestart(() => {
    sc.MapModel.inject({
        getTeleportEvent(map) {
            const client = ig.client
            if (!client) return this.parent(map)

            let event = this.parent(map)
            event = new ig.Event({
                steps: [
                    { type: 'RUN_JS_FUNCTION', func: call => showTeleportArMsg(client, map, call) },
                    ...event.stepSettings,
                ],
            })
            return event
        },
    })
})

async function loadArea(areaName: string): Promise<sc.AreaLoadable> {
    return new Promise(resolve => {
        const area = new sc.AreaLoadable(areaName)
        area.load(() => resolve(area))
    })
}

const mapNameToMapDisplayName = new Map<string, { mapTitle: string; areaTitle: string }>()

async function getMapAndAreaTitles(map: sc.MapModel.Map): Promise<{ mapTitle: string; areaTitle: string } | undefined> {
    const mapName = normalizeMapName(map.name)
    if (mapNameToMapDisplayName.has(mapName)) {
        return mapNameToMapDisplayName.get(mapName)
    }

    const areaName: string = map.attributes.area
    const area = await loadArea(areaName)
    const areaTitle = ig.LangLabel.getText(sc.map.areas[areaName].name)

    for (const floor of area.data.floors) {
        for (const map of floor.maps) {
            const mapTitle = ig.LangLabel.getText(map.name)
            const normalizedMapName = normalizeMapName(map.path)
            mapNameToMapDisplayName.set(normalizedMapName, { areaTitle, mapTitle })
        }
    }
    const titles = mapNameToMapDisplayName.get(mapName)
    return titles
}
