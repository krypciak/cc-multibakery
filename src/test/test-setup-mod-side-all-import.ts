import { poststart, preload } from '../loading-stages'
import { isBunTest } from './test-bridge'

preload(() => {
    if (!TEST) return
    TEST && import('./aoc/aoc2024d15')
    TEST && import('./combat/combat-art-test')
}, 1)

poststart(() => {
    if (!TEST || isBunTest()) return
    TEST && import('./aoc/aoc2024d15.test')

    TEST && import('./combat/spheromancer/combat-art-spheromancer-neutral.test')
    TEST && import('./combat/spheromancer/combat-art-spheromancer-heat.test')
    TEST && import('./combat/spheromancer/combat-art-spheromancer-cold.test')
    TEST && import('./combat/spheromancer/combat-art-spheromancer-shock.test')
    TEST && import('./combat/spheromancer/combat-art-spheromancer-wave.test')

    TEST && import('./combat/triblader/combat-art-triblader-neutral.test')
    TEST && import('./combat/triblader/combat-art-triblader-heat.test')
    TEST && import('./combat/triblader/combat-art-triblader-cold.test')
    TEST && import('./combat/triblader/combat-art-triblader-shock.test')
    TEST && import('./combat/triblader/combat-art-triblader-wave.test')

    TEST && import('./combat/hexacast/combat-art-hexacast-neutral.test')
    TEST && import('./combat/hexacast/combat-art-hexacast-heat.test')
    TEST && import('./combat/hexacast/combat-art-hexacast-cold.test')
    TEST && import('./combat/hexacast/combat-art-hexacast-shock.test')
    TEST && import('./combat/hexacast/combat-art-hexacast-wave.test')
}, 9999)
