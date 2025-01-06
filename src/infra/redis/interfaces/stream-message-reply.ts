import { RedisKey } from 'ioredis';

export interface M {
	m: Buffer;
}

export interface DocName {
	docName: string;
}

export interface Compact {
	compact: Buffer;
}

export interface StreamMessageReply {
	id: RedisKey;
	message: M | DocName | Compact;
}

export interface StreamMessagesReply {
	name: string;
	messages: StreamMessageReply[] | null;
}
