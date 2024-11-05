interface MergeOptions extends ArrayMergeOptions {
    arrayMerge?(target: any[], source: any[], options?: ArrayMergeOptions): any[];
    clone?: boolean;
    customMerge?: (key: string, options?: MergeOptions) => ((x: any, y: any) => any) | undefined;
}

interface ArrayMergeOptions {
    isMergeableObject(value: object): boolean;
    cloneUnlessOtherwiseSpecified(value: object, options?: MergeOptions): object;
}