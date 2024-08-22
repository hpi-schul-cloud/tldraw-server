import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
	@Get('/')
	healthy(): string {
		return 'hello tldraw';
	}
}
