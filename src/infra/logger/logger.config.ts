import { Transform } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

export class LoggerConfig {
	@IsString()
	public NEST_LOG_LEVEL!: string;

	@IsBoolean()
	@Transform(({ value }) => value === 'true')
	public EXIT_ON_ERROR!: boolean;
}
