import { RedisKey } from 'ioredis';

export interface StreamMessageReply {
	id: RedisKey;
	message: Record<string, RedisKey>;
}

export type StreamsMessagesReply = {
	name: string;
	messages: StreamMessageReply[] | null;
}[];
