import path from "path";
import fs from "fs/promises";
import { ConfigOptions, IConfigServer } from "../types/index.js";
import { Logger } from "../logger/index.js";


// TODO: add validation
// And fallback to env var if null

const logger = new Logger({ name: 'ConfigJsonService' });
let config: ConfigOptions | null = null;

async function load() {
    if(!process.env.CONFIG_PATH) {
        logger.warn('configuration is not specified, will use default config file')
    }
    const configPath = process.env.CONFIG_PATH ?? path.resolve(process.env.NODE_ENV ? `config.${process.env.NODE_ENV}.json` : 'config.json');
    config = JSON.parse((await fs.readFile(configPath)).toString());
}

async function get() {
    if(!config) {
        await load();
    }

    return config!;
}

export const configJson: IConfigServer = {
    load: load,
    get: get,
}