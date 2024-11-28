import { IsUrl } from 'class-validator';

export class AuthorizationConfig {
	@IsUrl({ require_tld: false })
	public AUTHORIZATION_API_HOST!: string;
}
