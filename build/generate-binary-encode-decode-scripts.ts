import { Config, generateEncodeDecodeScripts } from 'ts-binarifier/src/index'
import { createEntityStateRecordUnionNode } from './entity-state-record-union-node'
import fs from 'fs'

const projectRoot = new URL('..', import.meta.url).pathname

const config: Config = {
    configs: [
        {
            projectRoot,
            path: 'src/server/physics/physics-server-sender.ts',
            typeType: 'type',
            typeName: 'GenerateType',
            outPath: projectRoot + '/src/net/binary/physics-state-packet-encoder-decoder.generated.ts',
            outClassName: 'PhysicsStatePacketEncoderDecoder',
            printNode: true,
            parserOptions: { customNodes: { entityStateRecordUnion: createEntityStateRecordUnionNode } },
            baseImportPath: 'ts-binarifier',
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
