import fs from 'fs';
import path from 'path';
import { resolveHomeDir } from './util.js';
import { DotEnvParseOutput, DotEnvPopulateInput, DotEnvConfigOptions, DotEnvConfigOutput } from '../types/config.js';

/**
 * (?:^|^)\s*: Matches the beginning of a line (either at the beginning of a string or after a newline) followed by whitespace (optional).
 * (?:export\s+)?: Matches the word "export" followed by whitespace (optional), which is often used to define variables in some scripting languages.
 * ([\w.-]+): Captures a variable name in a group. This variable consists of letters, numbers, periods, and underscores.
 * (?:\s*=\s*?|:\s+?): Matches an equal sign (=) or colon (:) used to separate a variable name from its value, with optional whitespace surrounding it.
 * (\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*(?:\|[^])*|[^#\r\n]+)?: Captures a variable value in a group. This value can be a string enclosed in single, double, or backquotes, or it can be a sequence of characters that does not include spaces, hash marks (#), carriage returns (\r), and line feeds (\n).
 * \s*(?:#.*)?: Matches optional whitespace followed by a comment (starting with a hash mark).
 * (?:$|$): Matches the end of a line (either at the end of the string or before a newline).
 * mg: Modifiers that make the match multi-line (m) and global (g), meaning the regex will search for all occurrences of the pattern in the entire text.
 */
const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;

function parse<T extends DotEnvParseOutput = DotEnvParseOutput>(src: string | Buffer): T {
    const obj: { [key: string]: unknown } = {};

    let lines: string = src.toString();
    // /\r\n?/mg: Matches one or two characters: a carriage return (\r) followed optionally by a line feed (\n). This is often used to replace newlines on various operating systems.
    lines = lines.replace(/\r\n?/mg, '\n');

    let match: RegExpExecArray | null;
    while ((match = LINE.exec(lines)) != null) {
        const key = match[1];

        let value = (match[2] || '');
        value = value.trim();

        // Check if double quoted && Remove surrounding quotes
        const maybeQuote = value[0]
        // /^(['"])([\s\S]*)\1$/mg`: Matches a string enclosed in single, double, or backticks. The inside of the quotes can contain any character, including newlines.
        value = value.replace(/^(['"`])([\s\S]*)\1$/mg, '$2');

        // Expand newlines if double quoted
        if (maybeQuote === '"') {
            // /\\n/g: Matches the newline character (\n) globally.
            value = value.replace(/\\n/g, '\n');
            // /\\r/g: Matches the carriage return character (\r) globally.
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