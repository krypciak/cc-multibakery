import type { InputFieldIsValidFunc } from 'ccmodmanager/types/mod-options'
import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'

declare global {
    namespace ig.EVENT_STEP {
        namespace SHOW_INPUT_DIALOG {
            interface Settings {
                width?: number
                title: ig.Event.StringExpression
                initialValue?: ig.Event.StringExpression
                saveToVar?: ig.Event.StringExpression
                validRegex?: ig.Event.StringExpression

                accepted?: ig.EventStepBase.Settings[]
                declined?: ig.EventStepBase.Settings[]

                validFunction?: (str: string) => boolean
            }
            interface Data {
                dialog: multi.class.InputFieldDialog
                accepted: boolean
            }
        }
        interface SHOW_INPUT_DIALOG extends ig.EventStepBase {
            width: number
            title: ig.Event.StringExpression
            initialValue?: ig.Event.StringExpression
            saveToVar?: ig.Event.StringExpression
            validRegex?: ig.Event.StringExpression
            branchList: string[]

            validFunction?: (str: string) => boolean

            start(this: this, data: ig.EVENT_STEP.SHOW_INPUT_DIALOG.Data, eventCall?: ig.EventCall): void
            run(this: this, data: ig.EVENT_STEP.SHOW_INPUT_DIALOG.Data): boolean
            getNext(this: this, data: ig.EVENT_STEP.SHOW_INPUT_DIALOG.Data): Nullable<ig.EventStepBase>
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
            this.validFunction = settings.validFunction

            this.branchList = []
            if (settings.accepted) this.branchList.push('accepted')
            if (settings.declined) this.branchList.push('declined')
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
            if (this.validFunction) {
                assert(!this.validRegex)
                isValid = this.validFunction
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
                            const text = dialog.getText()
                            if (saveToVar) ig.vars.set(saveToVar, text)
                            dialog.closeMenu()
                            data.accepted = true
                        },
                    },
                    {
                        name: 'Cancel',
                        onPress() {
                            dialog.closeMenu()
                            data.accepted = false
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
        getBranchNames() {
            return this.branchList
        },
        getNext(data) {
            const step = this.branches![data.accepted ? 'accepted' : 'declined']
            if (step) return step
            return this.parent(data)
        },
    })
})
