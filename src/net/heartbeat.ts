import { CircularBuffer } from '../misc/circular-buffer'
import type { PacketWrapper } from './packet'

export interface HeartbeatConfig {
    /** Infinity to disable */
    timeout: number
    onTimeout: (timeoutTimeMs: number) => void
}

export class Heartbeat {
    private lastReceivedPacket = performance.now() + 10e3
    private heartbeatIntervalId?: NodeJS.Timeout
    private lastPingRTT: number = 0
    private clockOffsetCircularBuffer = new CircularBuffer<number>(5)
    private clockOffsetMedian: number = 0

    constructor(
        private wrapper: PacketWrapper,
        config: HeartbeatConfig
    ) {
        const heartbeatInterval = 1000
        this.heartbeatIntervalId = setInterval(() => {
            this.sendHeartbeatPacket()

            const now = performance.now()
            const diff = now - this.lastReceivedPacket
            if (diff > config.timeout) {
                config.onTimeout(diff)
            }
        }, heartbeatInterval)
    }

    onReceive() {
        const now = performance.now()
        this.lastReceivedPacket = now
    }

    getPing() {
        return this.lastPingRTT
    }

    getClockOffset() {
        return this.clockOffsetMedian
    }

    private updateClockOffset(newClockOffset: number) {
        this.clockOffsetCircularBuffer.push(newClockOffset)
        const times = this.clockOffsetCircularBuffer.get()
        times.sort((a, b) => a - b)
        const median = times[Math.floor(times.length / 2)]
        this.clockOffsetMedian = median
    }

    private async sendHeartbeatPacket() {
        const sendTime = performance.now()
        const serverTime = await this.wrapper.sendWithAck('ping1')
        const receiveTime = performance.now()

        const rtt = receiveTime - sendTime

        const clockOffset = serverTime + rtt / 2 - sendTime
        this.updateClockOffset(clockOffset)

        this.lastPingRTT = rtt
    }

    destroy() {
        if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId)
    }
}
