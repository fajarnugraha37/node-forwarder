import { loadDotEnv } from './config.env.js';
import { configJson } from './config.json.js';


export function getConfig() {
    loadDotEnv({
        path: '.env' + (process.env.NODE_ENV || '.' + process.env.NODE_ENV),
        override: true,
    });

    const selectedConfig = (() => {
        switch (process.env.CONFIG_TYPE) {
            case 'json':
            default:
                return configJson;
        }
    })();

    return selectedConfig;
}