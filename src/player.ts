export class Player {
    dummy: ig.dummy.DummyPlayer

    private constructor(
        public name: string,
        public mapName: string
    ) {
        this.dummy = new ig.dummy.DummyPlayer(name)
        if (ig.multiplayer.server.s.godmode) ig.godmode(this.dummy.model)
    }

    static async new(name: string): Promise<Player> {
        return new Player(name, 'rhombus-dng/room-1')
    }
}
