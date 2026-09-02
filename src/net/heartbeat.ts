import type { PacketWrapper } from './packet'

export interface HeartbeatConfig {
    /** Infinity to disable */
    timeout: number
    onTimeout: (timeoutTimeMs: number) => void
}

export class Heartbeat {
    private lastReceivedPacket = performance.now() + 10e3
    private heartbeatIntervalId?: NodeJS.Timeout
    private lastPingTimeDiff: number = 0

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
        return this.lastPingTimeDiff
    }

    private async sendHeartbeatPacket() {
        const sendTime = performance.now()
        await this.wrapper.sendWithAck('ping1')
        const receiveTime = performance.now()

        const timeDiff = receiveTime - sendTime
        this.lastPingTimeDiff = timeDiff
    }

    destroy() {
        if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId)
    }
}
