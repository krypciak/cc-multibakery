import { PhysicsUpdatePacketEncoderDecoder } from './physics-update-packet-encoder-decoder.generated'
import { RemoteUpdatePacketEncoderDecoder } from './remote-update-packet-encoder-decoder.generated'

export type BinaryClassHashes = ReturnType<typeof getBinaryClassHashes>
export function getBinaryClassHashes() {
    return {
        PhysicsUpdatePacketEncoderDecoder: PhysicsUpdatePacketEncoderDecoder.codeHash,
        RemoteUpdatePacketEncoderDecoder: RemoteUpdatePacketEncoderDecoder.codeHash,
    }
}
