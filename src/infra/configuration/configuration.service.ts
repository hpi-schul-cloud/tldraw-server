import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToClassFromExist } from 'class-transformer';
import { validateSync } from 'class-validator';

@Injectable()
export class Configuration {
	public constructor(private readonly configService: ConfigService) {}

	public getAllValidConfigsByType<T extends object>(Constructor: new () => T): T {
		const configInstance = new Constructor();
		const configKeys = Object.keys(configInstance);

		const configValues = configKeys.reduce((acc: Record<string, unknown>, key) => {
			const value = this.configService.get(key);

			if (value) {
				acc[key] = value;
			}

			return acc;
		}, {});

		const config = plainToClassFromExist(configInstance, configValues, { enableImplicitConversion: false });
		const validatedConfig = this.validate(config);

		return validatedConfig;
	}

	private validate<T extends object>(validatedConfig: T): T {
		const errors = validateSync(validatedConfig, { skipMissingProperties: false });

		if (errors.length > 0) {
			throw new Error(errors.toString());
		}

		return validatedConfig;
	}
}
