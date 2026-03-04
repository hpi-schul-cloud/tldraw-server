import { IsUrl } from 'class-validator';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export const AUTHORIZATION_CONFIG = 'AUTHORIZATION_CONFIG';
@Configuration()
export class AuthorizationConfig {
	@IsUrl({ require_tld: false })
	@ConfigProperty()
	public AUTHORIZATION_API_HOST!: string;
}
