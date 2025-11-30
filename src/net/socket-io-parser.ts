import { type u32, type u8 } from 'ts-binarifier/src/type-aliases'
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

interface SocketIoPacket {
    type: PacketType
    ackData?: {
        id: u32
        data: any[]
    }
    ids?: { pid: string; sid: string }
    otherEventsData?: any
    updateEventData?: {
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
        // console.log('encoding', packet, 'into new:', newPacket)
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
    const isOtherData = !hasId && !hasSessionIds && packet.data[0] != 'update'
    assert(Number(hasId) + Number(hasSessionIds) + Number(isOtherData) <= 1)
    return {
        type: packet.type,
        ackData: hasId
            ? {
                  id: Number(packet.id),
                  data: packet.data,
              }
            : undefined,
        updateEventData:
            !hasId && !hasSessionIds && !isOtherData
                ? {
                      data: packet.data[1],
                  }
                : undefined,
        otherEventsData: isOtherData ? packet.data : undefined,
        ids: hasSessionIds ? packet.data : undefined,
    }
}
function convertFromNewFormat(packet: SocketIoPacket): SocketIoOrigianlPacket {
    let data: any
    if (packet.updateEventData) {
        const buf = packet.updateEventData.data
        const timestamp = buf?.length >= 8 && BinaryDecoder.IEEE64ToDouble(new Uint8Array(buf.slice(0, 8)))

        /* RemoteServerUpdatePacket does not contain a timestamp field so the timestamp on these
         * packets will be a random mess, this is a good enough check, and nothing bad seems
         * to happen if a jumbled timestamp is passed in anyways */
        if (timestamp && timestamp > 1758455430514 /* 2025/09/21 */) {
            const timestampStr = encodeYeast(timestamp)
            data = ['update', buf, timestampStr]
        } else {
            data = ['update', buf]
        }
    } else {
        data = packet.otherEventsData
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
    add(data: ArrayBuffer) {
        try {
            const buf = new Uint8Array(data)
            const packet = SocketIoPacketEncoderDecoder.decode(buf)
            const oldPacket: SocketIoOrigianlPacket = convertFromNewFormat(packet)
            // console.log('decoding from new', packet, 'to', oldPacket)

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
