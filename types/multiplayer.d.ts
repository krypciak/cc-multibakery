/// <reference types="node" />
import { Server } from 'http';
import { CCServer } from './server';
export declare const DEFAULT_PORT = 33405;
import * as express from 'express';
declare const axios: typeof import('axios');
declare global {
    interface Window {
        axios: typeof axios;
    }
}
export declare class Multiplayer {
    headless: boolean;
    ccservers: Record<string, CCServer>;
    ccserver: CCServer;
    app: express.Application;
    webserver: Server;
    constructor();
    appendServer(server: CCServer): void;
    private validateJoin;
    start(): void;
    private playerJoin;
}
export {};
