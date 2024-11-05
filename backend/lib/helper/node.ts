import { normalize as fileNormalize } from "path";
import { types, InspectOptions } from "util";
import { formatTemplate } from "./fromatter.js";
import { ISettings, IStackFrame } from "../types/index.js";
export { InspectOptions };


export function getCallerStackFrame(stackDepthLevel: number, error: Error = Error()): IStackFrame {
    return stackLineToStackFrame((error as Error | undefined)?.stack?.split("\n")?.filter((thisLine: string) => thisLine.includes("    at "))?.[stackDepthLevel]);
}

export function getErrorTrace(error: Error): IStackFrame[] {
    return (error as Error)?.stack?.split("\n")?.reduce((result: IStackFrame[], line: string) => {
        if (line.includes("    at ")) {
            result.push(stackLineToStackFrame(line));
        }
        return result;
    }, []) as IStackFrame[];
}

function stackLineToStackFrame(line?: string): IStackFrame {
    const pathResult: IStackFrame = {
        fullFilePath: undefined,
        fileName: undefined,
        fileNameWithLine: undefined,
        fileColumn: undefined,
        fileLine: undefined,
        filePath: undefined,
        filePathWithLine: undefined,
        method: undefined,
    };
    if (line != null && line.includes("    at ")) {
        line = line.replace(/^\s+at\s+/gm, "");
        const errorStackLine = line.split(" (");
        const fullFilePath = line?.slice(-1) === ")" ? line?.match(/\(([^)]+)\)/)?.[1] : line;
        const pathArray = fullFilePath?.includes(":") ? fullFilePath?.replace("file://", "")?.replace(process.cwd(), "")?.split(":") : undefined;
        // order plays a role, runs from the back: column, line, path
        const fileColumn = pathArray?.pop();
        const fileLine = pathArray?.pop();
        const filePath = pathArray?.pop();
        const filePathWithLine = fileNormalize(`${filePath}:${fileLine}`);
        const fileName = filePath?.split("/")?.pop();
        const fileNameWithLine = `${fileName}:${fileLine}`;

        if (filePath != null && filePath.length > 0) {
            pathResult.fullFilePath = fullFilePath;
            pathResult.fileName = fileName;
            pathResult.fileNameWithLine = fileNameWithLine;
            pathResult.fileColumn = fileColumn;
            pathResult.fileLine = fileLine;
            pathResult.filePath = filePath;
            pathResult.filePathWithLine = filePathWithLine;
            pathResult.method = errorStackLine?.[1] != null ? errorStackLine?.[0] : undefined;
        }
    }
    return pathResult;
}

export function isError(e: Error | unknown): boolean {
    // An error could be an instance of Error while not being a native error
    // or could be from a different realm and not be instance of Error but still
    // be a native error.
    return types?.isNativeError != null ? types.isNativeError(e) : e instanceof Error;
}

export function prettyFormatLogObj<LogObj>(maskedArgs: unknown[], settings: ISettings<LogObj>): { args: unknown[]; errors: string[] } {
    return maskedArgs.reduce(
        (result: { args: unknown[]; errors: string[] }, arg) => {
            isError(arg) ? result.errors.push(prettyFormatErrorObj(arg as Error, settings)) : result.args.push(arg);
            return result;
        },
        { args: [], errors: [] }
    );
}

export function prettyFormatErrorObj<LogObj>(error: Error, settings: ISettings<LogObj>): string {
    const errorStackStr = getErrorTrace(error as Error).map((stackFrame) => {
        return formatTemplate(settings, settings.prettyErrorStackTemplate, { ...stackFrame }, true);
    });

    const placeholderValuesError = {
        errorName: ` ${error.name} `,
        errorMessage: Object.getOwnPropertyNames(error)
            .reduce((result: string[], key) => {
                if (key !== "stack") {
                    result.push((error as any)[key]);
                }
                return result;
            }, [])
            .join(", "),
        errorStack: errorStackStr.join("\n"),
    };
    return formatTemplate(settings, settings.prettyErrorTemplate, placeholderValuesError);
}

export function isBuffer(arg: unknown) {
    return Buffer.isBuffer(arg);
}