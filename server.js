#!/bin/node
import { startCrossnode } from '../crossnode/crossnode.js'

startCrossnode({
    shell: true,
    ccloader2: true,
    modWhitelist: ['cc-multibakery', 'cc-determine', 'cc-instanceinator', 'ccmodmanager', 'cc-ts-template-esbuild', 'cc-canvas-server'],
    extensionWhitelist: [],
})
