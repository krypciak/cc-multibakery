export declare class Player {
    name: string;
    mapName: string;
    private constructor();
    static new(name: string): Promise<Player>;
}
