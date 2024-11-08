export interface YRedisMessage {
	stream: string;
	messages: Uint8Array[];
	lastId: string;
}
