const REACT_ELEMENT_TYPE = (typeof Symbol === 'function' && Symbol.for) ? Symbol.for('react.element') : 0xeac7;

export function isMergeableObject(value: any): boolean {
	return isNonNullObject(value)
		&& !isSpecial(value)
}

export function isNonNullObject(value: unknown): value is object {
	return !!value
		&& typeof value === 'object';
}

export function isSpecial(value: unknown): boolean {
	const stringValue = Object.prototype.toString.call(value)

	return stringValue === '[object RegExp]'
		|| stringValue === '[object Date]'
		|| (value as any)?.$$typeof === REACT_ELEMENT_TYPE;
}

export function isNothing(value: unknown): value is null | undefined {
	return (typeof value === 'undefined') || (value === null);
}

export function isNegativeZero(number: unknown) {
	return (number === 0) && (Number.NEGATIVE_INFINITY === 1 / number);
}