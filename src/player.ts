export class Player {
    dummy: ig.ENTITY.DummyPlayer

    private constructor(
        public name: string,
        public mapName: string
    ) {
        this.dummy = new ig.ENTITY.DummyPlayer()
    }

    static async new(name: string): Promise<Player> {
        return new Player(name, 'rhombus-dng/room-1')
    }
}
