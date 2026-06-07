import { describe } from 'bun:test'
import { setupCrosscodeIfNeeded } from '../test-setup-test-side'
import configs from './aoc2024d15-configs.json'

await setupCrosscodeIfNeeded()

describe('aoc2024d15', async () => {
    for (const config of configs) {
        if (!config.enabled) continue
        tester.executeTest(config.id)
    }
})
