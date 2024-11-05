export type IRequest<Locals extends { locals?: Record<string, any> } = { locals: {} }> = http.IncomingMessage & {
    locals: Locals
}

export type IResponse = http.ServerResponse<http.IncomingMessage> & {
    req: http.IncomingMessage
}

export type IProxyResponse = http.IncomingMessage;

export type IRequestContext<Locals extends { locals?: Record<string, any> } = { locals: {} }> = {
    req: IRequest & Locals
    res: IResponse
}

export type ResponseContext<Locals extends { locals?: Record<string, any> } = { locals: {} }> = {
    req: Request & Locals
    res: IResponse
    proxyRes: ProxyResponse
}

export type ConnectContext<Locals extends { locals?: Record<string, any> } = { locals: {} }> = {
    req: Request & Locals
    clientSocket: internal.Duplex
    head: Buffer
}