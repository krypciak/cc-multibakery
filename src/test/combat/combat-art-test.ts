import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import type { CCMap } from '../../server/ccmap/ccmap'
import type { Client } from '../../client/client'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { InputData } from '../../dummy/dummy-input-puppet'
import type { TestConfig } from '../test-bridge'
import { poststart } from '../../loading-stages'
import { teleportPlayerToProperMarker } from '../../server/ccmap/teleport-fix'
import { addRuntimeAsset, reloadRuntimeAssets } from '../../misc/runtime-assets'

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
        preFrames = 10
    } else if (combatArt.startsWith('DASH')) {
        triggerActions.push('dash')
        triggerActions.push('left')
        preFrames = 5
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

    const entitiesSpawned: ig.Entity[] = []

    if (combatArt.startsWith('GUARD')) {
        await runTask(inst, async () => {
            const { x, y, z } = e.coll.pos
            ig.vars.set('tmp.practiceAttack', true)
            const enemy = ig.game.spawnEntity('Enemy', x - 32, y, z, {
                enemyInfo: { type: 'autumn-rh.practice-bot', level: 1 },
            })
            entitiesSpawned.push(enemy)
            enemy.enemyType.assignTarget(enemy, e, false, true)
        })
    }

    const chargeLevel = parseInt(combatArt[combatArt.length - 1])
    const chargeTime = chargeLevel * 4 + 1
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

    let frame = 0
    await multi.test.updateLoop(
        inst,
        () => frame++ > 60 * 30 || (e.state == 0 && !e.currentAction && getSpawnedEntities().length == 0)
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

    private setupPlayer() {
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
            model.equip = { head: 657, leftArm: 607, rightArm: 607, torso: 583, feet: 596 }

            const relevantSkills = (sc.skilltree.skills as sc.SpecialSkill[]).filter(
                s =>
                    s.skillType == this.config.combatArt.split('_')[0] &&
                    s.element == this.config.element &&
                    s.branchType == this.config.branch
            )
            model.skills = []
            for (const skill of relevantSkills) {
                model.skills[skill.id] = skill
            }

            sc.Model.notifyObserver(model, sc.PLAYER_MSG.LEVEL_CHANGE, null)
            sc.Model.notifyObserver(model, sc.PARTY_MEMBER_MSG.LEVEL_CHANGE)
            sc.Model.notifyObserver(model.params, sc.COMBAT_PARAM_MSG.MAX_SP_CHANGED)
            sc.Model.notifyObserver(model, sc.PLAYER_MSG.SKILL_CHANGED)
            model.updateStats()

            const frameTime = 1 / multi.server.settings.gameTps
            ig.setChargeTimings([frameTime * 4, frameTime * 8, frameTime * 12])

            teleportPlayerToProperMarker(this.client.dummy, 'entrance')
        })
    }

    private async createMapAndClientIfNeeded() {
        // const username = 'combat-art' // this.id
        // const mapName = this.baseMapName // this.mapName
        // const map = multi.server.maps.get(mapName)
        // if (map) {
        //     const client = multi.server.clients.get(username)
        //     assert(client)
        //     return { client, map }
        // }

        const username = this.id
        const mapName = this.mapName
        function mapNameToFilePath(name: string) {
            return 'data/maps/' + name + '.json'
        }
        addRuntimeAsset(mapNameToFilePath(this.mapName), mapNameToFilePath(this.baseMapName))
        reloadRuntimeAssets()
        const ret = await multi.test.createClient(username, { map: mapName }, this)

        await new Promise<void>((res, rej) => {
            new sc.EnemyType('autumn-rh.practice-bot').addLoadListener({
                onLoadableComplete(success) {
                    if (success) res()
                    else rej()
                },
            })
        })

        await multi.test.waitFrames(ret.client.inst, 20)

        return ret
    }

    async run() {
        await multi.test.setupServerIfNeeded()

        const { client, map } = await this.createMapAndClientIfNeeded()

        this.client = client
        this.map = map
        this.setupPlayer()

        await executeCombatArt(this.client.dummy, this.client.inst, this.config.element, this.config.combatArt)
    }

    cleanup() {
        if (!multi.server) return
        if (this.client) {
            multi.server.leaveClient(this.client)
            this.client = undefined as any
        }
        if (this.map) {
            multi.server.unloadMap(this.map)
            this.map = undefined as any
        }
    }
}

poststart(() => {
    for (const character of ['Lea', 'triblader2', 'Hexacast1']) {
        const model = sc.party.models[character]
        assert(model, `missing player model: ${character}`)
        for (let element = 0 as sc.ELEMENT; element <= sc.ELEMENT.WAVE; element++) {
            for (let level = 1; level <= 3; level++) {
                for (const type of ['ATTACK', 'THROW', 'GUARD', 'DASH'] as const) {
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
