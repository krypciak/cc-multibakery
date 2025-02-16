import Multibakery from '../plugin'

declare global {
    namespace ig.ENTITY {
        interface AocBox1 extends ig.ActorEntity {
            anims: ig.AnimationSheet.Settings
            baseConfig: ig.ActorConfig
        }
        interface AocBox1Constructor extends ImpactClass<AocBox1> {
            new (x: number, y: number, z: number, settings: ig.Entity.Settings): AocBox1
        }
        var AocBox1: AocBox1Constructor
    }
}
ig.ENTITY.AocBox1 = ig.ActorEntity.extend({
    anims: {
        sheet: { src: 'media/entity/objects/puzzle-elements-1.png', width: 16, height: 32, offX: 0, offY: 0 },
        SUB: [{ name: 'default', time: 1, frames: [0], repeat: false }],
    },
    init(x, y, z, settings) {
        this.parent(x, y, z, settings)
        this.coll.setSize(16, 16, 32)
        this.baseConfig = new ig.ActorConfig(
            {
                collType: ig.COLLTYPE.BLOCK,
                walkAnims: { idle: '' },
                zGravityFactor: 0,
                weight: 0,
                maxVel: 1,
                relativeVel: 1,
                accelSpeed: 1000000,
                friction: 0,
                airFriction: 0,
                shadowType: ig.COLL_SHADOW_TYPE.STATIC_SIZE,
            },
            undefined as any
        )
        this.setDefaultConfig(this.baseConfig)
        this.animSheet = new ig.AnimationSheet(this.anims)
        this.initAnimations()
    },
})

window.crossnode.registerTest<{}>({
    fps: 60,
    skipFrameWait: true,
    timeoutSeconds: 5,

    modId: Multibakery.mod.id,
    name: `aoc2024d15 :)`,
    async setup() {
        ig.interact.entries.forEach(e => ig.interact.removeEntry(e))

        sc.model.enterNewGame()
        sc.model.enterGame()
        ig.game.reset()
        ig.game.setPaused(false)

        // await generateMap()

        await window.crossnode.testUtil.loadLevel('multibakery/test/aoc8x8-1')
    },
    update() {},
})
