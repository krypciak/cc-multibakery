import Multibakery from '../../plugin'
import { ServerPlayer } from '../server-player'
import { PhysicsServer } from '../physics/physics-server'

for (let i = 0; i < 2; i++) {
    window.crossnode.registerTest<{ map: string }>({
        fps: 60,
        skipFrameWait: true,
        timeoutSeconds: 10,

        modId: Multibakery.mod.id,
        name: `mouse simple ${i}`,

        map: 'determine/bots1',
        async setup() {
            multi.setServer(
                new PhysicsServer({
                    globalTps: this.fps!,
                    godmode: true,
                    displayMaps: !this.skipFrameWait,
                })
            )
            await multi.server.start()
        },
        async postSetup() {
            if (i == 0) {
                await multi.server.loadMap(this.map)
                await multi.server.loadMap(this.map)
            }

            const player = new ServerPlayer('player1')
            await player.teleport(this.map, undefined)
            const map = multi.server.maps[this.map]
            map.inst.ig.game.playerEntity = player.dummy

            ig.Timer._last = 0
            ig.Timer.time = 0
        },
        update(frame) {
            const map = multi.server.maps[this.map]
            if (frame >= 3 * this.fps!) {
                const expected = { x: 235.81, y: 371.54, z: 0 }
                const pos = map.inst.ig.game.entities.filter(e => e instanceof ig.ENTITY.Enemy)[0].coll.pos
                if (Vec3.equal(pos, expected)) {
                    this.finish(true)
                } else {
                    function pv(v: Vec3) {
                        return `{ x: ${v.x}, y: ${v.y}, z: ${v.z} }`
                    }
                    this.finish(false, `mouse.coll.pos is equal ${pv(pos)}, expected ${pv(expected)}`)
                }
            }
        },
        cleanup() {
            // const map = multi.server.maps[this.map]
            // determine.Instance.printCompressedLog(map.determinism.eventLog)
            multi.destroy()
        },
    })
}
