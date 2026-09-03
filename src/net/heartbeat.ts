import type { NetPacket, PacketWrapper } from './packet'

export interface HeartbeatConfig {
    /** Infinity to disable */
    timeout: number
    onTimeout: (timeoutTimeMs: number) => void
}

export class Heartbeat {
    private lastReceivedPacket: number = performance.now() + 10e3
    lastReceivedPacketServerTime: number = 0
    private heartbeatIntervalId?: NodeJS.Timeout
    lastPingRTT: number = 0
    clockOffsetMin: number = 0

    constructor(
        private wrapper: PacketWrapper,
        config: HeartbeatConfig
    ) {
        const heartbeatInterval = 1000
        this.heartbeatIntervalId = setInterval(async () => {
            this.sendHeartbeatPacket()

            const now = performance.now()
            const diff = now - this.lastReceivedPacket
            if (diff > config.timeout) {
                config.onTimeout(diff)
            }
        }, heartbeatInterval)
    }

    onReceive(packet: NetPacket) {
        const now = performance.now()
        this.lastReceivedPacket = now

        this.lastReceivedPacketServerTime = packet.sentAt - this.clockOffsetMin
    }

    private updateClockOffset(newClockOffset: number) {
        this.clockOffsetMin = Math.min(this.clockOffsetMin, newClockOffset)
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
