import { prestart } from './plugin'

prestart(() => {
    if (!PHYSICS || !window.crossnode?.options.test) return

    import('./server/test/aoc2024d15')
})
