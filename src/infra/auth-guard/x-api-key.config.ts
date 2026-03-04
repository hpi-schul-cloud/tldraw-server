import { IsArray } from 'class-validator';
import { CommaSeparatedStringToArray } from '../../shared/transformer/index.js';
import { ConfigProperty, Configuration } from '../configuration/index.js';

export const X_API_KEY_CONFIG = 'X_API_KEY_CONFIG';
@Configuration()
export class XApiKeyConfig {
	@CommaSeparatedStringToArray()
	@IsArray()
	@ConfigProperty()
	public X_API_ALLOWED_KEYS!: string[];
}
