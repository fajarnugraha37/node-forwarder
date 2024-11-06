import path from "path";
import fs from "fs";
import { ConfigOptions, IConfigServer } from "../types/index.js";
import { Logger } from "../logger/index.js";
import { deepmerge } from "../helper/object-merge.js";
import { defaultConfig } from "./config.defaut.js";


// TODO: add validation
// And fallback to env var if null

const logger = new Logger({ name: 'ConfigJsonService' });
let config: ConfigOptions | null = null;

function load() {
    if(!process.env.CONFIG_PATH) {
        logger.warn('configuration is not specified, will use default config file')
    }
    const configPath = path.resolve(process.env.CONFIG_PATH || (process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}.json` : '.env.json'));
    config = JSON.parse(fs.readFileSync(configPath).toString());
    if(!config) {
        config = defaultConfig;
    } else {
        config = deepmerge(config!, defaultConfig);
    }
}

function get() {
    if(!config) {
        load();
    }

    return config!;
}

export const configJson: IConfigServer = {
    load: load,
    get: get,
}