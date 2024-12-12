import { createMock } from '@golevelup/ts-jest';
import { Factory } from 'fishery';
import { Awareness } from 'y-protocols/awareness';
import { Doc } from 'yjs';
import { YRedisDoc } from '../y-redis-doc.js';

export const yRedisDocFactory = Factory.define<YRedisDoc>(({ sequence }) => {
	return {
		ydoc: createMock<Doc>(),
		awareness: createMock<Awareness>({
			destroy: () => {
				return;
			},
		}),
		redisLastId: `last-id-${sequence}`,
		storeReferences: null,
		docChanged: false,
		streamName: `prefix:room:roomid:docid`,
		getAwarenessStateSize: (): number => 0,
	};
});
