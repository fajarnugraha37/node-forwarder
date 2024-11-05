import { InspectOptions } from "util";
import { IStackFrame } from "./logger.d.ts";
export { InspectOptions };

export interface INodeMetaStatic {
    name?: string;
    parentNames?: string[];
    runtime: string;
    runtimeVersion: string;
    hostname?: string;
}

export interface IMeta extends IMetaStatic {
    date: Date;
    logLevelId: number;
    logLevelName: string;
    path?: IStackFrame;
}