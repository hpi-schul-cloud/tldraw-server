import { repl } from '@nestjs/core';
import { CliModule } from '../modules/cli/cli.module.js';

async function bootstrap(): Promise<void> {
	await repl(CliModule);
}
bootstrap();
