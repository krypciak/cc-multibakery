import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import { CCMap } from '../../server/ccmap/ccmap'
import type { Client } from '../../client/client'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { InputData } from '../../dummy/dummy-input-puppet'
import type { TestConfig } from '../test-bridge'
import { poststart } from '../../loading-stages'
import type { StoragePlayerState } from '../../server/physics/storage/storage'
import type { MapTpInfo } from '../../server/server'

const enemyType = 'autumn-rh.practice-bot'

async function executeCombatArt(
    e: dummy.DummyPlayer,
    inst: InstanceinatorInstance,
    combatArt: keyof typeof sc.PLAYER_ACTION
) {
    const input = e.inputManager
    assert(input instanceof dummy.input.Puppet.InputManager)

    const emptyInput = {
        currentDevice: ig.INPUT_DEVICES.GAMEPAD,
        presses: {
            special: false,
            guard: false,
            aim: false,
            dash: false,
            left: false,
        },
        actions: {
            special: false,
            guard: false,
            aim: false,
            dash: false,
            left: false,
        },
        mouse: {
            x: 0.3 * ig.system.width,
            y: 0.5 * ig.system.height,
        },
    } satisfies Partial<InputData> as NonNullable<InputData>

    const combartArtTypeConfigMap: Record<string, { triggerActions: ig.Input.KnownAction[]; preFrames: number }> = {
        ATTACK: { triggerActions: [], preFrames: 0 },
        GUARD: { triggerActions: ['guard'], preFrames: 18 },
        THROW: { triggerActions: ['aim'], preFrames: 21 },
        DASH: { triggerActions: ['dash', 'left'], preFrames: 6 },
    }
    const combatArtType = combatArt.split('_')[0]
    const { triggerActions, preFrames } = combartArtTypeConfigMap[combatArtType]

    const chargeInp = ig.copy(emptyInput)
    function setAction(action: ig.Input.KnownAction, value: boolean) {
        chargeInp['actions']![action] = value
        chargeInp['presses']![action] = value
    }

    for (const action of triggerActions) setAction(action, true)

    input.mainInputData.pushInput(chargeInp)

    await multi.test.updateLoop(inst, preFrames, () => {
        input.mainInputData.pushInput(ig.copy(chargeInp))
    })

    setAction('special', true)

    const entitiesSpawned: ig.Entity[] = []

    if (combatArtType == 'GUARD') {
        runTask(inst, () => {
            const { x, y, z } = e.coll.pos
            ig.vars.set('tmp.practiceAttack', true)
            const enemy = ig.game.spawnEntity('Enemy', x - 32, y, z, {
                enemyInfo: { type: enemyType, level: 1 },
            })
            entitiesSpawned.push(enemy)
            enemy.enemyType.assignTarget(enemy, e, false, true)
        })
    }

    const chargeLevel = parseInt(combatArt[combatArt.length - 1])
    const chargeTime = chargeLevel * 4
    await multi.test.updateLoop(inst, chargeTime, () => {
        input.mainInputData.pushInput(ig.copy(chargeInp))
        for (const action of triggerActions) setAction(action, false)
    })

    input.mainInputData.pushInput(emptyInput)

    function getSpawnedEntities(hexaProps?: boolean) {
        function shouldInclude(e: ig.Entity): boolean {
            if (
                e instanceof ig.ENTITY.Marker ||
                e instanceof ig.ENTITY.Enemy ||
                e instanceof dummy.DummyPlayer ||
                e instanceof ig.ENTITY.Crosshair ||
                e instanceof ig.ENTITY.CrosshairDot
            ) {
                return false
            }
            if (!hexaProps && e instanceof sc.CombatProxyEntity && e.proxyType.includes('waveRecall')) return false
            if (e instanceof ig.ENTITY.Effect && e.target) return shouldInclude(e.target)

            return true
        }
        return ig.game.entities.filter(shouldInclude)
    }

    await multi.test.updateLoop(
        inst,
        multi.server.settings.gameTps * 30,
        () => e.state == 0 && !e.currentAction && getSpawnedEntities().length == 0
    )
    runTask(inst, () => {
        for (const entity of [...entitiesSpawned, ...getSpawnedEntities(true)]) {
            entity.kill()
        }
    })
}

export interface CombatArtTestConfig {
    id: string
    name: string

    character: string
    combatArt: keyof typeof sc.PLAYER_ACTION
    element: sc.ELEMENT
    branch: 'A' | 'B'

    tilingOrder?: number

    remote?: boolean
}

class CombatArtTest implements TestConfig {
    id: string
    name: string
    timeout?: number

    tpInfo: MapTpInfo = { map: 'multibakery/test/combat@' }

    client!: Client
    map!: CCMap

    constructor(private config: CombatArtTestConfig) {
        this.id = config.id
        this.name = config.name
        this.timeout = 100e3
    }

    private async loadEnemy(enemyName: string) {
        return new Promise<void>((res, rej) => {
            new sc.EnemyType(enemyName).addLoadListener({
                onLoadableComplete(success) {
                    if (success) res()
                    else rej()
                },
            })
        })
    }

    private getPlayerSaveData(): StoragePlayerState {
        const relevantSkills = (sc.skilltree.skills as sc.SpecialSkill[]).filter(
            s =>
                s.skillType == this.config.combatArt.split('_')[0] &&
                s.element == this.config.element &&
                s.branchType == this.config.branch
        )
        const skills = relevantSkills.reduce((acc, skill) => {
            acc[skill.id] = true
            return acc
        }, [] as boolean[])

        return {
            entityState: {
                spLevel: sc.SP_LEVEL[4],
                sp: 100,
                level: 99,
                head: 657,
                leftArm: 607,
                rightArm: 607,
                torso: 583,
                feet: 596,
                modelName: this.config.character,
                skills,
                element: this.config.element,
            },
            tpInfo: { ...this.tpInfo },
        }
    }

    private async createMapAndClientIfNeeded() {
        await this.loadEnemy(enemyType)

        const username = this.id
        multi.storage.savePlayerState(username, this.getPlayerSaveData())
        const { client, map } = await multi.test.createClient({
            username,
            test: this,
            tilingOrder: this.config.tilingOrder,
            remote: this.config.remote,
        })
        client.inst.ig.perf.noGuiUpdate = true
        map.inst.ig.perf.noGuiUpdate = true
        this.client = client
        this.map = map

        runTask(client.inst, () => {
            sc.model.player.updateStats()

            const frameTime = 1 / multi.server.settings.gameTps
            ig.setChargeTimings([frameTime * 4, frameTime * 8, frameTime * 12])
        })
    }

    private async awaitRemote() {
        if (!this.config.remote) return

        await multi.test.waitFrames(this.map.inst, 60)
        if (!this.map) return
        this.map.inst.ig.mapShared.testDone = true

        const raport = await multi.test.remoteRaports[this.id]

        tester.expect(raport.crashed, 'remote crashed').toEqual(false)
        tester.expect(raport.playerZoom, 'player zoom not 1!').toEqual(1)
        if (raport.errors) {
            tester.expect(raport.errors.length, `errors: [${raport.errors.map(e => `"${e}"`).join(', ')}]`).toEqual(0)
        }
    }

    async run() {
        await multi.test.setupServerIfNeeded()
        await this.createMapAndClientIfNeeded()
        await executeCombatArt(this.client.dummy, this.client.inst, this.config.combatArt)
        await this.awaitRemote()
    }

    cleanup() {
        if (!multi.server) return

        multi.server.inst.apply()
        if (this.client) {
            multi.server.leaveClient(this.client)
            this.client = undefined as any
        }
        if (this.map) {
            setTimeout(() => {
                if (!multi.server) return
                multi.server.inst.apply()
                multi.server.unloadMap(this.map)
                this.map = undefined as any
            }, 200)
        }
    }
}

poststart(() => {
    let tilingOrder = 0
    const models = ['Lea', 'triblader2', 'Hexacast1'] as const
    for (const character of models) {
        const model = sc.party.models[character]
        assert(model, `missing player model: ${character}`)
        for (let element = 0 as sc.ELEMENT; element <= sc.ELEMENT.WAVE; element++) {
            tilingOrder++
            for (let level = 1; level <= 3; level++) {
                for (const type of ['ATTACK', 'THROW', 'GUARD', 'DASH'] as const) {
                    for (const branch of ['A', 'B'] as const) {
                        const combatArt = (type + '_SPECIAL' + level) as keyof typeof sc.PLAYER_ACTION
                        const actionName = combatArt + '_' + branch

                        const action = model.elementConfigs[element].actions[actionName]
                        if (!action) continue

                        const elementName = Object.keys(sc.ELEMENT)[element]
                        const idSuffix = `_${character}_${elementName}_${type}_${branch}_${level}`
                        const combatArtName = action.name
                        const testNameSuffix = ` ${character} ${elementName} ${type} ${branch} ${level} ${combatArtName}`

                        tester.addTest(
                            new CombatArtTest({
                                id: `combat_physics` + idSuffix,
                                name: 'physics' + testNameSuffix,
                                character,
                                element,
                                combatArt,
                                branch,
                                tilingOrder,
                            })
                        )
                        tester.addTest(
                            new CombatArtTest({
                                id: `combat_remote` + idSuffix,
                                name: 'remote' + testNameSuffix,
                                character,
                                element,
                                combatArt,
                                branch,
                                tilingOrder,
                                remote: true,
                            })
                        )
                    }
                }
            }
        }
    }
})
