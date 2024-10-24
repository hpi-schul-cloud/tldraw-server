import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class ServerConfig {
	@IsString()
	public WS_PATH_PREFIX = '';

	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public WS_PORT = 3345;
}
