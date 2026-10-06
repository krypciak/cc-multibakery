import { prestart } from '../loading-stages'

prestart(() => {
    ig.ENTITY.TeleportGround.inject({
        getEnterActionData(actor) {
            if (actor instanceof dummy.DummyPlayer) {
                const client = actor.getClient(true)
                if (client) client.teleportOverrides.teleportMethod = 'TeleportGround'
            }
            return this.parent(actor)
        },
    })

    ig.ENTITY.Door.inject({
        getEnterEventData(actor) {
            if (actor instanceof dummy.DummyPlayer) {
                const client = actor.getClient(true)
                if (client) client.teleportOverrides.teleportMethod = 'Door'
            }
            return this.parent(actor)
        },
    })

    ig.ENTITY.TeleportStairs.inject({
        getEnterActionData(actor) {
            if (actor instanceof dummy.DummyPlayer) {
                const client = actor.getClient(true)
                if (client) client.teleportOverrides.teleportMethod = 'TeleportStairs'
            }
            return this.parent(actor)
        },
    })

    ig.ENTITY.TeleportField.inject({
        onInteraction() {
            const actor = ig.game.playerEntity
            if (actor instanceof dummy.DummyPlayer) {
                const client = actor.getClient(true)
                if (client) client.teleportOverrides.teleportMethod = 'TeleportField'
            }
            return this.parent()
        },
    })
})
