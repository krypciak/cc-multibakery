#!/bin/node
import { startCrossnode } from '../crossnode/crossnode.js'
startCrossnode({
    test: true,
    ccloader2: true,

    modWhitelist: ['cc-multibakery', 'cc-determine', 'cc-instanceinator', 'ccmodmanager'],
    extensionWhitelist: [],
    modTestWhitelist: ['cc-multibakery'],
})
