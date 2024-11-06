export function repeat(str: string, count: number) {
	let result = '', cycle;
	for (cycle = 0; cycle < count; cycle += 1) {
		result += str;
	}

	return result;
}