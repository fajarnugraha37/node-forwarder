import { isNothing } from "./is.js";

export function toArray<T>(sequence: T): T extends unknown[] ? T: T[] {
	if (Array.isArray(sequence)) 
		return sequence as any;
	if (isNothing(sequence)) 
		return [] as any;

	return [sequence] as any;
}