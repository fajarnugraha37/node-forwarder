import * as http from 'node:http';
import * as https from "https";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import { Logger } from '../logger/index.js';
import * as als from '../helper/index.js';
import { ConfigOptions, IConnectListener, IErrorListener, IRequestListener, IUpgradeListener } from '../types/index.js';


export type TcpServer = ReturnType<typeof createTcpServer>;

export const createTcpServer = (opts: {
    onConnect: (protocol: 'http:' | 'https:') => IConnectListener;
    onRequest: (protocol: 'http:' | 'https:') => IRequestListener;
    onUpgrade: (protocol: 'http:' | 'https:') => IUpgradeListener;
    onError: IErrorListener,
    onClientError: IErrorListener;
    config: ConfigOptions,
}) => {
    const logger = new Logger({ name: 'tcp.server.' + process.pid });
    const server = {
        http: http.createServer({
        }),
        https: https.createServer({
            cert: fs.readFileSync(path.resolve(opts.config.ssl?.certPath!)),
            key: fs.readFileSync(path.resolve(opts.config.ssl?.keyPath!)),
        }),
        tcp: net.createServer({
            allowHalfOpen: true,
        }),
    };

    server.http.on('connect', opts.onConnect('http:'));
    server.https.on('connect', opts.onConnect('https:'));
    
    server.https.on('connection', als.setSocket.bind(als));
    server.https.on('secureConnection', als.setTlsSocket.bind(als));

    server.http.on('request', opts.onRequest('http:'));
    server.https.on('request', opts.onRequest('https:'));

    server.http.on("upgrade", opts.onUpgrade('http:'));
    server.https.on("upgrade", opts.onUpgrade('https:'));
    
    server.http.on("error", opts.onError);
    server.https.on("error", opts.onError);

    server.http.on("clientError", opts.onClientError);
    server.https.on("clientError", opts.onClientError);

    server.tcp.on('connection', (clientSocket: net.Socket) => {
        clientSocket.once('data', als.runWithAls(buffer => {
            // Determine if this is an HTTP/S request:
            // the TLS handshake record header to find the length of the client hello. Format of the record:
            // - Byte   0       = SSL record type = 22 (SSL3_RT_HANDSHAKE)
            // - Bytes 1-2      = SSL version (major/minor)
            // - Bytes 3-4      = Length of data in the record (excluding the header itself).
            // - Byte   5       = Handshake type
            // - Bytes 6-8      = Length of data to follow in this record
            // - Bytes 9-n      = Command-specific data                      
            //                  The maximum SSL supports is 16384 (16K).
            // http between 32 < x < 127 at the first byte or at the first line:
            // - starting with method GET/POST/DELETE/etc but can't rely on that because it can be customized
            // - separated by spaces is the target url
            // - separated by a space again is the protocol = HTTP/1.1
            const firstByte = buffer[0];
            const isHttps = firstByte == 22;
            const isHttp = !isHttps
                && ((32 < firstByte && firstByte < 127) || buffer?.toString()?.split("\n")?.at(0)?.startsWith("HTTP/1.1"));
            if (!isHttp && !isHttps) {
                logger.error('Error request unsupported protocol with first byte of header: ', firstByte);
                return clientSocket.end(
                    "HTTP/1.1 505 Only HTTP and HTTPS protocols are currently supported\r\n"
                    + "Proxy-agent: Forward-Proxy\r\n"
                    + "\r\n"
                );
            }

            {
                // Push the buffer back onto the front of the data stream
                clientSocket.unshift(buffer);

                // Emit the socket to the HTTP/HTTPS server
                const protocol: (keyof typeof server) = isHttps
                    ? 'https'
                    : 'http';
                clientSocket.pause();
                server[protocol].emit('connection', clientSocket);

                // the socket must be resumed asynchronously 
                // or the socket connection hangs, 
                // potentially crashing the process
                process.nextTick(() => clientSocket.resume());
            }
        }));

        clientSocket.on('error', error => {
            logger.error('[TcpServer->clientSocket] Error: ', error);
        });

        clientSocket.on('timeout', () => {
            logger.error('[TcpServer->clientSocket] Timeout');
        });
    });

    server.tcp.on('error', (error) => {
        logger.error('[TcpServer] Error: ', error);
    });

    return server;
}