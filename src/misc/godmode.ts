import { prestart } from '../plugin'

declare global {
    namespace ig {
        var godmode: (model?: sc.PlayerModel) => void
    }

    interface Object {
        keysT<K extends string | number | symbol, V>(object: Record<K, V>): K[]
    }
}

prestart(() => {
    ig.godmode = (model: sc.PlayerModel = sc.model.player) => {
        Object.keysT = Object.keys as any

        sc.stats.statsEnabled = true

        /* prettier-ignore  */
        /* add all party members */ sc.party.onStoragePreLoad!({ party: { models: { Lea: { level: 1, equipLevel: 0, exp: 0, spLevel: 2, allElements: false, temporary: false, noDie: false }, Shizuka: { level: 75, equipLevel: 74, exp: 0, spLevel: '4', allElements: false, temporary: false, noDie: false }, Shizuka0: { level: 1, equipLevel: 0, exp: 0, spLevel: 2, allElements: false, temporary: false, noDie: false }, Emilie: { level: 76, equipLevel: 74, exp: 856, spLevel: '4', allElements: false, temporary: false, noDie: false }, Sergey: { level: 1, equipLevel: 0, exp: 0, spLevel: 2, allElements: false, temporary: false, noDie: false }, Schneider: { level: 74, equipLevel: 74, exp: 412, spLevel: '4', allElements: false, temporary: false, noDie: false }, Schneider2: { level: 60, equipLevel: 59, exp: 795, spLevel: '3', allElements: true, temporary: false, noDie: false }, Hlin: { level: 75, equipLevel: 0, exp: 123, spLevel: 2, allElements: false, temporary: false, noDie: false }, Grumpy: { level: 76, equipLevel: 0, exp: 745, spLevel: 2, allElements: false, temporary: false, noDie: false }, Buggy: { level: 75, equipLevel: 28, exp: 951, spLevel: 2, allElements: false, temporary: false, noDie: false }, Glasses: { level: 76, equipLevel: 74, exp: 284, spLevel: '4', allElements: false, temporary: false, noDie: false }, Apollo: { level: 75, equipLevel: 74, exp: 512, spLevel: '4', allElements: false, temporary: false, noDie: false }, Joern: { level: 74, equipLevel: 74, exp: 123, spLevel: '4', allElements: false, temporary: false, noDie: false }, Triblader1: { level: 41, equipLevel: 30, exp: 118, spLevel: 2, allElements: false, temporary: false, noDie: false }, Luke: { level: 73, equipLevel: 69, exp: 951, spLevel: '4', allElements: false, temporary: false, noDie: false }, triblader2: { level: 1, equipLevel: 0, exp: 0, spLevel: 4, allElements: false, temporary: false, noDie: false }, triblader3: { level: 1, equipLevel: 0, exp: 0, spLevel: 1, allElements: false, temporary: false, noDie: false }, triblader4: { level: 1, equipLevel: 0, exp: 0, spLevel: 1, allElements: false, temporary: false, noDie: false }, triblader5: { level: 1, equipLevel: 0, exp: 0, spLevel: 1, allElements: false, temporary: false, noDie: false }, }, currentParty: [], contacts: { Lea: { status: 0, online: true, locked: false }, Shizuka: { status: 2, online: true, locked: false }, Shizuka0: { status: 0, online: true, locked: false }, Emilie: { status: 2, online: true, locked: false }, Sergey: { status: 1, online: true, locked: false }, Schneider: { status: 2, online: true, locked: false }, Schneider2: { status: 0, online: true, locked: false }, Hlin: { status: 1, online: true, locked: false }, Grumpy: { status: 1, online: true, locked: false }, Buggy: { status: 1, online: true, locked: false }, Glasses: { status: 2, online: true, locked: false }, Apollo: { status: 2, online: true, locked: false }, Joern: { status: 2, online: true, locked: false }, Triblader1: { status: 0, online: true, locked: false }, Luke: { status: 2, online: true, locked: false }, triblader2: { status: 0, online: true, locked: false }, triblader3: { status: 0, online: true, locked: false }, triblader4: { status: 0, online: true, locked: false }, triblader5: { status: 0, online: true, locked: false }, }, strategies: { TARGET: 'WHATEVER', BEHAVIOUR: 'OFFENSIVE', ARTS: 'NORMAL' }, dungeonBlocked: false, lastAreaDungeon: false, }, } as any)

        for (const k of Object.keysT(model.core)) {
            model.core[k] = true
        }

        model.setSpLevel(4)
        sc.newgame.setActive(true)
        if (!sc.newgame.get('infinite-sp')) sc.newgame.toggle('infinite-sp')
        model.setLevel(99)
        model.equip = { head: 657, leftArm: 577, rightArm: 607, torso: 583, feet: 596 }

        model.skillPoints.fill(200)
        for (let i = 0; i < 400; i++) {
            // @ts-expect-error
            if (sc.skilltree.skills[i].statType == 'SPIKE_DMG') continue
            model.learnSkill(i)
        }
        model.skillPoints.fill(0)

        /* filter out circuit override givers */
        const skipItems = new Set([150, 225, 230, 231, 286, 410, 428])
        for (let i = 0; i < sc.inventory.items.length; i++) {
            if (skipItems.has(i)) continue
            model.items[i] = 99
            model._addNewItem(i)
        }
        model.updateStats()

        /* unlock all areas */
        for (const area in sc.map.areas) sc.map.updateVisitedArea(area)
        /* unlock cargo ship area */
        sc.map.areas['cargo-ship'].condition = 'true'

        /* unlock all maps */
        for (const areaName in sc.map.areas) {
            const area = new sc.AreaLoadable(areaName)
            area.load(() => {
                for (const floor of area.data.floors) {
                    for (const map of floor.maps) {
                        ig.vars.set(`maps.${map.path.toCamel().toPath('', '')}`, {})
                    }
                }
            })
        }
    }
})
