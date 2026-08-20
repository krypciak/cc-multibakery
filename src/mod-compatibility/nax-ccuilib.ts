import { runTask } from 'cc-instanceinator/src/inst-util'
import type { Client } from '../client/client'
import { poststart } from '../loading-stages'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

export type CCUILibRingConf = ReturnType<typeof nax.ccuilib.loadRingConfigData>
export function getCCUILibRingConfFrom(nax: typeof window.nax): CCUILibRingConf {
    const conf = { ...nax.ccuilib.quickRingUtil.ringConf }
    nax.ccuilib.quickRingUtil.sanitizeRingConfig(conf)
    return conf
}

declare global {
    namespace ig {
        var savedQuickRingConf: CCUILibRingConf
    }
}

export function setCCUILibRingConf(client: Client, conf: CCUILibRingConf) {
    runTask(client.inst, () => {
        nax.ccuilib.quickRingUtil = { ...nax.ccuilib.quickRingUtil }
        ig.savedQuickRingConf = conf
    })
}

poststart(() => {
    const origLoad = nax.ccuilib.loadRingConfigData
    nax.ccuilib.loadRingConfigData = () => {
        if (!multi.server) return origLoad()
        return ig.savedQuickRingConf ?? origLoad()
    }

    const origSave = nax.ccuilib.saveRingConfigData
    nax.ccuilib.saveRingConfigData = conf => {
        if (!multi.server) return origSave(conf)
        ig.savedQuickRingConf = conf

        if (ig.client && multi.server.getMasterClient() == ig.client) {
            origSave(conf)
        }
    }
})

export function getCCUILibWidgetsList() {
    return Object.keys(nax.ccuilib.QuickRingMenuWidgets.widgets).filter(k => !k.startsWith('dummy'))
}

export function filterOutCCUILibWidgetsGivenWhitelist(inst: InstanceinatorInstance, ccuilibWidgets: string[]) {
    const qrmw = inst.nax!.ccuilib.QuickRingMenuWidgets
    const widgets = new Set(ccuilibWidgets)

    qrmw.widgets = Object.fromEntries(Object.entries(qrmw.widgets).filter(([k]) => widgets.has(k)))
}
