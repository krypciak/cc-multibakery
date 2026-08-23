import { StateMemory } from './state-util'
import type { MapStateHandler } from './map-state-handlers'

declare global {
    interface StateUpdatePacket {
        gameModelState?: sc.GAME_MODEL_STATE
    }
    namespace ig {
        interface MapSharedVars {
            gameModelStateMemory?: StateMemory
        }
    }
}

export function setGameModelState(state: sc.GAME_MODEL_STATE) {
    if (state == sc.GAME_MODEL_STATE.GAME) {
        sc.model.enterGame()
    } else if (state == sc.GAME_MODEL_STATE.CUTSCENE) {
        sc.model.enterCutscene()
    }
}

export const gameModelStateMapStateHandler: MapStateHandler = {
    get(packet) {
        const mapMemory = StateMemory.get(ig.mapShared.gameModelStateMemory)
        ig.mapShared.gameModelStateMemory ??= mapMemory
        packet.gameModelState = mapMemory.diff(sc.model.currentState)
    },
    set(packet) {
        if (packet.gameModelState === undefined) return
        setGameModelState(packet.gameModelState)
    },
}
