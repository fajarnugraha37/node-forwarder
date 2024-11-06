import * as net from 'node:net';
import * as http from 'node:http';
import * as https from 'node:https';
import * as stream from 'node:stream';
import * as util from 'node:util';
import { EventEmitter } from 'node:events';
import { createTcpServer, TcpServer } from './server.js';
import { MiddlewareContainer } from '../middleware/index.js';
import { requestToBody, sendInternalServerError } from '../helper/index.js';
import { ConfigOptions } from '../types/index.js';
import { Logger } from '../logger/index.js';


export class RequestForwarderServer extends EventEmitter {
    private readonly logger = new Logger({ name: RequestForwarderServer.name });
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
    private readonly port: number;
    private readonly host: string;

    constructor(config: ConfigOptions) {
        super();
        this.port = config.port;
        this.host = config.host || '0.0.0.0';

        process.on("uncaughtException", this.#onError('uncaughtException').bind(this));
        this.server = createTcpServer({
            config: config,
            onConnect: this.#onConnectProxy.bind(this),
            onRequest: this.#onRequestProxy.bind(this),
            // onUpgrade: this.#onRequestProxyToHttp.bind(this),
            // onError: this.#onRequestProxyToHttp.bind(this),
            // onClientError: this.#onRequestProxyToHttp.bind(this),
        });

    }

    /**
     * Method to turn on proxy server
     * 
     * @returns {Promise<this>}
     */
    public async start(): Promise<this> {
        return new Promise((resolve) => {
            this.server.tcp.listen({
                port: this.port,
                host: this.host,
            }, () => {
                this.logger.debug("listen: %s:%s with pid %s", this.host, this.port, process.pid);
                this.emit("listen", this.port, process.pid, this.server.tcp);

                resolve(this);
            });
        });
    }

    /**
     * Method to turn off proxy server
     * 
     * @returns {Promise<this>}
     */
    public async stop(): Promise<this> {
        try {
            this.server.http.closeAllConnections();
            this.server.https.closeAllConnections();
            await util.promisify(this.server.tcp.close.bind(this.server.tcp))();

            this.logger.debug("Succed to close server ");
            this.emit("close");

            return this;
        } catch (err) {
            this.logger.error("Failed to close server: ", err);
            throw err;
        }
    }

    /**
     * 
     * @param request 
     * @param clientSocket 
     * @param head 
     */
    #onConnectProxy(request: http.IncomingMessage, clientSocket: stream.Duplex, head: Buffer): void | Promise<void> {
        // NOTE: to trick TLS so that the handshake is done with our own server
        const targetServerConnection = net.connect(this.port, this.host);

        targetServerConnection.on('connect', () => {
            this.logger.debug('[targetServerConnection] Receive CONNECT request -> ', request.url);

            clientSocket.write(
                "HTTP/1.1 200 Connection Established\r\n"
                + "Proxy-agent: Forward-Proxy\r\n"
                + "\r\n"
            );
            targetServerConnection.write(head);
            if (!request.destroyed && clientSocket.writable) {
                targetServerConnection
                    .pipe(clientSocket)
                    .on("error", (e) => this.logger.debug("[targetServerConnection] pipe(clientSocket) error: ", e));

                clientSocket
                    .pipe(targetServerConnection)
                    .on("error", (e) => this.logger.debug("[clientSocket] pipe(serverSocket) error: ", e));

                this.logger.debug(`[targetServerConnection] Connection Established <- ${this.host}:${this.port}`);
            }
        })

        targetServerConnection.setTimeout(60_000, () => {
            this.logger.debug('[targetServerConnection] Timeout: ');

            targetServerConnection.destroy();
            clientSocket.destroy();
        });

        targetServerConnection.on('error', (err: Error) => {
            this.logger.error('[targetServerConnection] Error: ', err);

            clientSocket.destroy();
        });

        clientSocket.on('error', (err: Error) => {
            this.logger.error('[clientSocket] Error: ', err);

            targetServerConnection.end();
        });

        clientSocket.on("destroyed", () => {
            this.logger.debug("[clientSocket] destroyed: %s %s", request.method, request.url);

            targetServerConnection.end();
            targetServerConnection.destroy();
        });
    }

    /**
     * 
     * @param protocol 
     * @returns 
     */
    #onRequestProxy(protocol: 'http:' | 'https:'): http.RequestListener {
        return (request, response) => {
            try {
                const url = new URL(
                    request.url?.startsWith('http:')
                        ? request.url
                        : `${protocol}//${response.req.headers['x-forwarded-host'] || request.headers.host}${response.req.url}`
                );
                delete response.req.headers['host'];
                this.logger.debug(`[onRequestForwardToHttp] Sending request -> ${url.href}`);

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
                            this.logger.debug(`[onRequestForwardToHttp] Receive response <- ${url.href}`);
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

    /**
     * 
     * @param request 
     * @param clientSocket 
     * @param head 
     */
    #onUpgrade(request: Request, clientSocket: stream.Duplex, head: Buffer) {
        this.emit("upgrade", request, clientSocket, head);
        clientSocket.end();
    }

    /**
     * 
     * @param errorType 
     * @returns 
     */
    #onError(errorType: 'requestError' | 'serverError' | 'uncaughtException') {
        return (err: Error, socket?: stream.Duplex) => {
            this.logger.error(`[${errorType}]: `, err);

            if (socket instanceof stream.Duplex) {
                this.emit(errorType, err, socket);
                socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
            } else {
                this.emit(errorType, err);
            }
        }
    }
}