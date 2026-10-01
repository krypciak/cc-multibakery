import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import type { CCMap } from '../server/ccmap/ccmap'
import type { Client } from './client'
import { runEvent } from '../steps/event-steps-run'
import { isRemote } from '../server/remote/remote-server-types'
import { Opts } from '../options'

export function showJoinAnimation(client: Client, map: CCMap) {
    client.dummy.animState.alpha = 0
    if (isRemote(multi.server)) return
    if (!Opts.showClientJoinAnimation) return

    runTask(map.inst, () => {
        const player = client.dummy
        const { x, y, z } = player.coll.pos
        const fakeEntity = ig.game.spawnEntity('GhostAnimatedEntity', x, y, z, { size: player.coll.size })
        fakeEntity.coll.setType(ig.COLLTYPE.NONE)

        const text = {
            en_US: 'Initializing avatar',
            de_DE: 'Initialisiere Avatar',
            zh_CN: '\u865a\u62df\u4eba\u7269\u521d\u59cb\u5316',
            ja_JP: '\u30a2\u30d0\u30bf\u30fc\u521d\u671f\u5316\u4e2d',
            ko_KR: '\uc544\ubc14\ud0c0 \ucd08\uae30\ud654 \uc911',
            zh_TW: '\u865b\u64ec\u4eba\u7269\u521d\u59cb\u5316',
        }

        const long = false
        const time = long ? 4 : 1

        const arMsgEvent = new ig.Event({
            steps: [
                {
                    type: 'SHOW_AR_MSG',
                    entity: player,
                    text,
                    mode: 'LINE_FILL',
                    color: 'GREEN',
                    hideOutsideOfScreen: false,
                    time,
                },
            ],
        })

        const blockingEvent = new ig.Event({
            steps: [
                {
                    type: 'SET_CAMERA_TARGET',
                    entity: player,
                    offsetX: 0,
                    offsetY: 0,
                    speed: 'IMMEDIATELY',
                    transition: 'EASE',
                    wait: true,
                    waitSkip: 0,
                    zoom: 2,
                },
                {
                    type: 'SHOW_EFFECT',
                    entity: player,
                    duration: 0,
                    align: 'BOTTOM',
                    group: '',
                    wait: false,
                    waitSkip: 0,
                    effect: { sheet: 'teleport', name: long ? 'showSlow' : 'showDefault' },
                    offset: { x: 0, y: 0, z: 0 },
                },
                {
                    type: 'SET_CAMERA_ZOOM',
                    zoom: 1,
                    duration: time,
                    transition: 'EASE_OUT',
                },
                { type: 'WAIT', time },
                { type: 'RUN_JS_FUNCTION', func: () => fakeEntity.kill() },
            ],
        })

        runTask(client.inst, () => runEvent({ event: blockingEvent, type: ig.EventRunType.BLOCKING }))

        const insts = ig.mapShared.ccmap.getClientInstances()
        runTasks(insts, () => runEvent({ event: arMsgEvent, type: ig.EventRunType.INTERRUPTABLE }))
    })
}
