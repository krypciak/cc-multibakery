import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

export function linkMusic(to: InstanceinatorInstance, from: InstanceinatorInstance) {
    to.ig.music = from.ig.music
}
