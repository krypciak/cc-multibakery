import type { Config, SingleConfig } from 'ts-binarifier/src/index'
import { generateEncodeDecodeScripts } from 'ts-binarifier/src/index'
import { createEntityStateRecordUnionNode } from './entity-state-record-union-node'
import { fileURLToPath } from 'url'
import fs from 'fs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

const configBase = {
    projectRoot,
    typeType: 'type',
    typeName: 'GenerateType',
    printNode: true,
    baseImportPath: 'ts-binarifier',
} satisfies Partial<SingleConfig>

const config: Config = {
    configs: [
        {
            ...configBase,
            path: 'src/server/physics/physics-server-sender.ts',
            outPath: projectRoot + '/src/net/binary/physics-update-packet-encoder-decoder.generated.ts',
            outClassName: 'PhysicsUpdatePacketEncoderDecoder',
            parserOptions: { customNodes: { entityStateRecordUnion: createEntityStateRecordUnionNode } },
            insertTsIgnore: true,
        },
        {
            ...configBase,
            path: 'src/server/remote/remote-server-sender.ts',
            outPath: projectRoot + '/src/net/binary/remote-update-packet-encoder-decoder.generated.ts',
            outClassName: 'RemoteUpdatePacketEncoderDecoder',
        },
        {
            ...configBase,
            path: 'src/net/socket-io-parser.ts',
            outPath: projectRoot + '/src/net/binary/socket-io-packet-encoder-decoder.generated.ts',
            outClassName: 'SocketIoPacketEncoderDecoder',
        },
        {
            ...configBase,
            path: 'src/net/packet.ts',
            outPath: projectRoot + '/src/net/binary/packet-encoder-decoder.generated.ts',
            outClassName: 'PacketEncoderDecoder',
        },
        {
            ...configBase,
            path: 'src/net/websocket.ts',
            outPath: projectRoot + '/src/net/binary/websocket-packet-encoder-decoder.generated.ts',
            outClassName: 'WebsocketPacketEncoderDecoder',
        },
    ],
}

export async function generateBinaryTypes(asserts: boolean) {
    for (const singleConfig of config.configs) {
        singleConfig.encodeConfig ??= {}
        singleConfig.encodeConfig.asserts = asserts
    }
    await generateEncodeDecodeScripts(config)
}

async function fileExists(path: string) {
    return !!(await fs.promises.stat(path).catch(_ => false))
}

export async function isMissingFiles(): Promise<boolean> {
    const paths = config.configs.map(({ outPath }) => outPath)
    const existsArr = await Promise.all(paths.map(fileExists))
    return existsArr.some(exists => !exists)
}
