import { Awareness } from 'y-protocols/awareness';
import { Doc } from 'yjs';
import { YRedisDocProps } from './interfaces/y-redis-doc-props.js';

export class YRedisDoc {
	public readonly ydoc: Doc;
	public readonly awareness: Awareness;
	public readonly redisLastId: string;
	public readonly storeReferences: string[] | null;
	public readonly docChanged: boolean;
	public readonly streamName: string;

	public constructor(props: YRedisDocProps) {
		this.ydoc = props.ydoc;
		this.awareness = props.awareness;
		this.redisLastId = props.redisLastId;
		this.storeReferences = props.storeReferences;
		this.docChanged = props.docChanged;
		this.streamName = props.streamName;
	}

	public getAwarenessStateSize(): number {
		return this.awareness.getStates().size;
	}
}
