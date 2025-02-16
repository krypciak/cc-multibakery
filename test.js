#!/bin/node
import { startCrossnode } from '../crossnode/crossnode.js'
startCrossnode({
    test: true,
    determinism: true,
    ccloader2: true,
    writeImage: true,

    modWhitelist: ['cc-multibakery', 'cc-determine', 'cc-instanceinator', 'ccmodmanager'],
    extensionWhitelist: [],
    modTestWhitelist: ['cc-multibakery'],
})
