import { poststart, preload } from '../loading-stages'

preload(() => {
    if (!TEST) return
    TEST && import('./aoc/aoc2024d15')
    TEST && import('./combat/combat-art-test')
}, 1)

poststart(() => {
    const isBun = typeof global.Bun !== 'undefined'
    if (!TEST || CROSSNODE || isBun) return
    // TEST && import('./aoc/aoc2024d15.test')
    TEST && import('./combat/combat-art-test.test')
}, 9999)
