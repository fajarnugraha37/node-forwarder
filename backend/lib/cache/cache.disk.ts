
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as util from 'util';
import { CacheService, CacheOptions } from '../types/cache.js';

const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);
const fsUnlink = util.promisify(fs.unlink);
const fsAccess = util.promisify(fs.access);

export class DiskCache implements CacheService {
    private cleanupTimer: NodeJS.Timeout | null = null;

    constructor(public readonly opts: CacheOptions & { type: 'disk' }) {
        this.ensureCacheDir();
        this.startCleanup();
    }

    // Ensure the cache directory exists
    private ensureCacheDir() {
        if (!fs.existsSync(this.opts.dir)) {
            fs.mkdirSync(this.opts.dir, { recursive: true });
        }
    }

    // Start periodic cleanup for expired cache entries
    private startCleanup(): void {
        this.cleanupTimer = setInterval(() => this.cleanup(), this.opts.cleanUpInterval);
    }

    // Generate a hashed filename based on the cache key
    private generateCacheFilePath(key: string): string {
        const hash = crypto.createHash('md5').update(key).digest('hex');
        return path.join(this.opts.dir, `${hash}.json`);
    }

    async get(key: string): Promise<string | null> {
        const cacheFilePath = this.generateCacheFilePath(key);
        try {
            await fsAccess(cacheFilePath);
            const cacheEntry = JSON.parse(await fsReadFile(cacheFilePath, 'utf-8'));
            if (cacheEntry.expiresAt > Date.now()) {
                return cacheEntry.data;
            }
            await fsUnlink(cacheFilePath); // Delete expired cache file
        } catch {
            // Cache miss or file read error
        }
        return null;
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        const cacheFilePath = this.generateCacheFilePath(key);
        const cacheEntry = {
            data: value,
            expiresAt: Date.now() + (ttl || this.opts.age),
        };
        await fsWriteFile(cacheFilePath, JSON.stringify(cacheEntry), 'utf-8');
    }

    async delete(key: string): Promise<void> {
        const cacheFilePath = this.generateCacheFilePath(key);
        await fsUnlink(cacheFilePath).catch(() => { });
    }

    // Clean up expired cache entries
    async cleanup(): Promise<void> {
        const now = Date.now();
        const files = fs.readdirSync(this.opts.dir);
        for (const file of files) {
            const filePath = path.join(this.opts.dir, file);
            try {
                const cacheEntry = JSON.parse(await fsReadFile(filePath, 'utf-8'));
                if (cacheEntry.expiresAt < now) {
                    await fsUnlink(filePath);
                }
            } catch (err) {
                console.error(`Error cleaning up cache file ${file}:`, err);
            }
        }
    }

    // Stop the cleanup interval when done (e.g., application shutdown)
    public stopCleanup(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}