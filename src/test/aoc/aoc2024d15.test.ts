import { describe } from 'bun:test'
import { setupCrosscodeIfNeeded } from '../test-setup-test-side'

await setupCrosscodeIfNeeded()

describe('aoc2024d15 2', async () => {
    await tester.executeTest('aoc2024d15 2')
})

describe('aoc2024d15', async () => {
    await tester.executeTest('aoc2024d15 1')
})
