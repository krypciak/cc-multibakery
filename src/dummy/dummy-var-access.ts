import { prestart } from '../loading-stages'

prestart(() => {
    dummy.PlayerModel.inject({
        onVarAccess(path, keys) {
            if (multi.server) {
                if (keys[1] == 'username') return this.dummy.data.username
            }
            return this.parent(path, keys)
        },
    })
    dummy.DummyPlayer.inject({
        onVarAccess(path, keys) {
            if (multi.server) {
                if (keys[1] == 'model') return this.model.onVarAccess(keys.slice(2).join('.'), keys.slice(2))
                if (keys[1] == 'username') return this.data.username
            }
            return this.parent(path, keys)
        },
    })
})
