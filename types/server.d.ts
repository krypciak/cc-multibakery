import { OnlineMap as CCMap } from './online-map';
import { Player } from './player';
export type ServerSettings = {
    name: string;
    slotName: string;
    host: string;
    port: number;
    globalTps: number;
    entityTps: number;
    physicsTps: number;
    eventTps: number;
};
export declare class CCServer {
    s: ServerSettings;
    maps: Record<string, CCMap>;
    currentMapViewName: string;
    get viewMap(): CCMap;
    constructor(s: ServerSettings);
    getMap(mapName: string): Promise<CCMap>;
    private appendMap;
    readAllMaps(): Promise<void>;
    start(): Promise<void>;
    getPlayers(): Player[];
    joinPlayer(player: Player): Promise<void>;
    private findSlot;
    private loadSlot;
    private createSlot;
}
