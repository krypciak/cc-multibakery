#!/bin/node
import { startCrossnode } from '../../crossnode/src/crossnode.ts'

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

        // 'starcaller-2',

        // 'lqm-joern-mod',
        // 'font-utils',
        // 'lub-summoner-frame',
    ],
    extensionWhitelist: ['post-game'],
})
