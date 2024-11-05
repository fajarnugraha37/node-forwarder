import { Middleware } from "../types/index.js";


export const WhiteListHostMiddleware: Middleware<{ request: Request, response: Response }> = (context, next) => {
    // TODO: implement
    return next();
}