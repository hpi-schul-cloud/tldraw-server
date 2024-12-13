import { RedisKey } from 'ioredis';

interface Message {
	m?: Buffer;
	docName?: string;
	compact?: Buffer;
}

export interface StreamMessageReply {
	id: RedisKey;
	message: Message;
}

export interface StreamMessagesReply {
	name: string;
	messages: StreamMessageReply[] | null;
}
