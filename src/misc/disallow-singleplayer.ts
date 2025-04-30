import { prestart } from '../plugin'

declare global {
    var ccbundler: boolean
}
prestart(() => {
    if (!('ccbundler' in window && window.ccbundler)) return
    sc.TitleScreenButtonGui.inject({
        show() {
            this.parent()
            const disable = (name: string) => {
                const button = this.namedButtons[name]
                if (!button) return
                button.setActive(false)
            }
            disable('start')
            disable('startPlus')
            disable('loadGame')
            disable('continue')
        },
    })
})
