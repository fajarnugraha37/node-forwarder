import { Middleware } from "../types/index.js";


export const AuthJwtMiddleware: Middleware<{ request: Request, response: Response }> = (context, next) => {
    // TODO: implement
    return next();
}