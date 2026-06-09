import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import type { CCMap } from '../../server/ccmap/ccmap'
import type { Client } from '../../client/client'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { InputData } from '../../dummy/dummy-input-puppet'
import type { TestConfig } from '../test-bridge'
import { poststart } from '../../loading-stages'

async function executeCombatArt(
    e: dummy.DummyPlayer,
    inst: InstanceinatorInstance,
    element: sc.ELEMENT,
    combatArt: keyof typeof sc.PLAYER_ACTION
) {
    const input = e.inputManager
    assert(input instanceof dummy.input.Puppet.InputManager)

    const emptyInput = {
        currentDevice: ig.INPUT_DEVICES.GAMEPAD,
        presses: {
            special: false,
        },
        actions: {
            special: false,
        },
        mouse: {
            x: 0.3 * ig.system.width,
            y: 0.5 * ig.system.height,
        },
    } satisfies Partial<InputData> as NonNullable<InputData>

    e.model.params.currentSp = e.model.params.maxSp
    e.model.setElementMode(element)

    const chargeInp = ig.copy(emptyInput)
    const triggerActions: ig.Input.KnownAction[] = []
    let preFrames = 0
    if (combatArt.startsWith('ATTACK')) {
    } else if (combatArt.startsWith('GUARD')) {
        triggerActions.push('guard')
        preFrames = 17
    } else if (combatArt.startsWith('THROW')) {
        triggerActions.push('aim')
    } else if (combatArt.startsWith('DASH')) {
        triggerActions.push('dash')
        triggerActions.push('left')
    } else assert(false)

    for (const action of triggerActions) {
        chargeInp['actions']![action] = true
        chargeInp['presses']![action] = true
    }

    input.mainInputData.pushInput(chargeInp)

    for (let frame = 0; frame < preFrames; frame++) {
        await scheduleTask(inst, () => {
            input.mainInputData.pushInput(ig.copy(chargeInp))
        })
    }

    chargeInp['actions']!['special'] = true
    chargeInp['presses']!['special'] = true

    const chargeLevel = parseInt(combatArt[combatArt.length - 1])
    const chargeTime = chargeLevel * 8
    for (let frame = 0; frame < chargeTime; frame++) {
        await scheduleTask(inst, () => {
            input.mainInputData.pushInput(ig.copy(chargeInp))
            for (const action of triggerActions) {
                chargeInp['actions']![action] = false
                chargeInp['presses']![action] = false
            }
        })
    }

    input.mainInputData.pushInput(emptyInput)

    await multi.test.updateLoop(inst, () => e.state == 0 && !e.currentAction)
    await multi.test.waitFrames(inst, 60)
}

export interface CombatArtTestConfig {
    id: string
    name: string

    character: string
    combatArt: keyof typeof sc.PLAYER_ACTION
    element: sc.ELEMENT
    branch: 'A' | 'B'
}

class CombatArtTest implements TestConfig {
    id: string
    name: string
    timeout?: number

    mapName = 'multibakery/test/combat'

    client!: Client
    map!: CCMap

    constructor(private config: CombatArtTestConfig) {
        this.id = config.id
        this.name = config.name
        // this.timeout = 10e3
    }

    private setupPlayerModel() {
        runTask(this.client.inst, () => {
            const model = sc.model.player

            const config = sc.party.models[this.config.character].config
            sc.model.player.setConfig(config)

            for (const k of Object.keysT(model.core)) {
                model.core[k] = true
            }

            model.spLevel = 4
            model.params.setMaxSp(sc.SP_LEVEL[model.spLevel])
            model.level = 99

            // prettier-ignore
            const branchA = [0, 1, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 33, 35, 36, 37, 38, 39, 40, 41, 42, 44, 46, 48, 49, 50, 51, 52, 53, 54, 55, 57, 59, 61, 62, 63, 65, 67, 69, 70, 71, 72, 74, 76, 78, 79, 80, 81, 82, 84, 85, 86, 87, 88, 89, 90, 91, 93, 95, 97, 99, 101, 103, 104, 105, 106, 107, 108, 109, 110, 111, 113, 115, 117, 118, 120, 122, 124, 125, 126, 128, 130, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 145, 147, 149, 151, 153, 155, 156, 157, 158, 160, 162, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 179, 181, 183, 185, 187, 189, 190, 191, 192, 193, 194, 195, 196, 197, 199, 201, 203, 204, 206, 208, 210, 211, 212, 213, 214, 216, 218, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 231, 233, 235, 236, 238, 240, 242, 243, 244, 245, 246, 248, 250, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 266, 268, 270, 272, 274, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 287, 289, 291, 293, 295, 297, 298, 299, 300, 302, 304, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 319, 321, 323, 324, 326, 328, 330, 331, 332, 334, 336, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 354, 356, 358, 360, 362, 364, 365, 366, 367, 368, 369, 370, 371, 373, 375, 377, 378, 379, 381, 383, 385, 386, 387, 388, 390, 392, 394, 395, 396, 397, 398, 399]
            const branch = branchA

            for (const id of branch) {
                // @ts-expect-error
                if (sc.skilltree.skills[id].statType == 'SPIKE_DMG') continue
                // model.learnSkill
                model.skills[id] = sc.skilltree.skills[id]
            }

            sc.Model.notifyObserver(model, sc.PLAYER_MSG.LEVEL_CHANGE, null)
            sc.Model.notifyObserver(model, sc.PARTY_MEMBER_MSG.LEVEL_CHANGE)
            sc.Model.notifyObserver(model.params, sc.COMBAT_PARAM_MSG.MAX_SP_CHANGED)
            sc.Model.notifyObserver(model, sc.PLAYER_MSG.SKILL_CHANGED)
            model.updateStats()

            ig.chargeTimings = [0.1, 0.2, 0.3]
        })
    }

    async run() {
        await multi.test.setupServerIfNeeded()
        const { client, map } = await multi.test.createClient({ map: this.mapName }, this)
        this.client = client
        this.map = map
        this.setupPlayerModel()

        await executeCombatArt(this.client.dummy, this.client.inst, this.config.element, this.config.combatArt)
    }

    cleanup() {
        if (!multi.server) return
        if (this.client) multi.server.leaveClient(this.client)
        if (this.map) multi.server.unloadMap(this.map)
    }
}

poststart(() => {
    for (const character of ['Lea']) {
        const model = sc.party.models[character]
        assert(model)
        for (let element = 0 as sc.ELEMENT; element <= sc.ELEMENT.WAVE; element++) {
            for (let level = 1; level <= 3; level++) {
                for (const type of ['ATTACK', 'THROW', 'GUARD', 'DASH']) {
                    for (const branch of ['A', 'B'] as const) {
                        const combatArt = (type + '_SPECIAL' + level) as keyof typeof sc.PLAYER_ACTION
                        const actionName = combatArt + '_' + branch

                        const action = model.elementConfigs[element].actions[actionName]
                        if (!action) continue

                        const id = `${character}_${element}_${type}_${branch}_${level}`
                        tester.addTest(
                            new CombatArtTest({
                                id,
                                name: 'combat art test',
                                character,
                                element,
                                combatArt,
                                branch,
                            })
                        )
                    }
                }
            }
        }
    }
})
