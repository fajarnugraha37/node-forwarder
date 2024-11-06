import { IRequestContext, Middleware } from "../types/index.js";


export const PingMiddleware: Middleware<IRequestContext> = ({ req, res }, next) => {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
        message: 'Pong!',
    }, null, 2))
}