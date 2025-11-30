import { prestart } from './loading-stages'

prestart(() => {
    if (!window.crossnode?.options.test) return

    PHYSICS && import('./server/test/aoc2024d15')
})
