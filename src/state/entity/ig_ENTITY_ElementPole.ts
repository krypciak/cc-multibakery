import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { isRemote } from '../../server/remote/remote-server-types'

declare global {
    namespace ig.ENTITY {
        interface ElementPole extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.ElementPole': Return
    }
}

function getLightHandleConfigs(pole: ig.ENTITY.ElementPole) {
    return pole.charge.lightHandles.map(h => h.offset!.z)
}

type StateType = 'NONE' | 'TMP' | 'GROUP' | 'DISCHARGE' // 'PENDING' |
const capturedStateObject: PartialRecord<StateType, ig.ENTITY.ElementPole.State> = {}

function capturePoleStateObjects() {
    const pole = new ig.ENTITY.ElementPole(0, 0, 0, {})
    pole.active = true

    capturedStateObject.NONE = pole.charge.state

    pole.discharge()
    capturedStateObject.DISCHARGE = pole.charge.state

    pole.onComplete()
    capturedStateObject.GROUP = pole.charge.state

    capturedStateObject.TMP = sc.ElementPoleGroups.getChargeState({} as any)
}

function getPoleStateKey(pole: ig.ENTITY.ElementPole): StateType {
    if (!capturedStateObject.NONE) capturePoleStateObjects()
    const s = pole.charge.state
    if (s == capturedStateObject.NONE) return 'NONE'
    if (s == capturedStateObject.DISCHARGE) return 'DISCHARGE'
    if (s == capturedStateObject.GROUP) return 'GROUP'
    if (s == capturedStateObject.TMP) return 'TMP'
    return 'NONE'
}

function getPoleStateObject(key: StateType): ig.ENTITY.ElementPole.State {
    if (!capturedStateObject.NONE) capturePoleStateObjects()
    return capturedStateObject[key]!
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.ElementPole, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
        active: memory.diff(this.active),
        element: memory.diff(this.charge.element),
        prevElement: memory.diff(this.charge.prevElement),
        lightHandles: memory.diffArray(getLightHandleConfigs(this)),
        state: memory.diff(getPoleStateKey(this)),
        timerTime: memory.diff(this.charge.timer.timer),
        timerDuration: memory.diff(this.charge.timer.duration),
    }
}

function setEntityState(this: ig.ENTITY.ElementPole, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.active !== undefined) {
        this.active = state.active
    }
    if (state.element !== undefined) {
        this.charge.element = state.element
    }
    if (state.prevElement !== undefined) {
        this.charge.prevElement = state.prevElement
    }

    if (state.lightHandles) {
        for (const handle of this.charge.lightHandles) handle.stop()
        this.charge.lightHandles.length = 0
        for (const z of state.lightHandles) this.addLight(z)
    }

    if (state.state) {
        this.charge.state = getPoleStateObject(state.state)
    }

    if (state.timerTime !== undefined) {
        this.charge.timer.timer = state.timerTime
    }

    if (state.timerDuration !== undefined) {
        this.charge.timer.duration = state.timerDuration
    }
}

prestart(() => {
    ig.ENTITY.ElementPole.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.ElementPole.create = () => {
        throw new Error('ig.ENTITY.ElementPole.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.ElementPole, isStatic: true })
}, 2)

prestart(() => {
    ig.ENTITY.ElementPole.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()

            ig.AnimatedEntity.prototype.update.call(this)
        },
    })
})
