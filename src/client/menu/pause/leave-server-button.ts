import { prestart } from '../../../loading-stages'
import { assert } from '../../../misc/assert'
import { closePhysicsServerAndSaveState } from '../../../server/physics/create-from-current-state'
import { schedulePostTask } from 'cc-instanceinator/src/inst-util'
import { isPhysics } from '../../../server/physics/physics-server-types'

declare global {
    namespace sc {
        interface PauseScreenGui {
            toTitleButtonBackup?: {
                text: string
                onButtonPress: () => void
            }
        }
    }
}
prestart(() => {
    sc.PauseScreenGui.inject({
        doStateTransition(...args) {
            this.parent(...args)
            if (multi.server && ig.client) {
                this.toTitleButtonBackup = {
                    text: this.toTitleButton.text!.toString(),
                    onButtonPress: this.toTitleButton.onButtonPress,
                }

                const isMaster = PHYSICS && isPhysics(multi.server) && multi.server.getMasterClient() == ig.client

                const { text, dialogText } = isMaster
                    ? {
                          text: 'Stop server',
                          dialogText: 'Stop the server? \\c[0]',
                      }
                    : {
                          text: 'Leave server',
                          dialogText: 'Leave the server? \\c[0]',
                      }

                this.toTitleButton.setText(text, true)
                this.toTitleButton.onButtonPress = () => {
                    ig.canLeavePauseMenu = false
                    const onClick = (button: { data: number }) => {
                        ig.canLeavePauseMenu = true
                        if (button.data == 0) {
                            ig.interact.removeEntry(this.buttonInteract)
                            assert(ig.client)
                            if (isMaster) {
                                PHYSICS && closePhysicsServerAndSaveState()
                            } else {
                                const client = ig.client
                                schedulePostTask(multi.server.inst, () => {
                                    multi.server.leaveClient(client)
                                })
                            }
                        }
                    }
                    if (DEV) {
                        onClick({ data: 0 })
                    } else {
                        sc.Dialogs.showYesNoDialog(dialogText, sc.DIALOG_INFO_ICON.QUESTION, onClick)
                    }
                }
            } else if (this.toTitleButtonBackup) {
                this.toTitleButton.setText(this.toTitleButtonBackup.text)
                this.toTitleButton.onButtonPress = this.toTitleButtonBackup.onButtonPress
                this.toTitleButtonBackup = undefined
            }
        },
    })
})
