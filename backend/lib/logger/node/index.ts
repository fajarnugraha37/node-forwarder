import { IRuntime } from "../../types/index.js";
import { getMeta, transportJSON, transportFormatted } from "./runtime.js";
import { getCallerStackFrame, getErrorTrace, prettyFormatLogObj, prettyFormatErrorObj, isError, isBuffer } from "./util.js";

export default {
    getCallerStackFrame,
    getErrorTrace,
    getMeta,
    transportJSON,
    transportFormatted,
    isBuffer,
    isError,
    prettyFormatLogObj,
    prettyFormatErrorObj,
} as IRuntime;