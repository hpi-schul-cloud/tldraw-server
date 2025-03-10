import { Awareness } from 'y-protocols/awareness';
import { Doc } from 'yjs';

export interface YRedisDocProps {
	ydoc: Doc;
	awareness: Awareness;
	redisLastId: string;
	storeReferences: string[] | null;
	docChanged: boolean;
	streamName: string;
}
