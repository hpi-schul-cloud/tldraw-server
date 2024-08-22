import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '../metrics.service.js';

@Controller('/metrics')
export class MetricsController {
	constructor(private readonly appService: MetricsService) {}

	@Get()
	getMetrics(): Promise<string> {
		return this.appService.getMetrics();
	}
}
