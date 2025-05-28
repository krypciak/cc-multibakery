import { prestart } from '../../../plugin'
import { assert } from '../../../misc/assert'
import { PhysicsServer } from '../../../server/physics/physics-server'
import { closePhysicsServerAndSaveState } from '../../../server/physics/create-from-current-state'

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

                const isMaster =
                    ig.client &&
                    multi.server instanceof PhysicsServer &&
                    multi.server.masterUsername == ig.client.player?.username

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
                    sc.Dialogs.showYesNoDialog(dialogText, sc.DIALOG_INFO_ICON.QUESTION, button => {
                        ig.canLeavePauseMenu = true
                        if (button.data == 0) {
                            ig.interact.removeEntry(this.buttonInteract)
                            assert(ig.client)
                            if (isMaster) {
                                closePhysicsServerAndSaveState()
                            } else {
                                multi.server.leaveClient(ig.client)
                            }
                        }
                    })
                }
            } else if (this.toTitleButtonBackup) {
                this.toTitleButton.setText(this.toTitleButtonBackup.text)
                this.toTitleButton.onButtonPress = this.toTitleButtonBackup.onButtonPress
                this.toTitleButtonBackup = undefined
            }
        },
    })
})
