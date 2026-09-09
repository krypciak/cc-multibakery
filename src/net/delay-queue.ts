export class DelayQueue {
    private last: Promise<void> = Promise.resolve()
    addDelay(delay: number, jitter: number) {
        const actualDelay = delay + Math.random() * jitter

        const start = performance.now()

        this.last = this.last.then(() => {
            const elapsed = performance.now() - start
            const remaining = actualDelay - elapsed
            return new Promise<void>(resolve => {
                if (remaining <= 0) resolve()
                else setTimeout(resolve, remaining)
            })
        })

        return this.last
    }
}
