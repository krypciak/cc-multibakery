export function disableSmallEntityBoxAdding<T>(func: () => T): { ret: T; text?: string; box?: sc.SmallEntityBox } {
    const backup = ig.gui.addGuiElement
    let text: string | undefined
    let box: sc.SmallEntityBox | undefined
    ig.gui.addGuiElement = gui => {
        if (gui instanceof sc.SmallEntityBox) {
            text = gui.textGui.text?.toString()
            box = gui
        } else {
            backup.call(ig.gui, gui)
        }
    }
    const ret = func()
    ig.gui.addGuiElement = backup

    return { ret, text, box }
}
