import { Middleware } from "../types/index.js";


export const RateLimieterHostMiddleware: Middleware<{ request: Request, response: Response }> = (context, next) => {
    // TODO: implement
    return next();
}