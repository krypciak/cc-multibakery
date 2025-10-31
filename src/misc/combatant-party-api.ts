import { prestart } from '../loading-stages'

function isCustomParty(party: sc.COMBATANT_PARTY): boolean {
    return party >= 4
}

export function addCombatantParty(name: string, forceId?: number): sc.COMBATANT_PARTY {
    const key = name as keyof typeof sc.COMBATANT_PARTY

    if (forceId !== undefined && Object.values(sc.COMBATANT_PARTY).includes(forceId)) return forceId

    if (sc.COMBATANT_PARTY[key]) return sc.COMBATANT_PARTY[key]
    const id: sc.COMBATANT_PARTY =
        forceId ?? (Object.values(sc.COMBATANT_PARTY).sort().last() as sc.COMBATANT_PARTY) + 1
    // @ts-expect-error
    sc.COMBATANT_PARTY[key] = id

    for (const inst of Object.values(instanceinator.instances)) {
        const combatModel = inst.sc.combat
        combatModel.activeCombatants[id] = []
    }

    return id
}

function playerPartyFix<T>(party: sc.COMBATANT_PARTY = 1, func: () => T): T {
    if (!isCustomParty(party)) return func()

    // @ts-expect-error
    sc.COMBATANT_PARTY.PLAYER = party

    const ret = func()

    // @ts-expect-error
    sc.COMBATANT_PARTY.PLAYER = 1

    return ret
}

prestart(() => {
    sc.CombatParams.inject({
        reduceHp(amount) {
            return playerPartyFix(this.combatant.party, () => this.parent(amount))
        },
    })
})
prestart(() => {
    // sc.Combat#getPartyHpFactor fix idk how
    // sc.Combat#{initFrequencyTimers, submitFrequency} should be fixed by a map implementation of sc.party
    sc.Combat.inject({
        init() {
            this.parent()

            for (const party of Object.values(sc.COMBATANT_PARTY) as sc.COMBATANT_PARTY[]) {
                this.activeCombatants[party] = []
            }
        },
        getGlobalDmgFactor(party) {
            return playerPartyFix(party, () => this.parent(party))
        },
        isInCombat(combatant) {
            return playerPartyFix(combatant.party, () => this.parent(combatant))
        },
    })

    ig.NavExternalBlockers.register(
        (neighbour, actor) =>
            actor instanceof ig.ENTITY.Combatant && isCustomParty(actor.party) && neighbour.externalData.partyBlocked
    )
})
prestart(() => {
    ig.ENTITY.HitNumberSum.inject({
        updateSum(oldNumber) {
            return playerPartyFix(this.combatant.party, () => this.parent(oldNumber))
        },
    })
    const backup = ig.ENTITY.HitNumber.spawnHitNumber
    ig.ENTITY.HitNumber.spawnHitNumber = (pos, combatant, damage, size, strength, shieldResult, isCrit, appenix) => {
        return playerPartyFix(combatant.party, () =>
            backup(pos, combatant, damage, size, strength, shieldResult, isCrit, appenix)
        )
    }
})
// ig.ENTITY.Combatant#addSpikeDamage probably? doesn't need fix
// sc.EnemyType#resolveDefeat depends on sc.Combat#getPartyHpFactor
// ig.GUI.StatusBar#showHpBar needs a more complex fix, not sure what end result is optimal
// ig.GUI.StatusBar#update idk maybe fine?
// ig.GUI.StatusBar#_drawHpBar idk maybe fine?
// sc.ENEMY_REACTION.HIT_REACTION#hitApply arena players shoud just have sc.COMBATANT_PART.PLAYER anyways
// ig.ENTITY.JumpPanel#onTopEntityJump just effect stuff
// ig.ENTITY.JumpPanelFar#onTopEntityJumpFar just effect stuff
// ig.ENTITY.JumpPanelFloat#collideWith just effect stuff?
prestart(() => {
    sc.WaterBubbleEntity.inject({
        ballHit(ballLike, blockDir) {
            return playerPartyFix(ballLike.party, () => this.parent(ballLike, blockDir))
        },
    })
    ig.ENTITY.Compressor.inject({
        ballHit(ballLike, blockDir) {
            return playerPartyFix((ballLike.getCombatant() as ig.ENTITY.Combatant).party, () =>
                this.parent!(ballLike, blockDir)
            )
        },
    })
    sc.ElementShieldBallEntity.inject({
        ballHit(ballLike, blockDir) {
            return playerPartyFix(ballLike.getCombatant().getCombatantRoot().party, () =>
                this.parent!(ballLike, blockDir)
            )
        },
    })
    ig.ENTITY.ElementPole.inject({
        ballHit(ballLike, blockDir) {
            return playerPartyFix(ballLike.party, () => this.parent(ballLike, blockDir))
        },
    })
})
// sc.FerroEntity#collideWith idc
prestart(() => {
    function fixHitCondition<T extends { hitCondition(switchEntity: ig.Entity, ball: ig.ENTITY.Ball): void }>(
        clazz: T
    ) {
        const original = clazz.hitCondition
        clazz.hitCondition = (switchEntity, ball) => playerPartyFix(ball.party, () => original(switchEntity, ball))
    }
    fixHitCondition(sc.ONE_TIME_SWTICH_TYPE.default)
    fixHitCondition(sc.ONE_TIME_SWTICH_TYPE.arSwitch)

    fixHitCondition(sc.MULTI_HIT_SWTICH_TYPE.default)
    fixHitCondition(sc.MULTI_HIT_SWTICH_TYPE.arSwitch)
    fixHitCondition(sc.MULTI_HIT_SWTICH_TYPE.old)

    fixHitCondition(sc.GROUP_SWITCH_TYPE.default)
})
// ig.ACTION_STEP.SET_PARTY_TEMP_TARGET idk
// sc.Arena#onPvpRoundFinished idc
// sc.Arean#onPreDamageApply idc
