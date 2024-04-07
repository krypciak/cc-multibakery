export class Player {
    private constructor(
        public name: string,
        public mapName: string
    ) {}

    static async new(name: string): Promise<Player> {
        return new Player(name, 'rhombus-dng/room-1')
    }
}
