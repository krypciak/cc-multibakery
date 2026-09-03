export class CircularBuffer<T> {
    private arr: T[]
    private index: number = 0
    private count: number = 0

    constructor(private capacity: number) {
        this.arr = new Array(capacity)
    }

    push(value: T) {
        this.arr[this.index] = value
        this.index = (this.index + 1) % this.capacity
        if (this.count < this.capacity) this.count++
    }

    get(): T[] {
        return this.arr.slice(0, this.count)
    }

    length(): number {
        return this.count
    }

    toJSON() {
        return this.get()
    }
}
