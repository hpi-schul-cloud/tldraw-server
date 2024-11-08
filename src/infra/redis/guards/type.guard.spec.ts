import { TypeGuard } from './type.guard.js';

describe('TypeGuard', () => {
	describe('isString', () => {
		describe('when passing type of value is a string', () => {
			it('should be return true', () => {
				expect(TypeGuard.isString('string')).toBe(true);
			});

			it('should be return true', () => {
				expect(TypeGuard.isString('')).toBe(true);
			});
		});

		describe('when passing type of value is NOT a string', () => {
			it('should be return false', () => {
				expect(TypeGuard.isString(undefined)).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isString(null)).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isString({})).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isString(1)).toBe(false);
			});
		});
	});

	describe('checkString', () => {
		describe('when passing type of value is a string', () => {
			it('should be return value', () => {
				expect(TypeGuard.checkString('string')).toEqual('string');
			});

			it('should be return value', () => {
				expect(TypeGuard.checkString('')).toEqual('');
			});
		});

		describe('when passing type of value is NOT a string', () => {
			it('should be return false', () => {
				expect(() => TypeGuard.checkString(undefined)).toThrowError('Type is not a string');
			});

			it('should be return false', () => {
				expect(() => TypeGuard.checkString(null)).toThrowError('Type is not a string');
			});

			it('should be return false', () => {
				expect(() => TypeGuard.checkString({})).toThrowError('Type is not a string');
			});

			it('should be return false', () => {
				expect(() => TypeGuard.checkString(1)).toThrowError('Type is not a string');
			});
		});
	});

	describe('isArray', () => {
		describe('when passing type of value is an array', () => {
			it('should be return true', () => {
				expect(TypeGuard.isArray([])).toBe(true);
			});

			it('should be return true', () => {
				expect(TypeGuard.isArray(['', '', ''])).toBe(true);
			});
		});

		describe('when passing type of value is NOT an array', () => {
			it('should be return false', () => {
				expect(TypeGuard.isArray(undefined)).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isArray(null)).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isArray({})).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isArray(1)).toBe(false);
			});
		});
	});

	describe('checkArray', () => {
		describe('when passing type of value is an array', () => {
			it('should be return value', () => {
				expect(TypeGuard.checkArray([])).toEqual([]);
			});

			it('should be return value', () => {
				expect(TypeGuard.checkArray(['', '', ''])).toEqual(['', '', '']);
			});
		});

		describe('when passing type of value is NOT an array', () => {
			it('should throw an error', () => {
				expect(() => TypeGuard.checkArray(undefined)).toThrowError('Type is not an array.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkArray(null)).toThrowError('Type is not an array.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkArray({})).toThrowError('Type is not an array.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkArray(1)).toThrowError('Type is not an array.');
			});
		});
	});

	describe('isArrayWithElements', () => {
		describe('when passing type of value is an array with elements', () => {
			it('should be return true', () => {
				expect(TypeGuard.isArrayWithElements([1, 2, 3])).toBe(true);
			});

			it('should be return true', () => {
				expect(TypeGuard.isArrayWithElements(['a', 'b', 'c'])).toBe(true);
			});

			it('should be return true', () => {
				expect(TypeGuard.isArrayWithElements([{ a: 1 }, { b: 2 }])).toBe(true);
			});
		});

		describe('when passing type of value is NOT an array with elements', () => {
			it('should be return false', () => {
				expect(TypeGuard.isArrayWithElements([])).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isArrayWithElements(undefined)).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isArrayWithElements(null)).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isArrayWithElements({})).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isArrayWithElements(1)).toBe(false);
			});
		});
	});

	describe('checkArrayWithElements', () => {
		describe('when passing type of value is an array', () => {
			it('should be return value', () => {
				expect(TypeGuard.checkUnknownArrayWithElements(['', '', ''])).toEqual(['', '', '']);
			});
		});

		describe('when passing type of value is NOT an array', () => {
			it('should throw an error', () => {
				expect(() => TypeGuard.checkUnknownArrayWithElements([])).toThrowError('Type is not an array with elements.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkUnknownArrayWithElements(undefined)).toThrowError(
					'Type is not an array with elements.',
				);
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkUnknownArrayWithElements(null)).toThrowError('Type is not an array with elements.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkUnknownArrayWithElements({})).toThrowError('Type is not an array with elements.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkUnknownArrayWithElements(1)).toThrowError('Type is not an array with elements.');
			});
		});
	});

	describe('isBuffer', () => {
		describe('when passing type of value is a buffer', () => {
			it('should be return true', () => {
				const buffer = Buffer.from('buffer');
				expect(TypeGuard.isBuffer(buffer)).toBe(true);
			});
		});

		describe('when passing type of value is NOT a buffer', () => {
			it('should be return false', () => {
				expect(TypeGuard.isBuffer(undefined)).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isBuffer(null)).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isBuffer({})).toBe(false);
			});

			it('should be return false', () => {
				expect(TypeGuard.isBuffer(1)).toBe(false);
			});
		});
	});

	describe('checkBuffer', () => {
		describe('when passing type of value is a buffer', () => {
			it('should be return value', () => {
				const buffer = Buffer.from('buffer');
				expect(TypeGuard.checkBuffer(buffer)).toEqual(buffer);
			});
		});

		describe('when passing type of value is NOT a buffer', () => {
			it('should throw an error', () => {
				expect(() => TypeGuard.checkBuffer(undefined)).toThrow('Type is not a buffer.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkBuffer(null)).toThrow('Type is not a buffer.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkBuffer({})).toThrow('Type is not a buffer.');
			});

			it('should throw an error', () => {
				expect(() => TypeGuard.checkBuffer(1)).toThrow('Type is not a buffer.');
			});
		});
	});
});
