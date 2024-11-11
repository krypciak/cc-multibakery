#!/bin/node
import { startCrossnode } from '../crossnode/crossnode.js'
startCrossnode({
    test: true,
    determinism: true,
    ccloader2: true,
    nukeImageStack: true,
    
    modWhitelist: ['cc-multibakery'],
    extensionWhitelist: [],
    modTestWhitelist: ['cc-multibakery'],
})

