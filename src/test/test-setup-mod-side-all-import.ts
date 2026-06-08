import { poststart, preload } from '../loading-stages'

preload(() => {
    if (!TEST) return
    import('./aoc/aoc2024d15')
}, 1)

poststart(() => {
    if (!TEST || CROSSNODE) return
    import('./aoc/aoc2024d15.test')
}, 9999)
