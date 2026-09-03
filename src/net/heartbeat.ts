import type { NetPacket, PacketWrapper } from './packet'

export interface HeartbeatConfig {
    /** Infinity to disable */
    timeout: number
    onTimeout: (timeoutTimeMs: number) => void
}

export class Heartbeat {
    private lastReceivedPacket: number = performance.now() + 10e3
    private heartbeatIntervalId?: NodeJS.Timeout
    private minimumRTT: number = Infinity
    private isHeartbeatPacketInFlight: boolean = false

    lastReceivedPacketServerTime: number = 0
    lastPingRTT: number = 0
    clockOffset: number = 0

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

    onReceive(packet: NetPacket) {
        const now = performance.now()
        this.lastReceivedPacket = now

        this.lastReceivedPacketServerTime = packet.sentAt - this.clockOffset
    }

    private async sendHeartbeatPacket() {
        if (this.isHeartbeatPacketInFlight) return
        this.isHeartbeatPacketInFlight = true

        try {
            const sendTime = performance.now()
            const serverTime = await this.wrapper.sendWithAck('ping1')
            const receiveTime = performance.now()

            const rtt = receiveTime - sendTime
            if (rtt < this.minimumRTT) {
                this.minimumRTT = rtt
                this.clockOffset = serverTime - (sendTime + receiveTime) / 2
            }

            this.lastPingRTT = rtt
        } finally {
            this.isHeartbeatPacketInFlight = false
        }
    }

    destroy() {
        if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId)
    }
}
