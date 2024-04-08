export class Player {
    dummy: ig.dummy.DummyPlayer

    private constructor(
        public name: string,
        public mapName: string
    ) {
        this.dummy = new ig.dummy.DummyPlayer()
    }

    static async new(name: string): Promise<Player> {
        return new Player(name, 'rhombus-dng/room-1')
    }
}
