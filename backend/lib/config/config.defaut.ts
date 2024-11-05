import { ConfigOptions } from "../types/index.js";

export const defaultConfig: Required<ConfigOptions> = {
    port: 8080,
    host: "0.0.0.0",
    ssl: {
        certPath: 'cert/localhost.crt',
        keyPath: 'cert/localhost.key',
    }
}