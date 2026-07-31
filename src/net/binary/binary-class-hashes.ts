import { PacketEncoderDecoder } from './packet-encoder-decoder.generated'
import { PhysicsUpdatePacketEncoderDecoder } from './physics-update-packet-encoder-decoder.generated'
import { RemoteUpdatePacketEncoderDecoder } from './remote-update-packet-encoder-decoder.generated'
import { SocketIoPacketEncoderDecoder } from './socket-io-packet-encoder-decoder.generated'
import { WebsocketPacketEncoderDecoder } from './websocket-packet-encoder-decoder.generated'

export type BinaryClassHashes = ReturnType<typeof getBinaryClassHashes>
export function getBinaryClassHashes() {
    return {
        PacketEncoderDecoder: PacketEncoderDecoder.codeHash,
        PhysicsUpdatePacketEncoderDecoder: PhysicsUpdatePacketEncoderDecoder.codeHash,
        RemoteUpdatePacketEncoderDecoder: RemoteUpdatePacketEncoderDecoder.codeHash,
        SocketIoPacketEncoderDecoder: SocketIoPacketEncoderDecoder.codeHash,
        WebsocketPacketEncoderDecoder: WebsocketPacketEncoderDecoder.codeHash,
    }
}
