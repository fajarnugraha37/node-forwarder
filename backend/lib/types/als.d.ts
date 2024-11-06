import * as stream from 'node:stream';
import { TLSSocket } from 'node:tls';

export type AlsContext = { 
    correlationId: string,
    socket?: stream.Duplex,
    tlsSocket?: TLSSocket,
 };