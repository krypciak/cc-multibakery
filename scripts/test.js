#!/bin/node
import { startCrossnode } from '../../crossnode/crossnode.js'
startCrossnode({
    test: true,
    ccloader2: true,
    writeImage: true,
    writeImageInstanceinator: true,

    modWhitelist: ['cc-multibakery', 'cc-instanceinator', 'ccmodmanager', 'cc-ts-template-esbuild', 'nax-ccuilib'],
    extensionWhitelist: [],
    modTestWhitelist: ['cc-multibakery'],
})
