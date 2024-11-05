export type CacheOptions =
    & 
    {
        age: number,
    }
    &
    (
        | {
            type: 'in-memory',
        }
        | {
            type: 'disk',
            dir: string,
            cleanUpInterval: number,
        }
    )

export interface CacheService {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl: number): Promise<void>;
    delete(key: string): Promise<void>;
    cleanup?(): Promise<void>; // Optional cleanup method
    stopCleanup?(): void;
}