import { Config, generateEncodeDecodeScripts, SingleConfig } from 'ts-binarifier/src/index'
import { createEntityStateRecordUnionNode } from './entity-state-record-union-node'
import fs from 'fs'

const projectRoot = new URL('..', import.meta.url).pathname

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
        },
        {
            ...configBase,
            path: 'src/server/remote/remote-server-sender.ts',
            outPath: projectRoot + '/src/net/binary/remote-update-packet-encoder-decoder.generated.ts',
            outClassName: 'RemoteUpdatePacketEncoderDecoder',
        },
    ],
}

export async function generateBinaryTypes() {
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
