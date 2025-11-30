import type { MultiPageButtonGuiButtons } from '../client/menu/pause/server-manage-button'
import { COLOR, wrapColor } from '../misc/wrap-color'
import { Opts } from '../options'

type Problem = 'win_remote_crash' | 'performance'

const winRemoteCrashVersion = '0.37.0'
const performanceProblemsVersion = '0.60.0'

const nwVer = process.versions.nw

// @ts-expect-error
export const semver: typeof ccmod.semver = window.ccmod.semver ?? window.semver

function getNwjsVersionProblems(): Problem[] {
    const problems: Problem[] = []
    if (process.platform == 'win32') {
        /* tested, it doesnt crash on 0.37.1 */
        if (semver.lte(nwVer, winRemoteCrashVersion)) {
            problems.push('win_remote_crash')
        }
    }
    /* higher version just to be safe */
    if (semver.lt(nwVer, performanceProblemsVersion)) {
        problems.push('performance')
    }
    return problems
}

function wrapVer(ver: string) {
    return wrapColor('v' + ver, COLOR.YELLOW)
}

function openLink(url: string) {
    if (ig.platform == ig.PLATFORM_TYPES.DESKTOP) {
        nw.Shell.openExternal(url)
    } else {
        window.open(url, '_blank')?.focus()
    }
}

export async function checkNwjsVerionAndCreatePopupIfProblemsFound(
    criticalProblems: Problem[] = []
): Promise<Problem[]> {
    const problems = getNwjsVersionProblems()
    if (problems.length == 0) return []

    if (!Opts.showNwjsVersionProblemsPopup && problems.every(problem => !criticalProblems.includes(problem)))
        return problems

    const buttons: MultiPageButtonGuiButtons = []
    buttons.push({
        name: 'Close',
        onPress() {
            popup.closeMenu()
        },
    })

    const problemDescriptions: Record<Problem, string> = {
        win_remote_crash: `NW.js versions including and below ${wrapVer(winRemoteCrashVersion)} on Windows ${wrapColor('cannot', COLOR.RED)} join multiplayer servers.`,
        performance: `NW.js versions below ${wrapVer(performanceProblemsVersion)} may suffer performance problems, especially when using the split screen functionality.`,
    }

    const text =
        `Problems with your outdated NW.js version (${wrapVer(nwVer)}):\n` +
        problems.map(id => '- ' + problemDescriptions[id]).join('\n') +
        '\n\nFollow video instructions linked below and/or follow this text guide:\n' +
        `1. Download NORMAL NW.js from ${wrapColor('https://nwjs.io', COLOR.YELLOW)}\n` +
        '2. Go to where CrossCode is installed\n' +
        `3. Delete the executable ${wrapColor('CrossCode.exe', COLOR.YELLOW)}\n` +
        "4. Extract what's inside the .zip and open the extracted folder.\n" +
        '5. Drag everything from there to your main CrossCode directory.\n' +
        `6. Rename ${wrapColor('nw.exe', COLOR.YELLOW)} to ${wrapColor('CrossCode.exe', COLOR.YELLOW)}\n`

    buttons.push({
        name: wrapColor('nwjs.io', COLOR.YELLOW),
        onPress() {
            openLink('https://nwjs.io')
        },
    })

    buttons.push({
        name: wrapColor('NW.js update video guide', COLOR.YELLOW),
        onPress() {
            openLink('https://streamable.com/skg4r1')
        },
    })

    const popup = new modmanager.gui.MultiPageButtonBoxGui(500, 300, buttons)
    popup.hook.temporary = true
    popup.setContent(wrapColor('Outdated NW.js!', COLOR.RED), [{ content: [text] }])

    return new Promise<Problem[]>(resolve => {
        const orig = popup.closeMenu
        popup.closeMenu = function (this: modmanager.gui.MultiPageButtonBoxGui) {
            orig.call(this)
            resolve(problems)
        }

        popup.openMenu()
    })
}
