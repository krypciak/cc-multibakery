import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import type { CCMap } from '../server/ccmap/ccmap'
import type { Client } from './client'
import { runEvent } from '../steps/event-steps-run'
import { isRemote } from '../server/remote/remote-server-types'
import { Opts } from '../options'
import { prestart } from '../loading-stages'

export function showJoinAnimation(client: Client, map: CCMap) {
    client.dummy.animState.alpha = 0
    if (isRemote(multi.server)) return
    if (!Opts.showClientJoinAnimation) return

    runTask(map.inst, () => {
        const player = client.dummy

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
            ],
        })

        runTask(client.inst, () => runEvent({ event: blockingEvent, type: ig.EventRunType.BLOCKING }))

        const insts = ig.mapShared.ccmap.getClientInstances()
        runTasks(insts, () => runEvent({ event: arMsgEvent, type: ig.EventRunType.INTERRUPTABLE }))
    })
}

export function showLeaveAnimation(client: Client) {
    if (isRemote(multi.server)) return
    if (!Opts.showClientLeaveAnimation) return

    const map = client.getMap(true)
    if (!map) return

    runTask(map.inst, () => {
        const player = client.dummy
        const { x, y, z } = player.coll.pos
        const fakeEntity = ig.game.spawnEntity(
            'GhostActorEntity',
            x,
            y,
            z,
            ig.ENTITY.GhostActorEntity.settingsFromBaseEntity(player)
        )

        const isCrash = client.kickReason == 'crash'
        const { blockingEvent, arMsgEvent } = isCrash
            ? getCrashAnimationEvents(fakeEntity)
            : getLeaveAnimationEvents(fakeEntity)

        runTask(map.inst, () => runEvent({ event: blockingEvent, type: ig.EventRunType.INTERRUPTABLE }))

        const insts = ig.mapShared.ccmap.getClientInstances()
        runTasks(insts, () => runEvent({ event: arMsgEvent, type: ig.EventRunType.INTERRUPTABLE }))
    })
}

function getLeaveAnimationEvents(fakeEntity: ig.ENTITY.GhostActorEntity) {
    const text = {
        en_US: 'Logout',
        de_DE: 'Logout',
        zh_CN: '\u767b\u51fa<<A<<[CHANGED 2018/08/28]',
        ja_JP: '\u30ed\u30b0\u30a2\u30a6\u30c8<<A<<[CHANGED 2018/08/28]',
        ko_KR: '\ub85c\uadf8\uc544\uc6c3<<A<<[CHANGED 2018/08/28]',
        zh_TW: '\u767b\u51fa<<A<<[CHANGED 2018/08/28]',
    }

    const time = 1.2

    const arMsgEvent = new ig.Event({
        steps: [
            {
                type: 'SHOW_AR_MSG',
                entity: fakeEntity,
                text,
                mode: 'NO_LINE',
                color: 'RED',
                hideOutsideOfScreen: false,
                time,
            },
        ],
    })

    const blockingEvent = new ig.Event({
        steps: [
            {
                type: 'SHOW_EFFECT',
                entity: fakeEntity,
                duration: 0,
                align: 'BOTTOM',
                group: '',
                wait: false,
                waitSkip: 0,
                effect: { sheet: 'teleport', name: 'hideDefault' },
                offset: { x: 0, y: 0, z: 0 },
            },
            { type: 'WAIT', time },
            { type: 'RUN_JS_FUNCTION', func: () => fakeEntity.kill() },
        ],
    })
    return { arMsgEvent, blockingEvent }
}

const explodeEffectConfig = { sheet: 'scene.designer', name: 'instantExplode' }
prestart(() => {
    new ig.EffectHandle(explodeEffectConfig)
})

function getCrashAnimationEvents(fakeEntity: ig.ENTITY.GhostActorEntity) {
    const text = {
        en_US: 'Unexpected Error',
        de_DE: 'Unerwarteter Fehler',
        fr_FR: 'fr_FR',
        zh_CN: '\u672a\u77e5\u9519\u8bef',
        ja_JP: '\u4e88\u671f\u3057\u306a\u3044\u30a8\u30e9\u30fc<<A<<[CHANGED 2017/08/03]',
        langUid: 650,
        ko_KR: '\uc608\uc0c1\uce58 \ubabb\ud55c \uc624\ub958',
        zh_TW: '\u672a\u77e5\u932f\u8aa4',
    }

    const time = 2

    const arMsgEvent = new ig.Event({
        steps: [
            {
                type: 'SHOW_AR_MSG',
                entity: fakeEntity,
                text,
                mode: 'NO_LINE',
                color: 'RED',
                hideOutsideOfScreen: false,
                time,
            },
        ],
    })

    const blockingEvent = new ig.Event({
        steps: [
            {
                type: 'SHOW_EFFECT',
                entity: fakeEntity,
                group: '',
                duration: 0,
                align: 'BOTTOM',
                wait: true,
                waitSkip: 0,
                effect: explodeEffectConfig,
                offset: { x: 0, y: 0, z: 0 },
            },
            { type: 'HIDE_ENTITY', entity: fakeEntity, skipEffects: false },
            { type: 'WAIT', time },
            { type: 'RUN_JS_FUNCTION', func: () => fakeEntity.kill() },
        ],
    })
    return { arMsgEvent, blockingEvent }
}
