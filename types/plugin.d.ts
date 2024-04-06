import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod';
import { Mod1 } from './types';
export default class CCMultiplayerServer implements PluginClass {
    static dir: string;
    static mod: Mod1;
    constructor(mod: Mod1);
    prestart(): Promise<void>;
    poststart(): Promise<void>;
}
