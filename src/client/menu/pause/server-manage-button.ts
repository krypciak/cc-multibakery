import { prestart } from '../../../plugin'
import {
    closePhysicsServerAndSaveState,
    createPhysicsServerFromCurrentState,
} from '../../../server/physics/create-from-current-state'

export function openManagerServerPopup() {
    ig.multibakeryManageServerPopup ??= new multi.class.ManageServerPopup()
    ig.multibakeryManageServerPopup.openMenu()
}

declare global {
    namespace sc {
        interface PauseScreenGui {
            /* from archipelago mod CCMultiworldRandomizer */
            apSettingsButton?: sc.ButtonGui

            multibakeryManageServerButton: sc.ButtonGui
            multibakeryManageServerPopup: multi.class.ManageServerPopup
        }
    }
}
prestart(() => {
    sc.PauseScreenGui.inject({
        init() {
            this.parent()

            this.multibakeryManageServerButton = new sc.ButtonGui('Manage server')

            let y = 3
            // @ts-ignore from archipelago mod CCMultiworldRandomizer
            if (sc.multiworld) {
                y = 30
            }
            this.multibakeryManageServerButton.setPos(3, y)

            this.buttonGroup.addFocusGui(this.multibakeryManageServerButton, 999, 999)
            this.multibakeryManageServerButton.onButtonPress = () => openManagerServerPopup()
            this.addChildGui(this.multibakeryManageServerButton)
        },
    })
})

declare global {
    namespace multi.class {
        interface ManageServerPopup extends modmanager.gui.MultiPageButtonBoxGui {
            updateServerStatus(this: this): void
            startStopServer(this: this): void
        }
        interface ManageServerPopupConstructor extends ImpactClass<ManageServerPopup> {
            new (): ManageServerPopup
        }
        var ManageServerPopup: ManageServerPopupConstructor
    }
    namespace ig {
        var multibakeryManageServerPopup: multi.class.ManageServerPopup
    }
}
prestart(() => {
    multi.class.ManageServerPopup = modmanager.gui.MultiPageButtonBoxGui.extend({
        init() {
            const self = this
            this.parent(200, 100, [
                {
                    name: 'Close',
                    onPress() {
                        self.closeMenu()
                    },
                },
                {
                    name: 'Start server',
                    onPress() {
                        self.startStopServer()
                    },
                },
            ])
            this.hook.temporary = true
        },
        openMenu() {
            this.parent()
            ig.canLeavePauseMenu = false
            this.updateServerStatus()
        },
        closeMenu() {
            this.parent()
            ig.canLeavePauseMenu = true
        },
        startStopServer() {
            if (multi.server) {
                closePhysicsServerAndSaveState()
            } else {
                createPhysicsServerFromCurrentState()
            }
        },
        updateServerStatus() {
            const startServerButton = this.userButtons![1]
            if (multi.server) {
                startServerButton.setText('Stop server')
            } else {
                startServerButton.setText('Start server')
            }
        },
    })
})
