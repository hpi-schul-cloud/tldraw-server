import { plainToClass } from 'class-transformer';
import { StringToNumber } from './string-to-number.transformer.js';

describe('ToNumberTransformer Decorator', () => {
	describe('when transform a string to number', () => {
		class WithNumberDto {
			@StringToNumber()
			public numberProp!: number;
		}

		it('should return the same number if value is already a number', () => {
			const plainNum1 = { numberProp: 123 };
			const instance = plainToClass(WithNumberDto, plainNum1);
			expect(instance.numberProp).toEqual(123);
		});

		it('should transform from string to number', () => {
			const plainNum2 = { numberProp: '456' };
			const instance = plainToClass(WithNumberDto, plainNum2);
			expect(instance.numberProp).toEqual(456);
		});

		it('should throw if value is not a string', () => {
			const plainNum3 = { numberProp: null };
			expect(() => plainToClass(WithNumberDto, plainNum3)).toThrow('Type is not a string');
		});
	});
});
