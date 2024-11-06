import { AsyncLocalStorage } from 'node:async_hooks';
import * as crypto from 'node:crypto';
import { AlsContext } from '../types/index.js';
import { Duplex } from 'node:stream';
import { TLSSocket } from 'node:tls';

const asyncLocalStorage = new AsyncLocalStorage<AlsContext>();

function runWithAls<R extends (...args: any) => any>(work: R): ((...args: Parameters<typeof work>) => ReturnType<typeof work>);
function runWithAls<R extends (...args: any) => any>(work: R, context?: AlsContext): ((...args: Parameters<typeof work>) => ReturnType<typeof work>) {
    return (...args: Parameters<typeof work>): ReturnType<typeof work> => {
        return asyncLocalStorage.run(asyncLocalStorage.getStore() || context || { correlationId: crypto.randomUUID() }, () => work.bind(work)(...args));
    };
}

function initAls<R extends (...args: any) => any>(work: R, context: AlsContext = { correlationId: crypto.randomUUID() }): ((...args: Parameters<typeof work>) => ReturnType<typeof work>) {
    return (...args: Parameters<typeof work>): ReturnType<typeof work> => {
        return asyncLocalStorage.run(context, () => work.bind(work)(...args));
    };
}

function getCollerationId(): string | undefined {
    const store = asyncLocalStorage.getStore();
    return store && store.correlationId;
}

function getSocket(): Duplex | undefined {
    const store = asyncLocalStorage.getStore();
    return store && store.socket;
}

function getTlsSocket(): Duplex | undefined {
    const store = asyncLocalStorage.getStore();
    return store && store.tlsSocket;
}
function setSocket(socket: Duplex): void {
    const store = asyncLocalStorage.getStore();
    if(store) {
        store.socket = socket;
    }
}

function setTlsSocket(socket: TLSSocket): void {
    const store = asyncLocalStorage.getStore();
    if(store) {
        store.tlsSocket = socket;
    }
}

export {
    initAls,
    runWithAls,
    getCollerationId,
    getSocket,
    getTlsSocket,
    setSocket,
    setTlsSocket,
}