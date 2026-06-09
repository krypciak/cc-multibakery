import { setupCrosscodeIfNeeded } from '../test-setup-test-side'

await setupCrosscodeIfNeeded()

tester.describe('combat', async () => {
    const elementTests: PartialRecord<string, string[]> = {}
    for (const id of tester.getTestIds()) {
        if (!id.startsWith('combat')) continue
        const [_, _character, element] = id.split('_')
        elementTests[element] ??= []
        elementTests[element].push(id)
    }

    for (const element in elementTests) {
        const arr = elementTests[element]!
        await Promise.all(arr.map(id => tester.executeTest(id)))
    }
})
