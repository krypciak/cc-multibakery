import { prestart } from '../loading-stages'
import { addStateHandler, StateKey } from './states'
import { StateMemory } from './state-util'
import { assert } from '../misc/assert'
import { runTask } from 'cc-instanceinator/src/inst-util'

interface GameModelState {
    map?: sc.GAME_MODEL_STATE
    clients?: Record<string, sc.GAME_MODEL_STATE>
}
declare global {
    interface StateUpdatePacket {
        gameModelState?: GameModelState
    }
    namespace ig {
        var gameModelStateMemory: StateMemory | undefined
        var gameModelStatePlayerMemory: StateMemory.MapHolder<StateKey> | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            const mapMemory = StateMemory.get(ig.gameModelStateMemory)
            ig.gameModelStateMemory ??= mapMemory

            const mapState = mapMemory.diff(sc.model.currentState)
            if (mapState !== undefined) {
                packet.gameModelState ??= {}
                packet.gameModelState.map = mapState
            }

            if (player) {
                ig.gameModelStatePlayerMemory ??= {}
                const playerMemory = StateMemory.getBy(ig.gameModelStatePlayerMemory, player)
                const playerState = playerMemory.diff(player.getClient().inst.sc.model.currentState)
                if (playerState !== undefined) {
                    packet.gameModelState ??= {}
                    packet.gameModelState.clients ??= {}
                    packet.gameModelState.clients[player.username] = playerState
                }
            }
        },
        set(packet) {
            if (!packet.gameModelState) return
            function setState(state: sc.GAME_MODEL_STATE) {
                if (state == sc.GAME_MODEL_STATE.GAME) {
                    sc.model.enterGame()
                } else if (state == sc.GAME_MODEL_STATE.CUTSCENE) {
                    sc.model.enterCutscene()
                }
            }

            if (packet.gameModelState.map !== undefined) {
                setState(packet.gameModelState.map)
            }

            if (packet.gameModelState.clients) {
                for (const username in packet.gameModelState.clients) {
                    const state = packet.gameModelState.clients[username]
                    const client = multi.server.clients.get(username)
                    assert(client)

                    runTask(client.inst, () => setState(state))
                }
            }
        },
    })
})
