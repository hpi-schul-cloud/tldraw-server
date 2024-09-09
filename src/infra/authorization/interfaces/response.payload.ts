export interface ResponsePayload {
	hasWriteAccess: boolean;
	room: string | null;
	userid: string | null;
	error: Partial<CloseEvent> | null;
}
