#!/bin/node
import { startCrossnode } from '../../crossnode/crossnode.js'

startCrossnode({
    ccloader2: true,
    nukeImageStack: true,
    modWhitelist: [
        'cc-multibakery',
        'cc-instanceinator',
        'ccmodmanager',
        'cc-ts-template-esbuild',
        'nax-ccuilib',
    ],
    extensionWhitelist: [],
})
