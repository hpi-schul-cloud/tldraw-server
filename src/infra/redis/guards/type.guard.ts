export class TypeGuard {
	public static isString(value: unknown): value is string {
		const isString = typeof value === 'string';

		return isString;
	}

	public static checkString(value: unknown): string {
		if (!TypeGuard.isString(value)) {
			throw new Error('Type is not a string');
		}

		return value;
	}

	public static isArray(value: unknown): value is [] {
		const isArray = Array.isArray(value);

		return isArray;
	}

	public static checkArray(value: unknown): [] {
		if (!TypeGuard.isArray(value)) {
			throw new Error('Type is not an array.');
		}

		return value;
	}

	public static isArrayWithElements(value: unknown): value is [] {
		const isArrayWithElements = TypeGuard.isArray(value) && value.length > 0;

		return isArrayWithElements;
	}

	public static checkUnknownArrayWithElements(value: unknown): unknown[] {
		if (!TypeGuard.isArrayWithElements(value)) {
			throw new Error('Type is not an array with elements.');
		}

		return value;
	}

	public static isBuffer(value: unknown): value is Buffer {
		const isBuffer = Buffer.isBuffer(value);

		return isBuffer;
	}

	public static checkBuffer(value: unknown): Buffer {
		if (!TypeGuard.isBuffer(value)) {
			throw new Error('Type is not a buffer.');
		}

		return value;
	}
}
