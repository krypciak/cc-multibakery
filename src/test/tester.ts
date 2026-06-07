import type { expect, test } from 'bun:test'
import { assert } from '../misc/assert'

declare global {
    var tester: Tester
}

export interface TestConfig {
    id: string
    name: string
    timeout?: number

    run(): Promise<void>
    cleanup(): void
}

class Tester {
    private initialized = false
    private tests: Record<string, TestConfig> = {}

    test!: typeof test
    expect!: typeof expect

    async init() {
        if (this.initialized) return
        this.initialized = true

        const isBun = typeof global.Bun !== 'undefined'
        if (isBun) {
            const { expect, test } = (0, eval)(`require('bun:test')`)
            this.expect = expect
            this.test = test
        }
    }

    addTest(test: TestConfig) {
        assert(!this.tests[test.id])
        this.tests[test.id] = test
    }

    async executeTest(id: string) {
        const test = this.tests[id]
        if (!test) {
            console.warn('test', id, 'not found, skipping')
            return
        }
        this.test(
            test.name,
            async () => {
                await test.run()
                test.cleanup()
            },
            { timeout: test.timeout }
        )
    }
}
global.tester ??= new Tester()
await global.tester.init()
