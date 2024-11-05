import { isNonNullObject, isSpecial } from "./is.js";

export function emptyTarget(val: unknown) {
    return Array.isArray(val) ? [] : {};
}

export function getEnumerableOwnPropertySymbols(target: any) {
    return Object.getOwnPropertySymbols
        ? Object.getOwnPropertySymbols(target).filter(function (symbol) {
            return Object.propertyIsEnumerable.call(target, symbol);
        })
        : [];
}

export function getKeys(target: any) {
    return Object.keys(target)
        .concat((getEnumerableOwnPropertySymbols(target) as unknown as string[]))
}

export function propertyIsOnObject(object: any, property: string) {
	try {
		return property in object;
	} catch(_) {
		return false;
	}
}

export function propertyIsUnsafe(target: any, key: string) {
	return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
		&& !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
			&& Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
}