#!/bin/node
import { startCrossnode } from '../../crossnode/crossnode.js'
startCrossnode({
    test: true,
    ccloader2: true,
    writeImage: true,
    writeImageInstanceinator: true,
    shell: true,

    modWhitelist: ['cc-multibakery', 'cc-determine', 'cc-instanceinator', 'ccmodmanager', 'cc-ts-template-esbuild'],
    extensionWhitelist: [],
    modTestWhitelist: ['cc-multibakery'],
})
