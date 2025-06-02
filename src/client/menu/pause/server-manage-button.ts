import { assert } from '../../../misc/assert'
import { prestart } from '../../../plugin'
import {
    closePhysicsServerAndSaveState,
    createPhysicsServerFromCurrentState,
} from '../../../server/physics/create-from-current-state'
import { PhysicsServer } from '../../../server/physics/physics-server'
import { ClientJoinData, isUsernameValid, showTryNetJoinResponseDialog } from '../../../server/server'

export function openManagerServerPopup(immediately?: boolean) {
    ig.multibakeryManageServerPopup ??= new multi.class.ManageServerPopup()
    ig.multibakeryManageServerPopup.openMenu()
    if (immediately) {
        ig.multibakeryManageServerPopup.doStateTransition('DEFAULT', true)
        ig.multibakeryManageServerPopup.msgBox.doStateTransition('DEFAULT', true)
    }
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

            this.multibakeryManageServerButton = new sc.ButtonGui('\\i[help2]' + 'Manage server')

            let y = 3
            // @ts-ignore from archipelago mod CCMultiworldRandomizer
            if (sc.multiworld) {
                y = 30
            }
            this.multibakeryManageServerButton.setPos(3, y)

            this.buttonGroup.addFocusGui(this.multibakeryManageServerButton, 999, 999)
            this.multibakeryManageServerButton.onButtonPress = () => openManagerServerPopup()
            this.buttonInteract.addGlobalButton(this.multibakeryManageServerButton, () => sc.control.menuHotkeyHelp2())
            this.addChildGui(this.multibakeryManageServerButton)
        },
    })
})

type MultiPageButtonGuiButtons = ConstructorParameters<modmanager.gui.MultiPageButtonBoxGuiConstructor>[2]

declare global {
    namespace multi.class {
        interface ManageServerPopup extends modmanager.gui.MultiPageButtonBoxGui {
            updateContent(this: this): void
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
            const buttons: MultiPageButtonGuiButtons = []
            buttons.push({
                name: 'Close',
                onPress() {
                    self.closeMenu()
                },
            })

            const isMaster = ig.client && ig.client.player.username == multi.server.masterUsername

            if (!multi.server) {
                buttons.push({
                    name: 'Start server',
                    onPress() {
                        createPhysicsServerFromCurrentState()
                    },
                })
            } else if (multi.server instanceof PhysicsServer && isMaster) {
                buttons.push({
                    name: 'Stop server',
                    onPress() {
                        closePhysicsServerAndSaveState()
                    },
                })
            }

            if (isMaster) {
                buttons.push({
                    name: 'Create client',
                    async onPress() {
                        const dialog = new multi.class.InputFieldDialog(200, 'Enter username', [
                            {
                                name: 'Ok',
                                async onPress() {
                                    dialog.closeMenu()
                                    const username = dialog.inputWrapper.inputField.getValueAsString()

                                    const joinData: ClientJoinData = { username }
                                    const igBackup = ig
                                    const { ackData } = await multi.server.tryJoinClient(joinData, false)
                                    igBackup.game.scheduledTasks.push(() => {
                                        showTryNetJoinResponseDialog(joinData, ackData)
                                    })
                                },
                            },
                            {
                                name: 'Cancel',
                                onPress() {
                                    dialog.closeMenu()
                                },
                            },
                        ])
                        dialog.openMenu()
                    },
                })
            }

            let callAfterParent: (() => void) | undefined

            const inputManager = ig.client?.player.inputManager
            if (inputManager) {
                const buttonI = buttons.length
                const updateButtonText = () => {
                    const button = this.userButtons![buttonI]
                    assert(button)
                    button.setText(
                        `Switch to \\i[${inputManager.inputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE ? 'gamepad' : 'controls'}]`
                    )
                }

                buttons.push({
                    name: '',
                    onPress() {
                        inputManager.setInputType(
                            inputManager.inputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE
                                ? ig.INPUT_DEVICES.GAMEPAD
                                : ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE
                        )
                        updateButtonText()
                        assert(ig.client)
                        ig.client.updateGamepadForcer()
                    },
                })
                callAfterParent = () => updateButtonText()
            }

            this.parent(400, 100, buttons)
            callAfterParent?.()
            this.hook.temporary = true
        },
        openMenu() {
            this.parent()
            ig.canLeavePauseMenu = false
            this.updateContent()
        },
        closeMenu() {
            this.parent()
            ig.canLeavePauseMenu = true
        },
        updateContent() {
            this.setContent('Server', [
                {
                    content: ['hi'],
                },
            ])
        },
    })
})

declare global {
    namespace multi.class {
        interface InputFieldDialog extends modmanager.gui.MultiPageButtonBoxGui {
            inputWrapper: modmanager.gui.InputFieldWrapper
        }
        interface InputFieldDialogConstructor extends ImpactClass<InputFieldDialog> {
            new (width: number, title: string, buttons: MultiPageButtonGuiButtons): InputFieldDialog
        }
        var InputFieldDialog: InputFieldDialogConstructor
    }
}
prestart(() => {
    multi.class.InputFieldDialog = modmanager.gui.MultiPageButtonBoxGui.extend({
        init(width, title, buttons) {
            this.parent(width, 70, buttons)

            this.setContent(title, [{ content: [''] }])
            this.inputWrapper = new modmanager.gui.InputFieldWrapper('lea', () => {}, width, isUsernameValid)
        },
        openMenu() {
            this.parent()
            this.scrollContainer.setElement(this.inputWrapper)
            this.userButtonGroup!.addFocusGui(this.inputWrapper.inputField, 999, 999)
        },
    })
})
