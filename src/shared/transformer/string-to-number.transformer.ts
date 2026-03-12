import { Transform, TransformFnParams } from 'class-transformer';
import { TypeGuard } from '../guard/type.guard.js';

/**
 * Decorator to transform a number-string value to a number.
 * Place after IsNumber decorator.
 * @returns
 */
export function StringToNumber(): PropertyDecorator {
	return Transform((params: TransformFnParams) => {
		if (TypeGuard.isNumber(params.value)) {
			return params.value;
		}

		TypeGuard.checkString(params.obj[params.key]);

		const str = params.obj[params.key];

		return Number.parseInt(str);
	});
}
