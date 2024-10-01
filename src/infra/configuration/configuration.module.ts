import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './configuration.service.js';

@Module({})
export class ConfigurationModule {
	public static register<T extends object>(Constructor: new () => T): DynamicModule {
		return {
			imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
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
