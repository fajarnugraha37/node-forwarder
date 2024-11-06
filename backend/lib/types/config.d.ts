export type ConfigOptions = {
    name: string,
    port: number,
    host?: string,
    requestTimeout: number
    ssl?: {
        certPath: string,
        keyPath: string,
    },
    auth: 
        | { type: 'none'}
        | { type: 'proxy-auth', username: string, password: string }
        | {};
}

export interface IConfigServer {
    load(): void;
    get(): ConfigOptions;
}

export interface DotEnvParseOutput {
    [name: string]: string;
}

export interface DotEnvPopulateInput {
    [name: string]: string;
}

export interface DotEnvConfigOutput {
    error?: Error;
    parsed?: DotEnvParseOutput;
}

export interface DotEnvPopulateOptions {
    debug?: boolean;

    /**
     * Override any environment variables that have already been set on your machine with values from your .env file.
     */
    override?: boolean;
}
export interface DotEnvConfigOptions {
    /**
     * Specify a custom path if your file containing environment variables is located elsewhere.
     * Can also be an array of strings, specifying multiple paths.
     */
    path?: string | string[] | URL;

    /**
     * Specify the encoding of your file containing environment variables.
     */
    encoding?: BufferEncoding;

    /**
     * Turn on logging to help debug why certain keys or values are not being set as you expect.
     */
    debug?: boolean;

    /**
     * Override any environment variables that have already been set on your machine with values from your .env file.
     */
    override?: boolean;

    /**
     * Specify an object to write your secrets to. Defaults to process.env environment variables.
     */
    processEnv?: DotEnvPopulateInput;
}
