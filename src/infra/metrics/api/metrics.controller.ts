import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from '../metrics.service.js';

@Controller('/metrics')
export class MetricsController {
	constructor(private readonly appService: MetricsService) {}

	@Header('Content-Type', 'text/plain')
	@Get()
	getMetrics(): Promise<string> {
		return this.appService.getMetrics();
	}
}
