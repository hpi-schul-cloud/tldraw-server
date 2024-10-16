import { IsUrl } from 'class-validator';

export class AuthorizationConfig {
	@IsUrl({ require_tld: false })
	public API_HOST!: string;
}
