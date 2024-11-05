import path from 'path';
import os from 'os';

export function resolveHomeDir<T extends string | string[] | URL>(envPath: T) {
    return (typeof envPath === 'string') && envPath[0] === '~' 
        ? path.join(os.homedir(), envPath.slice(1)) 
        : envPath;
}