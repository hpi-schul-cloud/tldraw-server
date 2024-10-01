import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';
import { RedisConfig } from '../../infra/redis/redis.config.js';

export class ServerConfig extends RedisConfig {
	@IsString()
	public WS_PATH_PREFIX = '';

	@IsNumber()
	@Transform(({ value }) => parseInt(value))
	public WS_PORT = 3345;
}
