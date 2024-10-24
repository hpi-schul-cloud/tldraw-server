export interface StreamMessage {
	stream: string;
	messages: Uint8Array[];
	lastId: string;
}
