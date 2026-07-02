#!/usr/bin/env bun
import { $, Glob } from 'bun'
import { Zippable, zipSync } from 'fflate'

import ccmod from './ccmod.json'

await $`rm -f ${ccmod.id}*`.nothrow().quiet()

await $`bun run build`

const tasks: Promise<void>[] = []
const zipFiles: Zippable = {}

function addFile(path: string, minify?: boolean) {
    if (path.endsWith('~') || path.endsWith('.kra')) return
    if (path.endsWith('icon240.png')) return

    tasks.push(
        (async () => {
            const file = Bun.file(path)

            let data: Uint8Array
            if (
                minify &&
                (path.endsWith('.json') || path.endsWith('.json.patch') || path.endsWith('.json.patch.confd'))
            ) {
                data = new TextEncoder().encode(JSON.stringify(await file.json()))
            } else {
                data = await file.bytes()
            }
            zipFiles[path] = data
            console.log('  adding: ', path)
        })()
    )
}
async function addGlob(glob: string, minify?: boolean) {
    for await (const filePath of new Glob(glob).scan()) addFile(filePath, minify)
}

await Promise.all([
    //
    addGlob('{LICENSE,plugin.js,ccmod.json}'),
    addGlob('icon/icon.png'),
    addGlob('{assets,lang}/**/*'),
])
await Promise.all(tasks)

const zipData = zipSync(zipFiles)
const zipName = `${ccmod.id}-${ccmod.version}.ccmod`
await Bun.file(`./${zipName}`).write(zipData)
