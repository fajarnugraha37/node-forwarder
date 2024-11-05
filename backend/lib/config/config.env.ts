import fs from 'fs';
import path from 'path';
import { resolveHomeDir } from './util.js';
import { DotEnvParseOutput, DotEnvPopulateInput, DotEnvConfigOptions, DotEnvConfigOutput } from '../types/config.js';

const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;

function parse<T extends DotEnvParseOutput = DotEnvParseOutput>(src: string | Buffer): T {
    const obj: { [key: string]: unknown } = {};

    let lines: string = src.toString();
    lines = lines.replace(/\r\n?/mg, '\n');

    let match: RegExpExecArray | null;
    while ((match = LINE.exec(lines)) != null) {
        const key = match[1];

        let value = (match[2] || '');
        value = value.trim();

        // Check if double quoted && Remove surrounding quotes
        const maybeQuote = value[0]
        value = value.replace(/^(['"`])([\s\S]*)\1$/mg, '$2');

        // Expand newlines if double quoted
        if (maybeQuote === '"') {
            value = value.replace(/\\n/g, '\n');
            value = value.replace(/\\r/g, '\r');
        }

        obj[key] = value;
    }

    return obj as T
}

function populate(processEnv: DotEnvPopulateInput, parsed: DotEnvPopulateInput, options?: DotEnvConfigOptions): void {
    const debug = Boolean(options && options.debug)
    const override = Boolean(options && options.override)

    if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(parsed)) {
            if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
                if (override === true) {
                    processEnv[key] = (parsed as { [key: string]: any })[key] as any;
                }

                if (debug) {
                    if (override === true) {
                        console.debug(`"${key}" is already defined and WAS overwritten`);
                    } else {
                        console.debug(`"${key}" is already defined and was NOT overwritten`);
                    }
                }
            } else {
                processEnv[key] = (parsed as { [key: string]: any })[key];
            }
        }
    } else {
        const err = new Error('OBJECT_REQUIRED: Please check the processEnv argument being passed to populate');
        throw err;
    }
}


export function loadDotEnv(options?: DotEnvConfigOptions): DotEnvConfigOutput {
    const dotenvPath = path.resolve(process.cwd(), '.env')
    let encoding: BufferEncoding = 'utf8'
    const debug = Boolean(options && options.debug)

    if (options && options.encoding) {
        encoding = options.encoding
    } else {
        if (debug) {
            console.debug('No encoding is specified. UTF-8 is used by default')
        }
    }

    let optionPaths = [dotenvPath] // default, look for .env
    if (options && options.path) {
        if (!Array.isArray(options.path)) {
            optionPaths = [resolveHomeDir(options.path as any)]
        } else {
            optionPaths = [] // reset default
            for (const filepath of options.path) {
                optionPaths.push(resolveHomeDir(filepath))
            }
        }
    }

    // Build the parsed data in a temporary object (because we need to return it).  Once we have the final
    // parsed data, we will combine it with process.env (or options.processEnv if provided).
    let lastError
    const parsedAll = {}
    for (const path of optionPaths) {
        try {
            const parsed = parse(fs.readFileSync(path, { encoding }))

            populate(parsedAll, parsed, options)
        } catch (e) {
            if (debug && e instanceof Error) {
                console.debug(`Failed to load ${path} ${e.message}`)
            }
            lastError = e
        }
    }

    let processEnv = process.env;
    if (options && options.processEnv != null) {
        processEnv = options.processEnv
    }

    populate(processEnv as DotEnvPopulateInput, parsedAll, options)

    if (lastError) {
        return { parsed: parsedAll, error: lastError as Error }
    } else {
        return { parsed: parsedAll }
    }
}