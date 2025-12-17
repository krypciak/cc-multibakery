import { prestart } from '../loading-stages'
import { addGlobalStateHandler, type GlobalStateKey } from './states'
import { StateMemory } from './state-util'
import { isRemote } from '../server/remote/is-remote-server'
import { assert } from '../misc/assert'
import type {
    AttackType,
    DefenceType,
    ExpType,
    FocusType,
    HpType,
    SpLevelType,
    SpType,
    ArmorType,
    LevelType,
    Username,
} from '../net/binary/binary-types'
import type { MapTpInfo } from '../server/server'

export interface PlayerInfoEntry {
    username: Username
    character: string
    tpInfo: MapTpInfo
    nextTpInfo: MapTpInfo
    pos: Vec2

    stats: {
        level: LevelType
        maxhp: HpType
        attack: AttackType
        defense: DefenceType
        focus: FocusType

        hp: HpType
        spLevel: SpLevelType
        sp: SpType
        exp: ExpType
    }
    equip: {
        head: ArmorType
        leftArm: ArmorType
        rightArm: ArmorType
        torso: ArmorType
        feet: ArmorType
    }
}
/* unfortunetly I cant use type magic to create this type automaticly since ts-binarifier bugs out on such a type :( */
interface PartialPlayerInfoEntry {
    username?: Username
    character?: string
    tpInfo?: MapTpInfo
    nextTpInfo?: MapTpInfo
    pos?: Vec2

    stats?: {
        level: LevelType
        maxhp: HpType
        attack: AttackType
        defense: DefenceType
        focus: FocusType

        hp: HpType
        spLevel: SpLevelType
        sp: SpType
        exp: ExpType
    }
    equip?: {
        head: ArmorType
        leftArm: ArmorType
        rightArm: ArmorType
        torso: ArmorType
        feet: ArmorType
    }
}

declare global {
    interface GlobalStateUpdatePacket {
        playerInfo?: PartialRecord<Username, PartialPlayerInfoEntry>
    }
}

prestart(() => {
    const areasStatePlayerMemory: StateMemory.MapHolder<GlobalStateKey> = {}
    addGlobalStateHandler({
        get(packet, conn) {
            if (packet.playerInfo) return
            const memory = StateMemory.getBy(areasStatePlayerMemory, conn)

            const isInMapMenu = conn.clients.some(c => c.inst.sc.menu.currentMenu == sc.MENU_SUBMENU.MAP)
            const isInPartyMenu = conn.clients.some(c => c.inst.sc.menu.currentMenu == sc.MENU_SUBMENU.SOCIAL)

            const entries = multi.server.getPlayerInfoEntries()
            packet.playerInfo = memory.diffRecord2Deep<keyof PartialPlayerInfoEntry, PartialPlayerInfoEntry>(
                entries,
                {
                    tpInfo(a, b) {
                        if (!a) return !!b
                        if (!b) return !!a
                        return a.map != b.map || a.marker != b.marker
                    },
                    nextTpInfo(a, b) {
                        if (!a) return !!b
                        if (!b) return !!a
                        return a.map != b.map || a.marker != b.marker
                    },
                    pos: (a, b) => isInMapMenu && (a?.x !== b?.x || a?.y !== b?.y),
                    stats(a, b) {
                        if (!isInPartyMenu) return false
                        if (!a) return !!b
                        if (!b) return !!a
                        return (
                            a.level != b.level ||
                            a.maxhp != b.maxhp ||
                            a.attack != b.attack ||
                            a.defense != b.defense ||
                            a.focus != b.focus ||
                            a.hp != b.hp ||
                            a.spLevel != b.spLevel ||
                            a.sp != b.sp ||
                            a.exp != b.exp
                        )
                    },
                    equip(a, b) {
                        if (!isInPartyMenu) return false
                        if (!a) return !!b
                        if (!b) return !!a
                        return (
                            a.head != b.head ||
                            a.leftArm != b.leftArm ||
                            a.rightArm != b.rightArm ||
                            a.torso != b.torso ||
                            a.feet != b.feet
                        )
                    },
                },
                {
                    tpInfo: tpInfo => tpInfo && { ...tpInfo },
                    nextTpInfo: nextTpInfo => nextTpInfo && { ...nextTpInfo },
                    pos: v => v && Vec2.create(v),
                    stats: stats => stats && { ...stats },
                    equip: equip => equip && { ...equip },
                }
            )
        },
        set(packet) {
            if (!packet.playerInfo) return

            assert(isRemote(multi.server))
            for (const username in packet.playerInfo) {
                const entry = (multi.server.playerInfoEntries[username] ??= {} as PlayerInfoEntry)
                const playerInfo = packet.playerInfo[username]
                if (playerInfo === undefined) {
                    delete multi.server.playerInfoEntries[username]
                } else {
                    for (const keyRaw in playerInfo) {
                        const key = keyRaw as keyof PlayerInfoEntry
                        const v = playerInfo[key]
                        if (v !== undefined) entry[key] = v as any
                    }

                    if (entry.nextTpInfo) {
                        const client = multi.server.clients.get(username)
                        if (!client?.ready || client.tpInfo.map == entry.nextTpInfo.map) continue

                        client.teleport(entry.nextTpInfo)
                    }
                }
            }
        },
    })
})
