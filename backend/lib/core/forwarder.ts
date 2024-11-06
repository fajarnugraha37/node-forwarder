import * as net from 'node:net';
import * as http from 'node:http';
import * as https from 'node:https';
import * as stream from 'node:stream';
import * as util from 'node:util';
import { EventEmitter } from 'node:events';
import { createTcpServer, TcpServer } from './server.js';
import { MiddlewareContainer, proxyAuthMiddleware } from '../middleware/index.js';
import { getTlsSocket, sendInternalServerError, sendJsonResponse } from '../helper/index.js';
import { ConfigOptions, ConnectContext, IConnectListener, IProxyResponse, IRequest, IRequestContext, IRequestListener, IResponse, IUpgradeListener, ResponseContext } from '../types/index.js';
import { Logger } from '../logger/index.js';
import { configServer } from '../config/index.js';


export class RequestForwarderServer extends EventEmitter {
    public readonly onConnectMiddlewares = new MiddlewareContainer<ConnectContext>();
    public readonly onRequestMiddlewares = new MiddlewareContainer<IRequestContext>();
    public readonly onResponseMiddlewares = new MiddlewareContainer<ResponseContext>();

    private readonly logger = new Logger({ name: RequestForwarderServer.name });
    private readonly server: TcpServer;
    private readonly port: number;
    private readonly host: string;
    private readonly config: ConfigOptions;

    constructor(config?: ConfigOptions) {
        super();
        if(!config) {
            this.config = configServer.get();
        } else {
            this.config = config;
        }
        this.port = this.config.port;
        this.host = this.config.host || '0.0.0.0';

        process.on("uncaughtException", this.#onErrorProxy('uncaughtException').bind(this));
        this.server = createTcpServer({
            config: this.config,
            onConnect: this.#onConnectProxy.bind(this),
            onRequest: this.#onRequestProxy.bind(this),
            onUpgrade: this.#onUpgreadeProxy.bind(this),
            onError: this.#onErrorProxy('serverError').bind(this),
            onClientError: this.#onErrorProxy('requestError').bind(this),
        });
        if(this.config.auth && 'type' in this.config.auth && this.config.auth.type === 'proxy-auth') {
            this.onConnectMiddlewares.use(proxyAuthMiddleware(this.config.auth));
            this.onRequestMiddlewares.use(proxyAuthMiddleware(this.config.auth));
        }
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
    #onConnectProxy(protocol: 'http:' | 'https:'): IConnectListener {
        return async (request, clientSocket, head) => {
            
            request.locals = { 
                url: new URL(`https://${request.url}`),
                ip: (request.headers['x-forwarded-for'] as string)?.split(',').shift()
                    || request.socket?.remoteAddress,
            };
            console.log('onConnectProxy->locals: ', request.locals);
            await this.onConnectMiddlewares.dispatch({ req: request, clientSocket, head });
            if (request.destroyed || !clientSocket.writable) {
                this.logger.debug('[onConnectProxy] Request ended ', request.url);
                return;
            }

            // NOTE: to trick TLS so that the handshake is done with our own server
            const targetServerSocket = net.connect({
                port: this.port,
                host: this.host,
                allowHalfOpen: true,
            });

            targetServerSocket.on('connect', () => {
                this.logger.debug('[targetServerSocket] Receive CONNECT request -> ', request.url);

                clientSocket.write(
                    "HTTP/1.1 200 Connection Established\r\n"
                    + `Proxy-agent: ${this.config.name}\r\n`
                    + "\r\n"
                );
                targetServerSocket.write(head);
                if (!request.destroyed && clientSocket.writable) {
                    stream.Stream.pipeline(clientSocket, targetServerSocket, (err) => {
                        err && this.logger.debug("[clientSocket->targetServerSocket] Error: ", err);
                    });
                    
                    stream.Stream.pipeline(targetServerSocket, clientSocket, (err) => {
                        err && this.logger.debug("[targetServerSocket->clientSocket] Error: ", err);
                    });

                    this.logger.debug(`[targetServerSocket] Connection Established <- ${this.host}:${this.port}`);
                }
            });
    
            targetServerSocket.setTimeout(this.config.requestTimeout, () => {
                clientSocket.write(
                    "HTTP/1.1 480 Failed to process request in time. Please try again.\r\n"
                    + `Proxy-agent: ${this.config.name}\r\n`
                    + "\r\n"
                );
                targetServerSocket.destroy();
                clientSocket.destroy();
            });

            targetServerSocket.on("error", (err) => {
                this.logger.error("[targetServerSocket] error", err)
                clientSocket.end();
            });
            
            clientSocket.on("error", (err) => {
                this.logger.error("[clientSocket] error", err)
                targetServerSocket.end();
            });
        }
    }

    /**
     * 
     * @param protocol 
     * @returns 
     */
    #onRequestProxy(protocol: 'http:' | 'https:'): IRequestListener {
        return async (request, response) => {
            try {
                const url = new URL(
                    request.url?.startsWith('http:')
                        ? request.url
                        : `${protocol}//${response.req.headers['x-forwarded-host'] || request.headers.host}${response.req.url}`
                );

                request.locals = { 
                    url: url,
                    ip: (request.headers['x-forwarded-for'] as string)?.split(',').shift()
                        || request.socket?.remoteAddress,
                };
                console.log('onRequestProxy->locals: ', request.locals);
                await this.onRequestMiddlewares.dispatch({ req: request, res: response });
                if (request.destroyed || response.writableEnded) {
                    this.logger.debug('[request] Request ended ', url.href);
                    this.#closeTls(protocol);
                    return;
                }

                this.logger.debug(`[request->forwardRequest] Sending request -> ${url.href}`);
                delete request.headers['proxy-connection'];
                delete request.headers['host'];
                const forwardRequest = (protocol === 'https:' ? https : http).request({
                    'method': request.method ?? 'GET',
                    'hostname': url.hostname,
                    'path': url.pathname + url.search,
                    'agent': new (protocol === 'https:' ? https : http).Agent({
                    }),
                    'headers': {
                        ...request.headers,
                        'referer': url.href,
                    },
                });

                forwardRequest.on('response', this.#onResponseProxy(protocol, url, request, response).bind(this));

                forwardRequest.on('error', (err) => request.destroy(err));

                forwardRequest.on('socket', (socket) => {
                    socket.setTimeout(this.config.requestTimeout, () => {
                        this.logger.debug("[forwardRequest] Timeout");

                        forwardRequest.destroy();
                        sendJsonResponse({
                            response,
                            statusCode: 480,
                            payload: {
                                message: 'Failed to process request in time. Please try again.'
                            },
                            headers: {
                                "server": this.config.name,
                            },
                        });
                        this.#closeTls(protocol);
                    });

                    if (forwardRequest.destroyed) {
                        return;
                    }

                    stream.Stream.pipeline(request, forwardRequest, (err) => {
                        if(!err) {
                            return;
                        }
                        this.logger.error("[request->forwardRequest] Error: ", err);
                        sendJsonResponse({
                            response,
                            statusCode: 502 ,
                            payload: {
                                message: 'Bad Gateway'
                            },
                            headers: {
                                "server": this.config.name,
                            },
                        });
                        this.#closeTls(protocol);
                    });
                });
            } catch (e) {
                this.logger.error('Error: ', e);
                sendInternalServerError(e, response);
                this.#closeTls(protocol);
            }
        };
    }

    #onResponseProxy(protocol: 'http:' | 'https:', url: URL, request: IRequest, response: IResponse) {
        return async (forwardResponse: IProxyResponse) => {
            try {
                this.logger.debug(`[onRequestForwardToHttp] Receive response <- ${url.href}`);

                await this.onResponseMiddlewares.dispatch({ req: request, res: response, proxyRes: forwardResponse });
                if (!response.headersSent) {
                    response.writeHead(forwardResponse.statusCode || 200, {
                        ...forwardResponse.headers,
                        "server": this.config.name,
                    });
                }

                if (!response.writableEnded) {
                    stream.Stream.pipeline(forwardResponse, response, (err) => {
                        err && this.logger.error("[forwardResponse->response] Error: ", err);
                    });
                } else {
                    this.#closeTls(protocol);
                }
            } catch (e) {
                this.logger.error('Error: ', e);
                return sendInternalServerError(e, response, forwardResponse.headers);
            }
        }
    }

    /**
     * 
     * @param request 
     * @param clientSocket 
     * @param head 
     */
    #onUpgreadeProxy(protocol: 'http:' | 'https:'): IUpgradeListener {
        return (request: IRequest, clientSocket: stream.Duplex, head: Buffer) => {
            this.emit("upgrade", request, clientSocket, head);
            clientSocket.end();
        }
    }

    /**
     * 
     * @param errorType 
     * @returns 
     */
    #onErrorProxy(errorType: 'requestError' | 'serverError' | 'uncaughtException') {
        return (err: Error, socket?: stream.Duplex) => {
            this.logger.error(`[${errorType}]: `, err);

            if (socket instanceof stream.Duplex) {
                this.emit(errorType, err, socket);
                socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
            } else {
                this.emit(errorType, err);
            }
            this.#closeTls('https:');
        }
    }

    #closeTls(protocol: string) {
        if(protocol === 'https:' && getTlsSocket()?.destroyed === false) {
            getTlsSocket()?.end();
        }
    }
}