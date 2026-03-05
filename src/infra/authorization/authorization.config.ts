import { IsUrl } from 'class-validator';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export const AUTHORIZATION_CONFIG = 'AUTHORIZATION_CONFIG';
@Configuration()
export class AuthorizationConfig {
	@IsUrl({ require_tld: false })
	@ConfigProperty('AUTHORIZATION_API_HOST')
	public authorizationApiHost!: string;
}
