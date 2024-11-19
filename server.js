#!/bin/node
import { startCrossnode } from '../crossnode/crossnode.js'

startCrossnode({
    shell: true,
    determinism: true,
    ccloader2: true,
    modWhitelist: ['cc-multibakery'],
    extensionWhitelist: [],
})
