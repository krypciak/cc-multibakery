import { assert } from '../../../misc/assert'
import { generateRandomUsername, isUsernameValid } from '../../../misc/username-util'
import { prestart } from '../../../loading-stages'
import {
    closePhysicsServerAndSaveState,
    createPhysicsServerFromCurrentState,
} from '../../../server/physics/create-from-current-state'
import { createClientJoinData, showTryNetJoinResponseDialog } from '../../../server/server'
import { checkNwjsVerionAndCreatePopupIfProblemsFound } from '../../../misc/nwjs-version-popup'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { isPhysics } from '../../../server/physics/is-physics-server'
import type { MultiPageButtonGuiButtons } from 'cc-krypek-lib/src/input-field-dialog'

declare global {
    namespace ig {
        var multibakeryManageServerPopup: multi.class.ManageServerPopup | undefined
    }
}
export async function openManagerServerPopup(immediately?: boolean) {
    if (ig.multibakeryManageServerPopup) {
        ig.multibakeryManageServerPopup.closeMenu()
    } else {
        if (!multi.server) await checkNwjsVerionAndCreatePopupIfProblemsFound()
    }
    ig.multibakeryManageServerPopup = new multi.class.ManageServerPopup()
    ig.multibakeryManageServerPopup.openMenu()
    if (immediately) {
        ig.multibakeryManageServerPopup.doStateTransition('DEFAULT', true)
        ig.multibakeryManageServerPopup.msgBox.doStateTransition('DEFAULT', true)
    }
}

function getIconFromInputType(inputType: ig.INPUT_DEVICES | undefined): string {
    return inputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE ? 'controls' : 'gamepad'
}

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
}

class InputButton {
    private dialog!: modmanager.gui.MultiPageButtonBoxGui

    constructor(
        public inputType: ig.INPUT_DEVICES = ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE,
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

            const isMaster = ig.client && ig.client == multi.server.getMasterClient()

            if (PHYSICS) {
                if (!multi.server) {
                    buttons.push({
                        name: 'Start server',
                        onPress() {
                            self.closeMenu()
                            self.doStateTransition('HIDDEN', true, true)
                            PHYSICS && createPhysicsServerFromCurrentState()
                        },
                    })
                } else if (isPhysics(multi.server) && isMaster) {
                    buttons.push({
                        name: 'Stop server',
                        onPress() {
                            PHYSICS && closePhysicsServerAndSaveState()
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
                                const username = dialog.getText()

                                const joinData = createClientJoinData({
                                    username,
                                    initialInputType: inputButton.inputType,
                                    prefferedTpInfo: ig.client?.tpInfo,
                                })
                                const igBackup = ig
                                const { ackData } = await runTask(multi.server.inst, () =>
                                    multi.server.tryJoinClient(joinData)
                                )
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

                        const inputButton = new InputButton()
                        inputButton.pushConfig(buttons)

                        /* not on the same line since accessing dialog in the text validation function would throw */
                        let dialog: sc.InputFieldDialog
                        dialog = new sc.InputFieldDialog(
                            200,
                            'Enter username',
                            generateRandomUsername(),
                            buttons,
                            text => {
                                const isValid = isUsernameValid(text) && !multi.server.clients.has(text)
                                dialog?.userButtons![0].setActive(isValid)
                                return isValid
                            }
                        )
                        inputButton.setDialog(dialog)

                        self.blockClosing = true
                        const orig = dialog.closeMenu
                        dialog.closeMenu = () => {
                            self.blockClosing = false
                            orig.call(dialog)
                        }

                        dialog.openMenu()
                    },
                })
            }

            const inputManager = ig.client?.inputManager
            let inputButton: InputButton | undefined
            if (inputManager) {
                inputButton = new InputButton(inputManager.inputType, () => {
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
            if (this.blockClosing) return
            ig.canLeavePauseMenu = true
            ig.multibakeryManageServerPopup = undefined
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
