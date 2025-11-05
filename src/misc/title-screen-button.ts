import { prestart } from '../loading-stages'

interface ButtonConfig {
    text: string
    onClick: () => void
}
const buttonConfigs: ButtonConfig[] = []

export function addTitleScreenButton(config: ButtonConfig) {
    buttonConfigs.push(config)
}

declare global {
    namespace sc {
        interface TitleScreenButtonGui {
            customButtons: sc.ButtonGui[]
            serverListButton: sc.ButtonGui
        }
    }
}

prestart(() => {
    sc.TitleScreenButtonGui.inject({
        init() {
            this.parent()

            this.customButtons = buttonConfigs.map(({ text, onClick }) => {
                // Get the first button in the second column so we can position our button above it.
                const lastButton = this.buttonGroup.elements[1].find(Boolean)!.hook

                const button = new sc.ButtonGui(text, lastButton.size.x)
                button.setAlign(lastButton.align.x, lastButton.align.y)
                button.setPos(lastButton.pos.x, lastButton.pos.y + 28)

                button.hook.transitions = lastButton.transitions
                button.doStateTransition('HIDDEN', true)

                this.buttonGroup.insertFocusGui(button, 1, 0)
                this.insertChildGui(button, 0)

                button.onButtonPress = onClick

                return button
            })
        },
        show() {
            this.parent()
            for (const button of this.customButtons) button.doStateTransition('DEFAULT')
        },
        hide(skipTransition) {
            this.parent(skipTransition)
            for (const button of this.customButtons) button.doStateTransition('HIDDEN')
        },
    })
})
