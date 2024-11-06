import { Middleware } from "../types/middleware.js";


export class MiddlewareContainer<T> {
    private readonly middlewares: Middleware<T>[] = [];

    constructor() {
    }

    /**
     * function to register middleware to container
     * 
     * @param mw middleware want to register
     */
    use(...mw: Middleware<T>[]): void {
        this.middlewares.push(...mw);
    }

    /**
     * Execute the chain of middlewares, in the order they were added on a
     * given Context.
     */
    /**
     * Execute the chain of middlewares, in the order they were registered
     * 
     * @param context request context 
     * @returns 
     */
    dispatch(context: T): Promise<void> {
        return this.#invoke(context, this.middlewares);
    }

    /**
     * Helper functions to call a set of middleware on a context.
     * 
     * @param context Request context
     * @param middlewares list of registered middleware
     * @returns 
     */
    async #invoke<T>(context: T, middlewares: Middleware<T>[]): Promise<void> {
        if (!middlewares.length)
            return;

        const mw = middlewares[0];
        return mw(context, async () => await this.#invoke(context, middlewares.slice(1)));
    }
}