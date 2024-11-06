import { ConnectContext, IRequestContext, Middleware } from "../types/index.js";


export const proxyAuthMiddleware = (opts: { username: string, password: string }): Middleware<IRequestContext | ConnectContext> => (context, next) => {
    const sendAuthRequired = () => {
        if ('res' in context) {
            if(context.req.locals?.url?.protocol === 'https:') {
                return next();
            }
            context.res.writeHead(407, { "Proxy-Authenticate": "Basic" })
            context.res.end()
        } else if ('clientSocket' in context) {
            context.clientSocket.end(
                "HTTP/1.1 407\r\n" 
                + "Proxy-Authenticate: basic\r\n" 
                + "\r\n"
            )
        }
    }
    const proxyAuth = context.req.headers["proxy-authorization"];
    if (!proxyAuth) {
        return sendAuthRequired();
    }
    const [proxyUser, proxyPass] = Buffer.from(proxyAuth.replace("Basic ", ""), "base64")
        .toString()
        .split(":");

    if (opts.username !== proxyUser || opts.password !== proxyPass) {
        return sendAuthRequired();
    }

    return next();
}