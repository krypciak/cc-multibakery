export {}
declare global {
    namespace ig {
        namespace ENTITY {
            namespace DummyPlayer {
                interface Settings {}
            }
            interface DummyPlayer extends ig.ENTITY.Player {}
            interface DummyPlayerConstructor extends ImpactClass<DummyPlayer> {
                new (): DummyPlayer
            }
            var DummyPlayer: DummyPlayerConstructor
        }
    }
}

ig.ENTITY.DummyPlayer = ig.ENTITY.Player.extend({
    init() {
        sc.PlayerBaseEntity.prototype.init.bind(this)(0, 0, 0, {})

        this.levelUpNotifier = new sc.PlayerLevelNotifier()
        this.itemConsumer = new sc.ItemConsumption()

        this.model = new sc.PlayerModel()
        sc.Model.addObserver(this.model, this)
        sc.Model.addObserver(sc.model, this)
        this.initModel()

        sc.Model.addObserver(sc.playerSkins, this)
        this.charging.fx = new sc.CombatCharge(this, true)
        sc.combat.addActiveCombatant(this)
    },
    update() {
        const blocking = sc.inputForcer.isBlocking()
        if (blocking) sc.inputForcer.blocked = false

        this.parent()

        sc.inputForcer.blocked = blocking
    },
})
