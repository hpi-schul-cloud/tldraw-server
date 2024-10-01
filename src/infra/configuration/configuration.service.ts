import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

@Injectable()
export class Configuration {
	public constructor(private readonly configService: ConfigService) {}

	public getAllValidConfigsByType<T extends object>(Constructor: new () => T): T {
		const config = new Constructor();
		const configKeys = Object.keys(config);

		const configValues = configKeys.reduce((acc: Record<string, unknown>, key) => {
			const value = this.configService.get(key);

			if (value) {
				acc[key] = value;
			}

			return acc;
		}, {});

		const validatedConfig = this.validate(configValues, Constructor);

		return validatedConfig;
	}

	private validate<T extends object>(config: Record<string, unknown>, Constructor: new () => T): T {
		const validatedConfig = plainToInstance(Constructor, config);
		const errors = validateSync(validatedConfig);

		if (errors.length > 0) {
			throw new Error(errors.toString());
		}

		return validatedConfig;
	}
}
