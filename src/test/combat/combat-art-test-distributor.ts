import { setupCrosscodeIfNeeded } from '../test-setup-test-side'

export async function runCombatArtTests(character: string, element: keyof typeof sc.ELEMENT) {
    await setupCrosscodeIfNeeded()

    tester.describe('combat', async () => {
        const configs: Record<string, PartialRecord<string, string[]>> = {}
        for (const id of tester.getTestIds()) {
            if (!id.startsWith('combat')) continue
            const [_, character, element] = id.split('_')
            ;((configs[character] ??= {})[element] ??= []).push(id)
        }

        const arr = configs[character]?.[element] ?? []
        for (const id of arr) {
            await tester.executeTest(id)
        }
        // await Promise.all(arr.map(id => tester.executeTest(id)))
    })
}
