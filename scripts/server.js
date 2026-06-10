#!/bin/node
import { startCrossnode } from '../../crossnode/crossnode.js'

startCrossnode({
    ccloader2: true,
    nukeImageStack: true,
    // writeImage: true,
    // writeImageInstanceinator: true,
    modWhitelist: [
        'cc-multibakery',
        'cc-instanceinator',
        'ccmodmanager',
        'nax-ccuilib',
        'cc-alybox',
        'cc-multibakery-additions',
        'cc-krypek-lib',
        'cc-variable-charge-time',

        'xenons-playable-classes',
        'menu-ui-replacer',
        'extension-asset-preloader',
        'extendable-severed-heads',
    ],
    extensionWhitelist: ['post-game'],
})
