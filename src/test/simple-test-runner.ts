import { deepEqual } from '../misc/deep-equal'
import { assert } from '../misc/assert'
import type { DescribeFunc, ExpectFunc, TestFunc, TestRunner } from './test-runner'

function importAsyncHooks(): typeof import('async_hooks') | undefined {
    const isBun = typeof global.Bun !== 'undefined'
    if (isBun) return require('async_hooks')
    return (0, eval)('require("async_hooks")')
}

const async_hooks = importAsyncHooks()
const AsyncLocalStorage = async_hooks?.AsyncLocalStorage

async function wait(timeMs: number) {
    await new Promise<void>(resolve => setTimeout(resolve, timeMs))
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'

const colorEnabled = (() => {
    if (typeof process === 'undefined' || !process.stdout) return false
    if (process.env.NO_COLOR) return false
    return process.stdout.isTTY
})()

function c(code: string, text: string): string {
    if (!colorEnabled) return text
    return code + text + RESET
}

const PASS_SYM = '\u2713'
const FAIL_SYM = '\u2717'

interface SimpleTestConfig {
    name: string
    state: 'running' | 'success' | 'failed'
    errorMessage?: string
    startTime: number
    totalTime?: number
}

export class SimpleTestManager implements TestRunner {
    private described: Record<string, SimpleTestConfig[]> = {}
    private als = AsyncLocalStorage ? new AsyncLocalStorage<string>() : undefined
    private describeStack: string[] = []

    private passCount = 0
    private failCount = 0
    private expectCount = 0
    private totalTests = 0
    private completedTests = 0
    private allStartTime = Date.now()

    describe: DescribeFunc = async (name, func) => {
        this.described[name] ??= []
        if (this.als) {
            await this.als.run(name, func)
        } else {
            this.describeStack.push(name)
            try {
                await func()
            } finally {
                this.describeStack.pop()
            }
        }
    }

    test: TestFunc = async (name, func, { timeout } = {}) => {
        const describeName = this.als?.getStore() ?? this.describeStack[this.describeStack.length - 1]
        assert(describeName, 'Called test without describe!')
        const arr = this.described[describeName]
        assert(arr)
        const config: SimpleTestConfig = { name, state: 'running', startTime: Date.now() }
        arr.push(config)
        this.totalTests++

        try {
            const promises = []
            promises.push(
                (async () => {
                    await func()
                    if (config.state == 'running') config.state = 'success'
                })()
            )
            if (timeout) {
                promises.push(
                    (async () => {
                        await wait(timeout)
                        if (config.state == 'running') {
                            config.state = 'failed'
                            config.errorMessage = `Timeout ${timeout} ms`
                        }
                    })()
                )
            }
            await Promise.race(promises)
        } catch (e) {
            config.state = 'failed'
            if (typeof e == 'object' && e && 'message' in e && typeof e.message == 'string') {
                config.errorMessage ??= e.message
            }
        } finally {
            this.completedTests++
            config.totalTime = Date.now() - config.startTime
            assert(config.state != 'running')
            const success = config.state == 'success'
            if (success) {
                assert(!config.errorMessage)
                this.passCount++
            } else {
                this.failCount++
            }

            console.log(
                `  ${success ? c(GREEN, PASS_SYM) : c(RED, FAIL_SYM)} ${describeName}${c(DIM, ' >')}${c(BOLD, ` ${name}`)} ${c(DIM, `[${config.totalTime}ms]`)}`
            )
            if (config.errorMessage) {
                console.log(`${config.errorMessage}`)
            }

            if (this.isFinished()) {
                setTimeout(() => {
                    if (this.isFinished()) this.allFinished()
                }, 100)
            }
        }
    }

    private isFinished() {
        return this.completedTests >= this.totalTests
    }

    expect: ExpectFunc = (value, msg) => {
        this.expectCount++
        return {
            toEqual(expectedValue) {
                if (!deepEqual(expectedValue, value)) {
                    const errorMsg =
                        (msg ? c(BOLD, msg.trim()) + '\n' : '') +
                        c(RED, 'error') +
                        c(DIM, ': expect(') +
                        c(RED, 'received') +
                        c(DIM, ')') +
                        '.toEqual' +
                        c(DIM, '(') +
                        c(GREEN, 'expected') +
                        c(DIM, ')') +
                        '\n\n' +
                        'Expected: ' +
                        c(GREEN, `${expectedValue}`) +
                        '\n' +
                        'Received: ' +
                        c(RED, `${value}`)
                    throw new Error(errorMsg)
                }
            },
        }
    }

    private allFinished() {
        assert(this.isFinished())
        this.printSummary()
        multi.destroy()
    }

    private printSummary() {
        const totalTime = Date.now() - this.allStartTime
        console.log('')
        console.log(`  ${c(GREEN, `${this.passCount} pass`)}`)
        console.log(`  ${c(this.failCount > 0 ? RED : DIM, `${this.failCount} fail`)}`)
        console.log(`  ${this.expectCount} expect() calls`)
        console.log(`Ran ${this.totalTests} tests. ${c(DIM, '[')}${c(BOLD, `${totalTime}ms`)}${c(DIM, ']')}`)
    }
}
