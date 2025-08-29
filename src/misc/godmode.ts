import { prestart } from '../loading-stages'

declare global {
    namespace ig {
        var godmode: (model?: sc.PlayerModel, circuitBranch?: boolean) => void
    }

    interface Object {
        keysT<K extends string | number | symbol, V>(object: Record<K, V>): K[]
    }
}

prestart(() => {
    ig.godmode = (model = sc.model.player, circuitBranch = false) => {
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

        /* prettier-ignore */
        const branchA = [0, 1, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 33, 35, 36, 37, 38, 39, 40, 41, 42, 44, 46, 48, 49, 50, 51, 52, 53, 54, 55, 57, 59, 61, 62, 63, 65, 67, 69, 70, 71, 72, 74, 76, 78, 79, 80, 81, 82, 84, 85, 86, 87, 88, 89, 90, 91, 93, 95, 97, 99, 101, 103, 104, 105, 106, 107, 108, 109, 110, 111, 113, 115, 117, 118, 120, 122, 124, 125, 126, 128, 130, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 145, 147, 149, 151, 153, 155, 156, 157, 158, 160, 162, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 177, 179, 181, 183, 185, 187, 189, 190, 191, 192, 193, 194, 195, 196, 197, 199, 201, 203, 204, 206, 208, 210, 211, 212, 213, 214, 216, 218, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 231, 233, 235, 236, 238, 240, 242, 243, 244, 245, 246, 248, 250, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 266, 268, 270, 272, 274, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 287, 289, 291, 293, 295, 297, 298, 299, 300, 302, 304, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 319, 321, 323, 324, 326, 328, 330, 331, 332, 334, 336, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 354, 356, 358, 360, 362, 364, 365, 366, 367, 368, 369, 370, 371, 373, 375, 377, 378, 379, 381, 383, 385, 386, 387, 388, 390, 392, 394, 395, 396, 397, 398, 399]
        /* prettier-ignore */
        const branchB = [0, 1, 2, 3, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 23, 24, 25, 26, 27, 28, 30, 32, 34, 35, 36, 37, 38, 39, 40, 41, 43, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 60, 62, 64, 66, 68, 69, 70, 71, 73, 75, 77, 78, 79, 80, 81, 82, 84, 85, 86, 87, 88, 89, 90, 92, 94, 96, 98, 100, 102, 103, 104, 105, 106, 107, 108, 109, 110, 112, 114, 116, 117, 119, 121, 123, 124, 125, 126, 127, 129, 131, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 144, 146, 148, 149, 150, 152, 154, 156, 157, 158, 159, 161, 163, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 177, 178, 180, 182, 184, 186, 188, 190, 191, 192, 193, 194, 195, 196, 197, 198, 200, 202, 204, 205, 207, 209, 211, 212, 213, 215, 217, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 232, 234, 236, 237, 239, 241, 243, 244, 245, 247, 249, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 267, 269, 271, 273, 275, 277, 278, 279, 280, 281, 282, 283, 284, 286, 288, 290, 291, 292, 294, 296, 298, 299, 300, 301, 303, 305, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 318, 320, 322, 323, 325, 327, 329, 330, 331, 332, 333, 335, 337, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 353, 355, 357, 359, 361, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 374, 376, 378, 380, 382, 384, 385, 386, 387, 389, 391, 393, 394, 395, 396, 397, 398, 399]
        const branch = circuitBranch ? branchA : branchB

        for (const i of branch) {
            // @ts-expect-error
            if (sc.skilltree.skills[i].statType == 'SPIKE_DMG') continue
            model.learnSkill(i)
        }
        model.skillPoints.fill(3)

        /* filter out circuit override givers */
        const skipItems = new Set([150, 428])
        for (let i = 0; i < sc.inventory.items.length; i++) {
            if (skipItems.has(i)) continue
            model.items[i] = 99
            model._addNewItem(i)
        }
        model.updateStats()

        /* disable new circuit tree animaition on first time circuit menu opening */
        const startCircuits = (((ig.vars.storage.menu ??= {}).circuit ??= {}).start ??= {})
        for (const element of Object.values(sc.ELEMENT)) {
            startCircuits[element] = true
        }

        /* disable circuit override popups */
        ;(ig.vars.storage.g ??= {}).gotCircuitOverride = 1

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

declare global {
    namespace ig.EVENT_STEP {
        namespace GODMODE {
            interface Settings {
                circuitBranch?: ig.Event.BooleanExpression
            }
        }
        interface GODMODE extends ig.EventStepBase {
            circuitBranch?: ig.Event.BooleanExpression
        }
        interface GODMODE_CONSTRUCTOR extends ImpactClass<GODMODE> {
            new (settings: ig.EVENT_STEP.GODMODE.Settings): GODMODE
        }
        var GODMODE: GODMODE_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.GODMODE = ig.EventStepBase.extend({
        init(settings) {
            this.circuitBranch = settings.circuitBranch
        },
        start() {
            const circuitBranch = this.circuitBranch && ig.Event.getExpressionValue(this.circuitBranch)
            ig.godmode(sc.model.player, circuitBranch)
        },
    })
})
