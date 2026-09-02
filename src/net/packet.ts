import type { f64, RecordSize, u16, u24, u32, u8 } from 'ts-binarifier/src/type-aliases'
import { PacketEncoderDecoder } from './binary/packet-encoder-decoder.generated'
import { type HeartbeatConfig, Heartbeat } from './heartbeat'

export type PacketEventType = 'ack' | 'update' | 'join' | 'leave' | 'ping1' | 'ready'

export interface NetPacket {
    type: PacketEventType
    sentAt: f64
    seq: u16
    ack?: {
        id: u32
        response: boolean
    }
    data:
        | {
              type: 'json'
              jsonData?: any
          }
        | {
              type: 'binary'
              binData: u8[] & RecordSize<u24>
          }
}
export type GenerateType = NetPacket

interface PacketWrapperSettings {
    sendData: (buf: Uint8Array<ArrayBuffer>) => void
    onData: (packet: NetPacket, callback?: (data: any) => void) => void
}

export class PacketWrapper {
    private ackQueue = new Map<u32, (packet: NetPacket) => void>()
    private ackIdCounter = 0
    private seqCounter = 0

    heartbeat: Heartbeat

    constructor(
        private settings: PacketWrapperSettings,
        heartbeatConfig: HeartbeatConfig
    ) {
        this.heartbeat = new Heartbeat(this, heartbeatConfig)
    }

    receive(buf: Uint8Array) {
        this.heartbeat.onReceive()

        const packet: NetPacket = PacketEncoderDecoder.decode(buf)

        if (packet.ack) {
            const { id, response } = packet.ack
            if (response) {
                if (this.ackQueue.has(id)) {
                    const ack = this.ackQueue.get(id)!
                    ack(packet)
                    this.ackQueue.delete(id)
                } else {
                    console.warn('ack id', id, 'missing!')
                }
            } else {
                const callback = (cbData?: any) => this.sendAckResponse(packet.type, cbData, id)
                if (packet.type == 'ping1') {
                    callback()
                } else {
                    this.settings.onData(packet, callback)
                }
            }
        } else {
            this.settings.onData(packet)
        }
    }

    send(type: PacketEventType, data?: any) {
        this.encodePacketAndSend(type, data)
    }

    sendWithAck(type: PacketEventType, data?: any) {
        return new Promise<any>(resolve => {
            const ackId = this.ackIdCounter++
            this.ackQueue.set(ackId, packet =>
                resolve(packet.data.type == 'json' ? packet.data.jsonData : packet.data.binData)
            )
            this.encodePacketAndSend(type, data, { id: ackId, response: false })
        })
    }

    private sendAckResponse(type: PacketEventType, data: any, id: u32) {
        this.encodePacketAndSend(type, data, { id, response: true })
    }

    private encodePacketAndSend(type: PacketEventType, data: any, ack?: { id: u32; response: boolean }) {
        const seq = this.seqCounter++
        if (this.seqCounter >= 65536) this.seqCounter = 0

        const isBin = data !== undefined && data instanceof Uint8Array

        const sentAt = performance.now()
        const packet: NetPacket = {
            type,
            sentAt,
            seq,
            ack,
            data: isBin
                ? {
                      type: 'binary',
                      binData: data as unknown as u8[],
                  }
                : {
                      type: 'json',
                      jsonData: data,
                  },
        }
        const buf = PacketEncoderDecoder.encode(packet)
        this.settings.sendData(buf)
    }

    destroy() {
        this.heartbeat.destroy()
    }
}
