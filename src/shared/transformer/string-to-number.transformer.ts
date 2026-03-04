import { Transform, TransformFnParams } from 'class-transformer';

/**
 * Decorator to transform a number-string value to a number.
 * Place after IsNumber decorator.
 * @returns
 */
export function StringToNumber(): PropertyDecorator {
	return Transform((params: TransformFnParams) => {
		const str = params.obj[params.key] as string;

		return parseInt(str);
	});
}
