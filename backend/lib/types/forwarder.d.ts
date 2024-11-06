import http from 'node:http';
import stream from 'node:stream';

type IDefaultLocals = {
    url?: URL
}
export type IRequest<Locals extends { locals?: Record<string, any> } = { locals: IDefaultLocals }> =
    & http.IncomingMessage
    & Locals;

export type IResponse =
    & http.ServerResponse<http.IncomingMessage>
    & {
        req: http.IncomingMessage
    }

export type IProxyResponse = http.IncomingMessage;

export type IRequestContext<Locals extends { locals?: Record<string, any> } = { locals: IDefaultLocals }> =
    & {
        req: IRequest & Locals
        res: IResponse
    }

export type ResponseContext<Locals extends { locals?: Record<string, any> } = { locals: IDefaultLocals }> =
    & {
        req: IRequest & Locals
        res: IResponse
        proxyRes: IProxyResponse
    }

export type ConnectContext<Locals extends { locals?: Record<string, any> } = { locals: IDefaultLocals }> =
    & {
        req: IRequest & Locals
        clientSocket: stream.Duplex
        head: Buffer
    }

export type IRequestListener = (request: IRequest, response: IResponse) => void | Promise<void>;

export type IConnectListener = (request: IRequest, clientSocket: stream.Duplex, head: Buffer) => void | Promise<void>;

export type IUpgradeListener = (request: IRequest, clientSocket: stream.Duplex, head: Buffer) => void | Promise<void>;

export type IErrorListener = (err: Error, socket?: stream.Duplex) => void | Promise<void>;