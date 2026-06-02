import type { RecordSize, u24, u32, u8 } from 'ts-binarifier/src/type-aliases'
import { PacketEncoderDecoder } from './binary/packet-encoder-decoder.generated'

export type PacketEventType = 'ack' | 'update' | 'join' | 'leave' | 'ping1' | 'ready'

interface PacketMiddlewarePacket {
    type: PacketEventType
    ack?: {
        id: u32
        response: boolean
    }
    jsonData?: any
    binData?: u8[] & RecordSize<u24>
}
export type GenerateType = PacketMiddlewarePacket

export class PacketMiddleware {
    private ackQueue = new Map<u32, (data: any) => void>()
    private ackIdCounter = 0

    constructor(
        private sendData: (buf: Uint8Array) => void,
        private onData: (type: PacketEventType, buf: u8[], callback?: (data: any) => void) => void
    ) {}

    receive(buf: Uint8Array) {
        const packet: GenerateType = PacketEncoderDecoder.decode(buf)

        const data = packet.jsonData ?? packet.binData

        if (packet.ack) {
            const { id, response } = packet.ack
            if (response) {
                if (this.ackQueue.has(id)) {
                    const ack = this.ackQueue.get(id)!
                    ack(data)
                    this.ackQueue.delete(id)
                } else {
                    console.warn('ack id', id, 'missing!')
                }
            } else {
                this.onData(packet.type, data, cbData => this.sendAckResponse(packet.type, cbData, id))
            }
        } else {
            this.onData(packet.type, data)
        }
    }

    send(type: PacketEventType, data?: any) {
        this.encodePacketAndSend(type, data)
    }

    sendWithAck(type: PacketEventType, data?: any) {
        return new Promise<any>(resolve => {
            const ackId = this.ackIdCounter++
            this.ackQueue.set(ackId, resolve)
            this.encodePacketAndSend(type, data, { id: ackId, response: false })
        })
    }

    private sendAckResponse(type: PacketEventType, data: any, id: u32) {
        this.encodePacketAndSend(type, data, { id, response: true })
    }

    private encodePacketAndSend(type: PacketEventType, data: any, ack?: { id: u32; response: boolean }) {
        const isBin = data instanceof Uint8Array
        const packet: PacketMiddlewarePacket = {
            type,
            ack,
            jsonData: isBin ? undefined : data,
            binData: isBin ? (data as never as u8[]) : undefined,
        }
        const buf = PacketEncoderDecoder.encode(packet)
        this.sendData(buf)
    }
}
