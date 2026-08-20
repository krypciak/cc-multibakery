import { prestart } from '../../loading-stages'
import type { EntityNetid } from '../../misc/entity-netid'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'
import { shouldCollectStateData } from '../state-util'

export interface CollectedSound {
    type: 'sound'
    sound: {
        path: string
        volume: number
        variance: number
        group?: string
    }
    netid?: EntityNetid
    settings?: ig.SoundPlaySettings
    range?: number
    soundType?: ig.SOUND_RANGE_TYPE
}

declare global {
    interface MapStateOrderedEvents {
        entitySound: CollectedSound
    }
}
registerOrderedEvent('sound', {
    set({ sound: soundSettings, netid, settings, range, soundType }) {
        const { path, volume, variance, group } = soundSettings
        const sound = new ig.Sound(path, volume, variance, group)
        if (netid) {
            const entity = ig.game.entitiesByNetid[netid]
            if (!entity) return

            ig.SoundHelper.playAtEntity(sound, entity, false, settings, range, soundType)
        } else {
            sound.play(undefined, settings)
        }
    },
})

function getSoundSettings(sound: ig.SoundWebAudio) {
    return {
        path: sound.webAudioBuffer.path,
        volume: sound.volume,
        variance: sound.variance,
        group: sound.group == sound.webAudioBuffer.path ? undefined : sound.group,
    }
}
function getSoundPlaySettings(settings?: Nullable<ig.SoundPlaySettings>) {
    if (!settings) return undefined

    return {
        fadeDuration: settings.fadeDuration,
        offset: settings.offset,
        startTime: settings.startTime,
        speed: settings.speed,
    }
}

let isCollecting = 0
prestart(() => {
    ig.SoundWebAudio.inject({
        play(pos, settings) {
            if (isCollecting > 0 && shouldCollectStateData()) {
                pushOrderedEvent({
                    type: 'sound',
                    sound: getSoundSettings(this),
                    settings: getSoundPlaySettings(settings),
                })
            }
            return this.parent(pos, settings)
        },
    })
})

export function wrapCollectSounds<T>(func: () => T): T {
    if (!shouldCollectStateData()) return func()

    const orig = ig.SoundHelper.playAtEntity
    isCollecting++
    try {
        ig.SoundHelper.playAtEntity = (sound, entity, isLooped, settings, range, type) => {
            if (sound && entity.netid && !isLooped) {
                pushOrderedEvent({
                    type: 'sound',
                    sound: getSoundSettings(sound),
                    netid: entity.netid,
                    settings: getSoundPlaySettings(settings),
                    range,
                    soundType: type,
                })
            }
            return orig(sound, entity, isLooped, settings, range, type)
        }
        return func()
    } finally {
        ig.SoundHelper.playAtEntity = orig
        isCollecting--
    }
}
