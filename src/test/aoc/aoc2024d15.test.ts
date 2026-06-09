import { setupCrosscodeIfNeeded } from '../test-setup-test-side'
import configs from './aoc2024d15-configs.json'

await setupCrosscodeIfNeeded()

tester.describe('aoc2024d15', () => {
    for (const config of configs) {
        if (!config.enabled) continue
        tester.executeTest(config.id)
    }
})
