import { LocalServer } from './local-server'

export function indent(indent: number) {
    return '  '.repeat(indent)
}
function insertButton(name: string, onPress: () => void) {
    const title = ig.gui.guiHooks.find(a => a.gui instanceof sc.TitleScreenGui)!.gui as sc.TitleScreenGui
    const but = title.buttons

    const lastI = but.buttonGroup.elements[1].length - 1
    const parentHook = but.buttonGroup.elements[1][lastI].hook

    const b = new sc.ButtonGui(name, parentHook.size.x)
    but.buttons.push(b)
    b.setAlign(parentHook.align.x, parentHook.align.y)
    b.setPos(parentHook.pos.x, parentHook.pos.y + 28)
    b.onButtonPress = onPress
    b.hook.transitions = parentHook.transitions
    b.doStateTransition('HIDDEN', true)
    but.buttonGroup.addFocusGui(b, 1, lastI + 1)
    but.addChildGui(b)
}
function updateContent() {
    let str = ''
    str += `server name: \\c[3]${multi.server.s.name}\\c[0]\n`
    str += `globalTps: \\c[3]${multi.server.s.globalTps}\\c[0]\n`
    str += `godmode: \\c[3]${multi.server.s.godmode}\\c[0]\n`
    if (multi.server instanceof LocalServer) {
        str += `maps: {\n`
        for (const map of Object.values(multi.server.maps)) {
            str += map.toConsoleString(1)
        }
        str += `}\n`
    }
    consoleDialog.setContent('Console', [
        {
            title: 'Console',
            content: [str],
        },
    ], false)
    consoleDialog.refreshPage()
}
let intervalId: NodeJS.Timeout | undefined
export function openServerConsole() {
    updateContent()
    consoleDialog.openMenu()
    if (intervalId) {
        clearInterval(intervalId)
        intervalId = undefined
    }
    intervalId = setInterval(() => {
        if (!consoleDialog.isVisible() && intervalId) {
            clearInterval(intervalId)
            intervalId = undefined
        }
        updateContent()
    }, 300)
}

let consoleDialog: modmanager.gui.MultiPageButtonBoxGui
export function initConsoleDialog() {
    consoleDialog = new modmanager.gui.MultiPageButtonBoxGui(undefined, undefined, [
        {
            name: 'Close',
            onPress: () => {
                consoleDialog.closeMenu()
            },
        },
    ])
    insertButton('Server console', () => {
        openServerConsole()
    })
}
