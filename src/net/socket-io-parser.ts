import { u32, u8 } from 'ts-binarifier/src/type-aliases'
import { Decoder as BinaryDecoder } from 'ts-binarifier/src/decoder'
import { assert } from '../misc/assert'
import { SocketIoPacketEncoderDecoder } from './binary/socket-io-packet-encoder-decoder.generated'
import { encode as encodeYeast } from 'socket.io-adapter/dist/contrib/yeast'

enum PacketType {
    CONNECT,
    DISCONNECT,
    EVENT,
    ACK,
    CONNECT_ERROR,
}

type EventTypes = 'update' | 'leave'
interface SocketIoPacket {
    type: PacketType
    ackData?: {
        id: u32
        data: any[]
    }
    ids?: { pid: string; sid: string }
    data?: {
        eventType: EventTypes
        data: u8[]
    }
}
export type GenerateType = SocketIoPacket

interface SocketIoOrigianlPacket {
    type: PacketType
    data: any
    nsp: string
    id?: number
}

class Encoder {
    encode(packet: SocketIoOrigianlPacket) {
        assert(packet.nsp == '/')
        const newPacket: SocketIoPacket = converIntoNewFormat(packet)
        const buf = SocketIoPacketEncoderDecoder.encode(newPacket)

        // const size = buf.byteLength
        // const dataLen = packet.data?.[1]?.byteLength
        // console.log('encode size:', size, 'data:', dataLen, 'headers:', size - dataLen)
        return [buf]
    }
}

function converIntoNewFormat(packet: SocketIoOrigianlPacket): SocketIoPacket {
    const hasId = packet.id !== undefined
    const hasSessionIds = !Array.isArray(packet.data)
    if (hasId) assert(!hasSessionIds)
    if (hasSessionIds) assert(!hasId)
    return {
        type: packet.type,
        ackData: hasId
            ? {
                  id: Number(packet.id),
                  data: packet.data,
              }
            : undefined,
        data:
            !hasId && !hasSessionIds
                ? {
                      eventType: packet.data[0],
                      data: packet.data[1],
                  }
                : undefined,
        ids: hasSessionIds ? packet.data : undefined,
    }
}
function convertFromNewFormat(packet: SocketIoPacket): SocketIoOrigianlPacket {
    let data: any
    if (packet.data) {
        const buf = packet.data.data
        const timestamp = buf && BinaryDecoder.IEEE64ToDouble(new Uint8Array(buf.slice(0, 8)))

        /* RemoteServerUpdatePacket does not contain a timestamp field so the timestamp on these
         * packets will be a random mess, this is a good enough check, and nothing bad seems
         * to happen if a jumbled timestamp is passed in anyways */
        if (timestamp > 1758455430514 /* 2025/09/21 */) {
            const timestampStr = encodeYeast(timestamp)
            data = [packet.data.eventType, buf, timestampStr]
        } else {
            data = [packet.data.eventType, buf]
        }
    }
    return {
        type: packet.type,
        data: packet.ids ?? packet.ackData?.data ?? data,
        nsp: '/',
        id: packet.ackData?.id,
    }
}

function isObject(value: any) {
    return Object.prototype.toString.call(value) === '[object Object]'
}

type ListenerFunc = Function
class Decoder {
    add(buf: Uint8Array) {
        try {
            const packet = SocketIoPacketEncoderDecoder.decode(buf)
            const oldPacket: SocketIoOrigianlPacket = convertFromNewFormat(packet)
            // console.log('decode to', oldPacket, 'from', packet)

            if (this.isPacketValid(oldPacket)) {
                for (const func of this.decodedListeners) func(oldPacket)
            } else {
            }
        } catch (e) {
            console.error('Decoder#add', e)
            throw new Error('invalid format')
        }
    }

    isPacketValid(packet: SocketIoOrigianlPacket) {
        const { type, data, id } = packet
        const isAckIdValid = id === undefined || Number.isInteger(id)
        if (!isAckIdValid) {
            return false
        }
        switch (type) {
            case 0: // CONNECT
                return data === undefined || isObject(data)
            case 1: // DISCONNECT
                return data === undefined
            case 2: // EVENT
                return Array.isArray(data) && typeof data[0] === 'string'
            case 3: // ACK
                return Array.isArray(data)
            case 4: // CONNECT_ERROR
                return isObject(data)
            default:
                return false
        }
    }

    destroy() {}

    /* Emitter mocking */
    decodedListeners: ListenerFunc[] = []

    on(type: string, func: ListenerFunc) {
        assert(type == 'decoded')
        this.decodedListeners.push(func)
    }
    off(type: string, func: ListenerFunc) {
        assert(type == 'decoded')
        this.decodedListeners.erase(func)
    }
    removeListener(type: string, func: ListenerFunc) {
        assert(type == 'decoded')
        this.decodedListeners.erase(func)
    }
}

export const parser = { Encoder, Decoder }
