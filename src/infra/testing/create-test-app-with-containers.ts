import { ConfigService } from '@nestjs/config';
import { DynamicModule, INestApplication, Type } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export type ConfigureTestModule = (
	moduleBuilder: TestingModuleBuilder,
	seaweedFsContainer: StartedTestContainer,
) => TestingModuleBuilder;

export async function createTestAppWithContainers(
	imports: (Type | DynamicModule)[],
	configure?: ConfigureTestModule,
): Promise<{
	app: INestApplication;
	seaweedFsContainer: StartedTestContainer;
}> {
	const seaweedFsContainer = await new GenericContainer('chrislusf/seaweedfs:latest')
		.withCommand(['mini', '-dir=/data', '-bucket=ydocs'])
		.withExposedPorts(8333)
		.withWaitStrategy(Wait.forListeningPorts())
		.start();

	let moduleBuilder = Test.createTestingModule({ imports })
		.overrideProvider(ConfigService)
		.useValue({
			get: (key: string) => {
				if (key === 'S3_ENDPOINT') {
					return seaweedFsContainer.getHost();
				}

				if (key === 'S3_PORT') {
					return seaweedFsContainer.getMappedPort(8333).toString();
				}

				return process.env[key];
			},
		});

	if (configure) {
		moduleBuilder = configure(moduleBuilder, seaweedFsContainer);
	}

	const moduleFixture = await moduleBuilder.compile();
	const app = moduleFixture.createNestApplication();
	await app.init();

	return { app, seaweedFsContainer };
}
