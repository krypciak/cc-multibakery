import { Opts } from '../options'
import type { Client } from './client'
import { prestart } from '../loading-stages'
import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { normalizeMapName } from '../server/ccmap/teleport-fix'
import { assert } from '../misc/assert'
import type { CCMap } from '../server/ccmap/ccmap'
import { runEvent } from '../steps/event-steps-run'

import './teleport-method'

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
    const method = client.teleportOverrides.teleportMethod
    if (method == 'TeleportGround') {
        if (!Opts.showClientTeleportArBoxTeleportGround) return
    } else if (method == 'Door') {
        if (!Opts.showClientTeleportArBoxDoor) return
    } else if (method == 'TeleportStairs') {
        if (!Opts.showClientTeleportArBoxTeleportStairs) return
    } else if (method == 'TeleportField') {
        if (!Opts.showClientTeleportArBoxTeleportField) return
    } else if (!Opts.showClientTeleportArBoxOther) return

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

    runTask(map.inst, () => {
        const fakeEntity = ig.game.spawnEntity(
            'GhostActorEntity',
            x,
            y,
            z,
            ig.ENTITY.GhostActorEntity.settingsFromBaseEntity(player, true)
        )

        const text = areaTitle && mapTitle ? '-> ' + areaTitle + ' - ' + mapTitle : mapName

        const time = 1.5
        const event = new ig.Event({
            steps: [
                {
                    type: 'SHOW_AR_MSG',
                    entity: fakeEntity,
                    text,
                    mode: 'LINE_EMPTY',
                    color: 'GREEN',
                    hideOutsideOfScreen: false,
                    time,
                },
                { type: 'WAIT', time },
                { type: 'RUN_JS_FUNCTION', func: () => fakeEntity.kill() },
            ],
        })

        const usernameShowException = player.username
        const clients = ig.mapShared.ccmap.clients.filter(c => c.username != usernameShowException)

        const insts = clients.map(c => c.inst)
        runTasks(insts, () => runEvent({ event, type: ig.EventRunType.INTERRUPTABLE }))
    })
}

prestart(() => {
    sc.MapModel.inject({
        getTeleportEvent(map) {
            let event = this.parent(map)

            const client = ig.client
            if (client) {
                event = new ig.Event({
                    steps: [
                        { type: 'RUN_JS_FUNCTION', func: call => showTeleportArMsg(client, map, call) },
                        ...event.stepSettings,
                    ],
                })
            }

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
