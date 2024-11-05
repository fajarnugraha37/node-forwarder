import * as net from 'node:net';
import * as http from 'node:http';
import * as https from 'node:https';
import * as stream from 'node:stream';
import * as util from 'node:util';
import { EventEmitter } from 'node:events';
import { createTcpServer, TcpServer } from './server.js';
import { MiddlewareContainer } from '../middleware/index.js';
import { requestToBody, sendInternalServerError } from '../helper/index.js';


export class RequestForwarderServer extends EventEmitter {
    public readonly server: TcpServer;
    public readonly onRequest = new MiddlewareContainer<{ 
        request: http.IncomingMessage, 
        response: http.ServerResponse & { req: http.IncomingMessage } 
    }>();
    public readonly onResponse = new MiddlewareContainer<{ 
        request: http.IncomingMessage, 
        response: http.ServerResponse & { req: http.IncomingMessage }, 
        proxyResponse: http.IncomingMessage 
    }>();
    public readonly onConnect = new MiddlewareContainer<{ 
        request: http.IncomingMessage, 
        clientSocket: stream.Duplex, 
        head: Buffer 
    }>();

    constructor(
        public readonly port: number = 8080,
        public readonly host: string = '0.0.0.0'
    ) {
        super();
        this.server = createTcpServer({
            onConnect: this.#onConnectProxy(this.port, this.host).bind(this),
            onRequest: this.#onRequestProxyToHttp.bind(this),
            // onUpgrade: this.#onRequestProxyToHttp.bind(this),
            // onError: this.#onRequestProxyToHttp.bind(this),
            // onClientError: this.#onRequestProxyToHttp.bind(this),
        });

    }

    /**
     * 
     * @returns 
     */
    public async start(): Promise<this> {
        process.on("uncaughtException", this.#onError('uncaughtException').bind(this));
        return new Promise((resolve) => {
            this.server.tcp.listen({
                port: this.port,
                host: this.host,
            }, () => {
                console.debug("listen: %o", { port: this.port, pid: process.pid });
                this.emit("listen", this.port, process.pid, this.server.tcp);

                resolve(this);
            });
        });
    }

    /**
     * 
     * @returns 
     */
    public async stop(): Promise<this> {
        try {
            this.server.http.closeAllConnections();
            this.server.https.closeAllConnections();
            await util.promisify(this.server.tcp.close.bind(this.server.tcp))(),

            console.debug("Succed to close server ");
            this.emit("close");

            return this;
        } catch (err) {
            console.error("Failed to close server: ", err);
            throw err;
        }
    }

    #onConnectProxy(tcpPort: number, tcpHostname: string) {
        return (request: http.IncomingMessage, clientSocket: stream.Duplex, head: Buffer): void | Promise<void> => {
            console.debug('[onConnect] onConnect: ', request.url);

            // const [hostname, port,] = (request.url ?? '').split(':');
            // const targetServerConnection = net.connect(Number(port), hostname);

            // NOTE: to trick TLS so that the handshake is done with our own server
            const targetServerConnection = net.connect(tcpPort, tcpHostname);

            targetServerConnection.on('connect', () => {
                console.debug('[targetServerConnection] Connected to : ', request.url);

                clientSocket.write(
                    "HTTP/1.1 200 Connection Established\r\n"
                    + "Proxy-agent: Forward-Proxy\r\n"
                    + "\r\n"
                );
                targetServerConnection.write(head);
                if (!request.destroyed && clientSocket.writable) {
                    targetServerConnection
                        .pipe(clientSocket)
                        .on("error", (e) => console.debug("[targetServerConnection] pipe(clientSocket) error: ", e));

                    clientSocket
                        .pipe(targetServerConnection)
                        .on("error", (e) => console.debug("[clientSocket] pipe(serverSocket) error: ", e));
                }
            })

            targetServerConnection.setTimeout(60_000, () => {
                console.debug('[targetServerConnection] Timeout: ');

                targetServerConnection.destroy();
                clientSocket.destroy();
            });

            targetServerConnection.on('error', (err: Error) => {
                console.error('[targetServerConnection] Error: ', err);

                clientSocket.destroy();
            });

            clientSocket.on('error', (err: Error) => {
                console.error('[clientSocket] Error: ', err);

                targetServerConnection.end();
            });

            clientSocket.on("destroyed", () => {
                console.debug("[clientSocket] destroyed: %s %s", request.method, request.url);

                targetServerConnection.end();
                targetServerConnection.destroy();
            });
        }
    }

    #onRequestProxyToHttp(protocol: 'http:' | 'https:'): http.RequestListener {
        return (request, response) => {
            console.log('[onRequestForwardToHttp]: %s with PID %s', request.url, process.pid);

            try {
                const url = new URL(
                    request.url?.startsWith('http:')
                        ? request.url
                        : `${protocol}//${response.req.headers['x-forwarded-host'] || request.headers.host}${response.req.url}`
                );
                delete response.req.headers['host'];

                const forwardRequest = (protocol === 'https:' ? https : http).request(
                    {
                        'method': response.req.method ?? 'GET',
                        'hostname': url.hostname,
                        'path': url.pathname + url.search,
                        'agent': new (protocol === 'https:' ? https : http).Agent({
                        }),
                        'headers': {
                            ...response.req.headers,
                            'referer': url.href,
                        },
                    },
                    async (forwardResponse) => {
                        try {
                            response.writeHead(forwardResponse.statusCode || 500, {
                                ...forwardResponse.headers,
                                "x-server-name": "Forward-Proxy",
                            });

                            return response.end(await requestToBody(forwardResponse));
                        } catch (e) {
                            return sendInternalServerError(e, response, forwardResponse.headers);
                        }
                    });

                forwardRequest.on('timeout', () => {
                    sendInternalServerError(null, response);
                    return forwardRequest.destroy();
                });

                forwardRequest.on('error', (err) => {
                    return sendInternalServerError(err, response);
                });

                response.req
                    .pipe(forwardRequest, { end: true })
                    .on('error', (e) => sendInternalServerError(e, response));
            } catch (e) {
                return sendInternalServerError(e, response);
            }
        }
    }


    #onUpgrade(request: Request, clientSocket: stream.Duplex, head: Buffer) {
        this.emit("upgrade", request, clientSocket, head);
        clientSocket.end();
    }

    #onError(errorType: 'requestError' | 'serverError' | 'uncaughtException') {
        return (err: Error, socket?: stream.Duplex) => {
            console.error(`[${errorType}]: `, err);

            if (socket instanceof stream.Duplex) {
                this.emit(errorType, err, socket);
                socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
            } else {
                this.emit(errorType, err);
            }
        }
    }
}