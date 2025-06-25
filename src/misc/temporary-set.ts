export class TemporarySet<T> {
    private static refs: TemporarySet<any>[] = []
    static resetAll() {
        for (const set of TemporarySet.refs) set.clear()
    }

    private bins: Set<T>[] = [new Set<T>(), new Set<T>()]
    private currentBin = 0

    /* Guaranteed amount of items: [binSize, binSize*2] */
    /* Basically keep the last binSize items and remove the rest */
    constructor(private binSize: number) {
        TemporarySet.refs.push(this)
    }

    has(item: T) {
        return this.bins[0].has(item) || this.bins[1].has(item)
    }
    /* We are not worried about duplicates as they will not happen in this use case */
    push(item: T) {
        const currentBin = this.bins[this.currentBin]
        currentBin.add(item)
        if (currentBin.size >= this.binSize) {
            this.bins[(this.currentBin + 1) % this.bins.length].clear()
            this.currentBin = (this.currentBin + 1) % this.bins.length
        }
    }

    clear() {
        for (const bin of this.bins) bin.clear()
    }
}
