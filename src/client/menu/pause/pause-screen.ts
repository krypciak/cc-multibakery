import { prestart } from '../../../loading-stages'
import { modMetadata } from '../../../mod-metadata'
import { openManagerServerPopup } from './server-manage-button'

import './leave-server-button'
import './server-manage-button'

prestart(() => {
    nax.ccuilib.pauseScreen.addText({
        text: `multibakery v${modMetadata.mod.version?.toString()}`,
        showCondition() {
            return !!multi.server
        },
    })
})

prestart(() => {
    nax.ccuilib.pauseScreen.addButton({
        text: 'Manage server',
        onPress() {
            openManagerServerPopup()
        },
    })
})
