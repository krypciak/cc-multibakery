import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type {} from 'ccmodmanager/types/local-mods'
import { prestart } from '../loading-stages'
import { RemoteServer } from '../server/remote/remote-server'
import { PhysicsServer } from '../server/physics/physics-server'
import Multibakery from '../plugin'
import { assert } from './assert'

prestart(() => {
    ig.System.inject({
        error(error) {
            if (!multi.server) return this.parent(error)
            throw error
        },
    })
})

function gatherInfo(err: unknown, inst: InstanceinatorInstance) {
    const isCCL3 = Multibakery.mod.isCCL3
    const version = ig.game?.getVersion()
    const platform = ig.getPlatformName(ig.platform)
    const os = ig.OS
    const nwjsVersion = ig.nwjsVersion && ig.nwjsVersion[0]
    const browserVersion = ig.browserVersion
    const stackTrace =
        err instanceof Error
            ? (err.stack ?? 'empty stack??')
            : typeof err == 'object' && err && 'message' in err
              ? err.message
              : 'not an error??'
    const instName = inst.name

    const server = multi.server
    let serverTypeSpecificInfo: string = `clients: [${[...server.clients.values()].map(c => `(${c.username}, ${c.tpInfo.map})`).join(', ')}]\n`
    if (server instanceof RemoteServer) {
        const connectionInfo = server.netManager?.conn?.getConnectionInfo()
        serverTypeSpecificInfo += `${connectionInfo ? `connection: ${connectionInfo}` : ''}\n`
    } else if (server instanceof PhysicsServer) {
    } else assert(false)

    const infoText =
        `ccV: ${version},   cclV: ${isCCL3 ? '3' : '2'},  OS: ${os},   platform: ${platform},   ` +
        `nwjsV: ${nwjsVersion},   browserV: ${browserVersion},   instance: ${instName}` +
        '\n' +
        serverTypeSpecificInfo +
        '\n' +
        `${stackTrace}`

    const mods: [string, string | undefined][] = isCCL3
        ? Array.from(window.modloader.loadedMods.values()).map(m => [m.id, m.version?.toString()])
        : window.activeMods.map(m => [m.name, m.version?.toString()])
    const modsText = mods.map(m => `${m[0]}  ${m[1] ?? 'versionNull'}`).reduce((v, acc) => acc + '\n' + v)

    return { infoText, modsText }
}

let shown: boolean = false
export function isErrorPopupShown(): boolean {
    return shown
}
export function showServerErrorPopup(inst: InstanceinatorInstance, err: unknown) {
    if (shown) return
    shown = true
    const hide = () => {
        shown = false
        document.body.removeChild(div)
    }

    const { infoText, modsText } = gatherInfo(err, inst)

    const bg = '#1d1f21'
    const fg = '#fcfcfc'
    const bgTextField = '#303336'
    const fgTextField = '#fcfcfc'

    const textAreaStyle: string = `${bgTextField ? `background-color: ${bgTextField};` : ''} ${
        fgTextField ? `foreground-color: ${fgTextField};` : ''
    }`

    const div = document.createElement('div')
    div.classList = 'errorMessage shown'
    div.style.backgroundColor = bg
    div.style.color = fg
    div.style.top = '40%'
    div.style.height = '600px'
    div.style.marginTop = '-200px'
    div.style.transition = 'all 1s'

    div.innerHTML = `
        <h3>CRITICAL BUG!</h3>
        <p class="top">
            uhhh cc-multibakery crashed<br>
            Please report it here ↓↓↓ <br>
            <img src="${`https://img.shields.io/discord/382339402338402315?logo=discord&logoColor=white&label=CrossCode%20Modding`}">
        </p>
        <textarea id="textarea1" readonly style="${textAreaStyle}">${infoText}</textarea>
        <textarea id="textareaMods" readonly style="${textAreaStyle}">${modsText}</textarea>
        <p class="bottom"></p>
    `

    function openLink(url: string) {
        if (ig.platform == ig.PLATFORM_TYPES.DESKTOP) {
            nw.Shell.openExternal(url)
        } else {
            window.open(url, '_blank')?.focus()
        }
    }

    const discordBadgeImg = div.getElementsByTagName('img')[0]
    discordBadgeImg.onclick = () => openLink(`https://discord.gg/ZuqTeevse8`)

    const copy = (str: string) => {
        if ('nw' in window) {
            nw.Clipboard.get().set(str)
        } else {
            try {
                navigator.clipboard.writeText(str)
            } catch (e) {}
        }
    }

    const appendButton = (action: () => void, name: string) => {
        const button = document.createElement('a')
        button.className = 'bigButton'
        button.onclick = action
        button.textContent = name
        div.append(button)
    }
    appendButton(() => hide(), 'Close popup')
    appendButton(() => location.reload(), 'Restart the Game')
    appendButton(() => copy(infoText), 'Copy crash log')
    appendButton(() => copy(modsText), 'Copy mod list')

    document.body.appendChild(div)
}
