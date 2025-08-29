import { prestart } from '../../../loading-stages'
import { PhysicsServer } from '../physics-server'

prestart(() => {
    function updateButton(button: sc.ButtonGui) {
        if (!multi.server) return

        const active = multi.server instanceof PhysicsServer && !!multi.server.settings.saveToSaveFile
        button.setActive(active)
    }
    sc.PauseScreenGui.inject({
        updateButtons(refocus) {
            this.parent(refocus)
            updateButton(this.saveGameButton)
        },
    })
    sc.StartMenu.inject({
        showMenu() {
            this.parent()
            updateButton(this.buttons.save)
        },
    })
})
