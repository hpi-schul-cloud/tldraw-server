import { createMock } from '@golevelup/ts-jest';
import { Factory } from 'fishery';
import { Awareness } from 'y-protocols/awareness.js';
import { Doc } from 'yjs';
import { YRedisDoc } from '../interfaces/y-redis-doc.js';

export const yRedisDocFactory = Factory.define<YRedisDoc>(({ sequence }) => {
	return {
		ydoc: createMock<Doc>(),
		awareness: createMock<Awareness>(),
		redisLastId: `last-id-${sequence}`,
		storeReferences: null,
		docChanged: false,
		streamName: `prefix:room:roomid:docid`,
		getAwarenessStateSize: (): number => 0,
	};
});
