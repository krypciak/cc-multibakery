import { setupCrosscodeIfNeeded } from '../test-setup-test-side'

await setupCrosscodeIfNeeded()

tester.describe('combat', () => {
    tester.executeTest('combatArt1')
})
