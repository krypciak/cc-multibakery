import { prestart } from '../loading-stages'

prestart(() => {
    dummy.PlayerModel.inject({
        onVarAccess(path, keys) {
            if (keys[1] == 'username') return this.dummy.data.username
            return this.parent(path, keys)
        },
    })
})
