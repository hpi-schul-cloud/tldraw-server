import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from '../metrics.service.js';

@Controller('/metrics')
export class MetricsController {
	public constructor(private readonly appService: MetricsService) {}

	@Header('Content-Type', 'text/plain')
	@Get()
	public getMetrics(): Promise<string> {
		return this.appService.getMetrics();
	}
}
