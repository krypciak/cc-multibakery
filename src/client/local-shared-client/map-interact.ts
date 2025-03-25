import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../../misc/assert'
import { LocalServer, waitForScheduledTask } from '../../server/local-server'
import { LocalSharedClient } from './local-shared-client'
import { prestart } from '../../plugin'

function cloneIconHoverTextGui(subGui: sc.IconHoverTextGui): sc.IconHoverTextGui {
    let title: string | undefined
    let textGui: ig.GuiElementBase
    if (subGui.hook.children.length == 2) {
        const titleGui = subGui.hook.children[0].gui as sc.TextGui
        assert(titleGui instanceof sc.TextGui)
        title = titleGui.text!.toString()

        textGui = subGui.hook.children[1].gui as sc.TextGui
    } else {
        textGui = subGui.hook.children[0].gui as sc.TextGui
    }
    assert(textGui instanceof sc.TextGui)
    const text = textGui.text!.toString()
    const gui = new sc.IconHoverTextGui(text, textGui.hook.pos.y, subGui.showOnNear, title)
    Vec2.assign(gui.hook.pos, subGui.hook.pos)
    return gui
}
function cloneMapInteractEntry(e: sc.MapInteractEntry): sc.MapInteractEntry {
    // TODO elevator ruining my day, it makes double icons
    const ne = new sc.MapInteractEntry(e.entity, e.handler, e.icon, e.zCondition, e.interrupting)
    ne.gui.offset = Vec2.create(e.gui.offset)

    const subGui = e.gui.subGui
    if (subGui instanceof sc.IconHoverTextGui) {
        ne.setSubGui(cloneIconHoverTextGui(subGui))
    } else if (subGui) assert(false, 'subGui type not supported ' + window.findClassName ? findClassName(subGui) : '')
    return ne
}

export function initMapInteractEntries(mapInst: InstanceinatorInstance) {
    assert(!ig.ccmap)
    for (const entry of sc.mapInteract.entries) {
        sc.mapInteract.removeEntry(entry)
    }
    for (const entry of mapInst.sc.mapInteract.entries) {
        const newEntry = cloneMapInteractEntry(entry)
        if (newEntry) sc.mapInteract.addEntry(newEntry)
    }
}

prestart(() => {
    function getLocalSharedClients(): LocalSharedClient[] {
        if (!(multi.server instanceof LocalServer) || !ig.ccmap) return []
        return ig.ccmap.players
            .map(player => player.username)
            .map(username => (multi.server as LocalServer).clients[username])
            .filter(client => client instanceof LocalSharedClient)
    }
    sc.MapInteract.inject({
        addEntry(entry) {
            this.parent(entry)

            for (const client of getLocalSharedClients()) {
                waitForScheduledTask(client.inst, () => {
                    const newEntry = cloneMapInteractEntry(entry)
                    if (newEntry) sc.mapInteract.addEntry(newEntry)
                })
            }
        },
        removeEntry(entry) {
            this.parent(entry)

            for (const client of getLocalSharedClients()) {
                waitForScheduledTask(client.inst, () => {
                    const clientEntry = sc.mapInteract.entries.find(a => a.entity == entry.entity)
                    assert(clientEntry)
                    sc.mapInteract.removeEntry(clientEntry)
                })
            }
        },
    })
})
