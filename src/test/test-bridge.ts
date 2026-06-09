import { assert } from '../misc/assert'
import { SimpleTestManager } from './simple-test-runner'
import type { TestRunner } from './test-runner'

declare global {
    var tester: TestBridge
}

export interface TestConfig {
    id: string
    name: string
    timeout?: number

    run(): Promise<void>
    cleanup?(): void
}

class TestBridge implements TestRunner {
    private initialized = false
    private tests: Record<
        string,
        TestConfig & {
            crashPromise: Promise<void>
            crashReject: (error: any) => void
        }
    > = {}

    private testManager!: TestRunner

    init() {
        if (this.initialized) return
        this.initialized = true

        const isBun = typeof global.Bun !== 'undefined'
        if (isBun) {
            const bunTest: typeof import('bun:test') = require('bun:test')
            this.testManager = bunTest
        }

        if (!this.testManager) {
            this.testManager = new SimpleTestManager()
        }
    }

    getTestIds() {
        return Object.keys(this.tests)
    }

    describe: TestRunner['describe'] = (...args) => this.testManager.describe(...args)
    test: TestRunner['test'] = (...args) => this.testManager.test(...args)
    expect: TestRunner['expect'] = (...args) => this.testManager.expect(...args)

    addTest(test: TestConfig) {
        assert(!this.tests[test.id])
        let crashReject!: () => void
        const crashPromise = new Promise<void>((_resolve, reject) => (crashReject = reject))
        this.tests[test.id] = Object.assign(test, {
            crashPromise,
            crashReject,
        })
    }

    async executeTest(id: string) {
        const test = this.tests[id]
        if (!test) {
            console.warn('test', id, 'not found, skipping')
            return
        }
        try {
            await this.test(test.name, () => Promise.race([test.run(), test.crashPromise]), { timeout: test.timeout })
        } finally {
            test.cleanup?.()
        }
    }

    testCrashed(_test: TestConfig) {
        const test = this.tests[_test.id]
        test.crashReject('test crashed')
    }
}
if (globalThis.window) {
    window.tester ??= new TestBridge()
} else {
    global.tester ??= new TestBridge()
}
tester.init()
