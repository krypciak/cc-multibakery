export type DescribeFunc = (name: string, func: () => void | Promise<void>) => void | Promise<void>
interface TestFuncOptions {
    timeout?: number
}
export type TestFunc = (
    name: string,
    func: () => void | Promise<void>,
    options?: TestFuncOptions
) => void | Promise<void>
export type ExpectFunc = (value?: unknown, msg?: string) => { toEqual(expectedValue?: unknown): void }

export interface TestRunner {
    describe: DescribeFunc
    test: TestFunc
    expect: ExpectFunc
}
