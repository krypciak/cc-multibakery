import { assert } from '../../../misc/assert'
import { generateRandomUsername, isUsernameValid } from '../../../misc/username-util'
import { prestart } from '../../../plugin'
import {
    closePhysicsServerAndSaveState,
    createPhysicsServerFromCurrentState,
} from '../../../server/physics/create-from-current-state'
import { PhysicsServer } from '../../../server/physics/physics-server'
import { ClientJoinData, showTryNetJoinResponseDialog } from '../../../server/server'

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
            multibakeryManageServerPopup: multi.class.ManageServerPopup
        }
    }
}

function getIconFromInputType(inputType: ig.INPUT_DEVICES | undefined): string {
    return inputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE ? 'controls' : 'gamepad'
}

type MultiPageButtonGuiButtons = NonNullable<ConstructorParameters<modmanager.gui.MultiPageButtonBoxGuiConstructor>[2]>

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
        var multibakeryManageServerPopup: multi.class.ManageServerPopup | undefined
    }
}

class InputButton {
    private dialog!: modmanager.gui.MultiPageButtonBoxGui

    constructor(
        public inputType: ig.INPUT_DEVICES,
        public onPress: () => void = () => {}
    ) {}

    private getInputButtonText() {
        return `\\i[${getIconFromInputType(this.inputType)}]`
    }

    setDialog(dialog: modmanager.gui.MultiPageButtonBoxGui) {
        this.dialog = dialog
    }

    pushConfig(buttons: MultiPageButtonGuiButtons) {
        const inputButtonI = buttons.length
        const self = this
        buttons.push({
            name: this.getInputButtonText(),

            onPress() {
                self.inputType =
                    self.inputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE
                        ? ig.INPUT_DEVICES.GAMEPAD
                        : ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE

                assert(self.dialog)
                const button = self.dialog.userButtons![inputButtonI]
                assert(button)
                button.setText(self.getInputButtonText())

                self.onPress()
            },
        })
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

            if (PHYSICS) {
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
            }

            if (isMaster) {
                buttons.push({
                    name: 'Create client',
                    async onPress() {
                        const buttons: MultiPageButtonGuiButtons = []
                        buttons.push({
                            name: 'Ok',
                            async onPress() {
                                dialog.closeMenu()
                                const username = dialog.inputWrapper.inputField.getValueAsString()

                                const joinData: ClientJoinData = {
                                    username,
                                    initialInputType: inputButton.inputType,
                                }
                                const igBackup = ig
                                const { ackData } = await multi.server.tryJoinClient(joinData, false)
                                igBackup.game.scheduledTasks.push(() => {
                                    showTryNetJoinResponseDialog(joinData, ackData)
                                })
                            },
                        })

                        buttons.push({
                            name: 'Cancel',
                            onPress() {
                                dialog.closeMenu()
                            },
                        })

                        const inputButton = new InputButton(ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE)
                        inputButton.pushConfig(buttons)

                        const dialog = new multi.class.InputFieldDialog(200, 'Enter username', buttons)
                        inputButton.setDialog(dialog)
                        dialog.openMenu()
                    },
                })
            }

            const inputManager = ig.client?.player.inputManager
            let inputButton: InputButton | undefined
            if (inputManager) {
                inputButton = new InputButton(ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE, () => {
                    inputManager.setInputType(inputButton!.inputType)
                    assert(ig.client)
                    ig.client.updateGamepadForcer()
                })
                inputButton.pushConfig(buttons)
            }

            this.parent(320, 100, buttons)
            inputButton?.setDialog(this)
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
            this.inputWrapper = new modmanager.gui.InputFieldWrapper(
                generateRandomUsername(),
                () => {},
                width,
                isUsernameValid
            )
            this.scrollContainer.scrollPane.removeChildGui(this.scrollContainer.scrollPane.scrollbarV!)
        },
        openMenu() {
            this.parent()
            this.scrollContainer.setElement(this.inputWrapper)
            this.userButtonGroup!.addFocusGui(this.inputWrapper.inputField, 999, 999)
            this.scrollContainer.setPos(this.scrollContainer.hook.pos.x, this.scrollContainer.hook.pos.y + 1)
        },
    })
})
