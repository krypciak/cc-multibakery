import { prestart } from '../plugin'

prestart(() => {
    sc.Combat.inject({
        init() {
            this.parent()

            for (const party of Object.values(sc.COMBATANT_PARTY) as sc.COMBATANT_PARTY[]) {
                this.activeCombatants[party] = []
            }
        },
    })
})

export function addCombatantParty(name: string): sc.COMBATANT_PARTY {
    const key = name as keyof typeof sc.COMBATANT_PARTY

    if (sc.COMBATANT_PARTY[key]) return sc.COMBATANT_PARTY[key]
    const id: sc.COMBATANT_PARTY = Object.keys(sc.COMBATANT_PARTY).length
    // @ts-expect-error
    sc.COMBATANT_PARTY[key] = id

    for (const inst of Object.values(instanceinator.instances)) {
        const combatModel = inst.sc.combat
        combatModel.activeCombatants[id] = []
    }

    return id
}
