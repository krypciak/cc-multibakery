import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import type { CCMap } from '../../server/ccmap/ccmap'
import type { Client } from '../../client/client'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { InputData } from '../../dummy/dummy-input-puppet'
import type { TestConfig } from '../test-bridge'
import { poststart } from '../../loading-stages'
import { addRuntimeAsset, reloadRuntimeAssets } from '../../misc/runtime-assets'
import { circuitBranchA, circuitBranchB } from '../../misc/godmode'

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
    // await multi.test.waitFrames(inst, 60)
}

export interface CombatArtTestConfig {
    id: string
    name: string

    character: string
    combatArt: keyof typeof sc.PLAYER_ACTION
    element: sc.ELEMENT
    branch: 'A' | 'B'
}

let combatArtMapCounter = 0
class CombatArtTest implements TestConfig {
    id: string
    name: string
    timeout?: number

    baseMapName = 'multibakery/test/combat'
    mapName = this.baseMapName + combatArtMapCounter++

    client!: Client
    map!: CCMap

    constructor(private config: CombatArtTestConfig) {
        this.id = config.id
        this.name = config.name
        this.timeout = 1000e3
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

            // TODO: this doesnt quite match up
            const branch = this.config.branch == 'A' ? circuitBranchA : circuitBranchB

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

        function mapNameToFilePath(name: string) {
            return 'data/maps/' + name + '.json'
        }
        addRuntimeAsset(mapNameToFilePath(this.mapName), mapNameToFilePath(this.baseMapName))
        reloadRuntimeAssets()
        const { client, map } = await multi.test.createClient(this.id, { map: this.mapName }, this)
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

                        const elementName = Object.keys(sc.ELEMENT)[element]
                        const id = `combat_${character}_${elementName}_${type}_${branch}_${level}`
                        const combatArtName = action.name
                        tester.addTest(
                            new CombatArtTest({
                                id,
                                name: `${character} ${elementName} ${type} ${branch} ${level} ${combatArtName}`,
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
