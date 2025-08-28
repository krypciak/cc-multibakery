import { prestart } from '../../../loading-stages'
import Multibakery from '../../../plugin'
import { openManagerServerPopup } from './server-manage-button'

import './leave-server-button'
import './server-manage-button'

prestart(() => {
    nax.ccuilib.pauseScreen.addText({
        text: `multibakery v${Multibakery.mod.version?.toString()}`,
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
