import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigModuleOptions } from '@nestjs/config';
import { Configuration } from './configuration.service.js';

const getEnvConfig = (): ConfigModuleOptions => {
	const envConfig = {
		envFilePath: '.env',
		ignoreEnvFile: false,
	};

	if (process.env.NODE_ENV === 'test') {
		envConfig.envFilePath = '.env.test';
	}

	if (process.env.NODE_ENV === 'production') {
		envConfig.ignoreEnvFile = true;
	}

	return envConfig;
};

@Module({})
export class ConfigurationModule {
	public static register<T extends object>(Constructor: new () => T): DynamicModule {
		return {
			imports: [ConfigModule.forRoot({ cache: true, ...getEnvConfig() })],
			providers: [
				Configuration,
				{
					provide: Constructor,
					useFactory: (config: Configuration): T => config.getAllValidConfigsByType(Constructor),
					inject: [Configuration],
				},
			],
			exports: [Configuration, Constructor],
			module: ConfigurationModule,
		};
	}
}
