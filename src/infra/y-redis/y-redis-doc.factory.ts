import { YRedisDocProps } from './interfaces/y-redis-doc-props.js';
import { YRedisDoc } from './y-redis-doc.js';

export class YRedisDocFactory {
	public static build(props: YRedisDocProps): YRedisDoc {
		const yRedisDoc = new YRedisDoc(props);

		return yRedisDoc;
	}
}
