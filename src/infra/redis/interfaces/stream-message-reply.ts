import { RedisKey } from 'ioredis';

interface Message {
	key: RedisKey;
	m?: RedisKey;
	docName?: string;
	compact?: string;
}

export interface StreamMessageReply {
	id: RedisKey;
	message: Record<keyof Message, RedisKey>;
}

export interface StreamMessagesSingleReply {
	name: string;
	messages: StreamMessageReply[] | null;
}

export type StreamMessagesReply = {
	name: string;
	messages: StreamMessageReply[] | null;
}[];
