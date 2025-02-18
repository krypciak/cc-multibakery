import { Server, ServerSettings } from './local-server'

export interface RemoteServerSettings extends ServerSettings {
    slotName: string
    host: string
    port: number
}

export class RemoteServer implements Server<RemoteServerSettings> {}
