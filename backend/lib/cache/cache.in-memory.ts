import { CacheOptions, CacheService } from "../types/index.js";

export class InMemoryCache implements CacheService {
    private cache = new Map<string, { data: string; timeoutId: NodeJS.Timeout }>();

    constructor(public readonly opts: CacheOptions & { type: 'in-memory' }) {

    }
    async get(key: string): Promise<string | null> {
        const item = this.cache.get(key);
        if (item) {
            return item.data;
        }
        return null;
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        // Remove existing entry if it exists to reset the timeout
        const existing = this.cache.get(key);
        if (existing) {
            clearTimeout(existing.timeoutId);
        }

        // Set the cache data and schedule removal after TTL expires
        const timeoutId = setTimeout(() => {
            this.cache.delete(key);
        }, ttl || this.opts.age);

        this.cache.set(key, { data: value, timeoutId });
    }

    async delete(key: string): Promise<void> {
        const item = this.cache.get(key);
        if (item) {
            clearTimeout(item.timeoutId);
            this.cache.delete(key);
        }
    }
}
