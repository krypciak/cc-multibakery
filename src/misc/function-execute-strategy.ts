export async function executeWithStrategy(
    func: () => Promise<unknown>,
    strategy: { type: 'noAwait' | 'await' } | { type: 'delayNoAwait'; delay: number; then: () => void }
) {
    if (strategy.type == 'delayNoAwait') {
        /* setTimeout to let socket.io send ackData to the client this blocks the thread */
        setTimeout(async () => {
            await func()
            strategy.then()
        }, strategy.delay)
    } else {
        const promise = func()
        if (strategy.type == 'await') await promise
    }
}
