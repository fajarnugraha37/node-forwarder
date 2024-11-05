import { hostname } from "os";
import { formatWithOptions, InspectOptions } from "util";
import { getCallerStackFrame } from "../../helper/index.js";
import { ILogObjMeta, IMeta, INodeMetaStatic, ISettings } from "../../types/index.js";
export { InspectOptions };


const meta: INodeMetaStatic = {
    runtime: "Nodejs",
    runtimeVersion: process?.version,
    hostname: hostname ? hostname() : undefined,
};

export function getMeta(
    logLevelId: number,
    logLevelName: string,
    stackDepthLevel: number,
    hideLogPositionForPerformance: boolean,
    name?: string,
    parentNames?: string[]
): IMeta {
    // faster than spread operator
    return Object.assign({}, meta, {
        name,
        parentNames,
        date: new Date(),
        logLevelId,
        logLevelName,
        path: !hideLogPositionForPerformance ? getCallerStackFrame(stackDepthLevel) : undefined,
    }) as IMeta;
}

export function transportFormatted<LogObj>(logMetaMarkup: string, logArgs: unknown[], logErrors: string[], settings: ISettings<LogObj>): void {
    const logErrorsStr = (logErrors.length > 0 && logArgs.length > 0 ? "\n" : "") + logErrors.join("\n");
    settings.prettyInspectOptions.colors = settings.stylePrettyLogs;
    console.log(logMetaMarkup + formatWithOptions(settings.prettyInspectOptions, ...logArgs) + logErrorsStr);
}

export function transportJSON<LogObj>(json: LogObj & ILogObjMeta): void {
    console.log(jsonStringifyRecursive(json));

    function jsonStringifyRecursive(obj: unknown) {
        const cache = new Set();
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (cache.has(value)) {
                    // Circular reference found, discard key
                    return "[Circular]";
                }
                // Store value in our collection
                cache.add(value);
            }
            if (typeof value === "bigint") {
                return `${value}`;
            }
            if (typeof value === "undefined") {
                return "[undefined]";
            }
            return value;
        });
    }
}