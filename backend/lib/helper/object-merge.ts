import { emptyTarget, getKeys, propertyIsOnObject, propertyIsUnsafe } from "./object.js";
import { isMergeableObject } from "./is.js";

function cloneUnlessOtherwiseSpecified(value: object, options?: MergeOptions): object {
	return (options && options.clone !== false && options.isMergeableObject && options.isMergeableObject(value))
		? deepmerge(emptyTarget(value), value, options)
		: value;
}


function defaultArrayMerge(target: any[], source: any[], options?: ArrayMergeOptions) {
	return target.concat(source).map(function(element: object) {
		return cloneUnlessOtherwiseSpecified(element, options);
	})
}
function getMergeFunction(key: string, options: MergeOptions) {
	if (!options.customMerge) {
		return deepmerge;
	}
	const customMerge = options.customMerge(key);
	return typeof customMerge === 'function' ? customMerge : deepmerge;
}


function mergeObject(target: any, source: any, options: MergeOptions) {
	const destination: {[key: string]: any } = {}
	if (options && options.isMergeableObject && options.isMergeableObject(target)) {
		getKeys(target).forEach(function(key) {
			destination[key] = cloneUnlessOtherwiseSpecified(target[key], options)
		});
	}
	getKeys(source).forEach(function(key) {
		if (propertyIsUnsafe(target, key)) {
			return;
		}

		if (propertyIsOnObject(target, key) && options.isMergeableObject && options.isMergeableObject(source[key])) {
			destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
		} else {
			destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
		}
	})
	return destination;
}

function deepmerge<T>(source: Partial<T>, target: Partial<T>, options?: MergeOptions): T;
function deepmerge<T1, T2>(source: Partial<T1>, target: Partial<T2>, options?: MergeOptions): T1 & T2 {
	options = options || {} as MergeOptions;
	options.arrayMerge = options.arrayMerge || defaultArrayMerge;
	options.isMergeableObject = options.isMergeableObject || isMergeableObject;
	// cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
	// implementations can use it. The caller may not replace it.
	options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;

	const sourceIsArray = Array.isArray(source);
	const targetIsArray = Array.isArray(target);
	const sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

	if (!sourceAndTargetTypesMatch) {
		return cloneUnlessOtherwiseSpecified(source, options) as any;
	} else if (sourceIsArray) {
		return options.arrayMerge(target as any, source, options) as any;
	} else {
		return mergeObject(target, source, options) as any;
	}
}

function all (array: object[], options?: ArrayMergeOptions): object;
function all<T> (array: Partial<T>[], options?: ArrayMergeOptions): T {
	if (!Array.isArray(array)) {
		throw new Error('first argument should be an array')
	}

	return array.reduce(function(prev, next) {
		return deepmerge(prev, next, options)
	}, {}) as any;
}


export {
    deepmerge,
    all,
}