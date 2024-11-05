import * as http from 'node:http';
import * as https from "https";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import internal from "stream";
import { Logger } from '../logger/index.js';


const logger = new Logger({ name: 'core.helper' });

export type TcpServer = ReturnType<typeof createTcpServer>;

export const createTcpServer = (opts: {
    onConnect: (request: http.IncomingMessage, clientSocket: internal.Duplex, head: Buffer) => void | Promise<void>;
    onRequest: (protocol: 'http:' | 'https:') => http.RequestListener;
}) => {
    const server = {
        http: http.createServer({
            keepAlive: true,
        }),
        https: https.createServer({
            cert: fs.readFileSync(path.resolve("localhost.crt")),
            key: fs.readFileSync(path.resolve("localhost.key")),
        }),
        tcp: net.createServer({
            allowHalfOpen: false,
            keepAlive: true,
        }),
    };

    server.http.on('connect', opts.onConnect);
    server.https.on('connect', opts.onConnect);

    server.http.on('request', opts.onRequest('http:'));
    server.https.on('request', opts.onRequest('https:'));

    server.tcp.on('connection', clientSocket => {
        clientSocket.once('data', buffer => {
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
                logger.error('[clientSocket] error request unsupported protocol with first byte of header: ', firstByte);
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
        });

        clientSocket.on('error', error => {
            logger.error('[clientSocket] error: ', error);
        });

        clientSocket.on('timeout', () => {
            logger.error('[clientSocket] Timeout');
        });
    });

    server.tcp.on('error', (error) => {
        logger.error('[tcpServer] error: ', error);
    });

    return server;
}