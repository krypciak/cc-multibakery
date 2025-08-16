import type { InputFieldIsValidFunc } from 'ccmodmanager/types/mod-options'
import { prestart } from '../plugin'

declare global {
    namespace ig.EVENT_STEP {
        namespace SHOW_INPUT_DIALOG {
            interface Settings {
                width?: number
                title: ig.Event.StringExpression
                initialValue?: ig.Event.StringExpression
                saveToVar: ig.Event.StringExpression
                validRegex?: ig.Event.StringExpression
            }
            interface Data {
                dialog: multi.class.InputFieldDialog
            }
        }
        interface SHOW_INPUT_DIALOG extends ig.EventStepBase {
            width: number
            title: ig.Event.StringExpression
            initialValue?: ig.Event.StringExpression
            saveToVar: ig.Event.StringExpression
            validRegex?: ig.Event.StringExpression

            start(this: this, data: ig.EVENT_STEP.SHOW_INPUT_DIALOG.Data, eventCall?: ig.EventCall): void
            run(this: this, data: ig.EVENT_STEP.SHOW_INPUT_DIALOG.Data): boolean
        }
        interface SHOW_INPUT_DIALOG_CONSTRUCTOR extends ImpactClass<SHOW_INPUT_DIALOG> {
            new (settings: ig.EVENT_STEP.SHOW_INPUT_DIALOG.Settings): SHOW_INPUT_DIALOG
        }
        var SHOW_INPUT_DIALOG: SHOW_INPUT_DIALOG_CONSTRUCTOR
    }
}

prestart(() => {
    ig.EVENT_STEP.SHOW_INPUT_DIALOG = ig.EventStepBase.extend({
        init(settings) {
            this.width = settings.width ?? 200
            this.title = settings.title
            this.initialValue = settings.initialValue ?? ''
            this.saveToVar = settings.saveToVar
            this.validRegex = settings.validRegex
        },
        start(data, _eventCall) {
            const title = ig.Event.getExpressionValue(this.title)
            const initialValue = ig.Event.getExpressionValue(this.initialValue)?.toString() ?? ''
            const saveToVar = ig.Event.getExpressionValue(this.saveToVar)

            let isValid: InputFieldIsValidFunc | undefined
            if (this.validRegex) {
                const regex = new RegExp(ig.Event.getExpressionValue(this.validRegex))
                isValid = text => {
                    const isValid = regex.test(text)
                    dialog?.userButtons![0].setActive(isValid)
                    return isValid
                }
            }

            let dialog: multi.class.InputFieldDialog
            dialog = new multi.class.InputFieldDialog(
                this.width,
                title,
                initialValue,
                [
                    {
                        name: 'Ok',
                        onPress() {
                            ig.vars.set(saveToVar, dialog.getText())
                            ig.vars.set('tmp.dialogAccepted', true)
                            dialog.closeMenu()
                        },
                    },
                    {
                        name: 'Cancel',
                        onPress() {
                            ig.vars.set('tmp.dialogAccepted', false)
                            dialog.closeMenu()
                        },
                    },
                ],
                isValid
            )
            dialog.openMenu()
            data.dialog = dialog
        },
        run({ dialog }) {
            return dialog.hook.currentStateName != 'DEFAULT'
        },
    })
})
