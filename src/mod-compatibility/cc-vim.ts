import { disallowedInputActions } from '../dummy/dummy-input-puppet'

const key = 'cc-vim-openMenuKey'
declare global {
    namespace ig {
        namespace Input {
            interface KnownActions {
                [key]: true
            }
        }
    }
}
disallowedInputActions.push(key)
