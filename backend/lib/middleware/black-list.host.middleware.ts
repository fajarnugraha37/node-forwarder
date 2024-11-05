import { Middleware } from "../types/index.js";


export const BlackListHostMiddleware: Middleware<{ request: Request, response: Response }> = (context, next) => {
    // TODO: implement
    return next();
}