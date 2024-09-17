import { ResponsePayload } from './interfaces/response.payload.js';

export const ResponsePayloadBuilder = {
	build: (
		room: string | null = null,
		userid: string | null = null,
		error: Partial<CloseEvent> | null = null,
		hasWriteAccess = false,
	): ResponsePayload => {
		return { hasWriteAccess, room, userid, error };
	},

	buildWithError: (code: number, reason: string): ResponsePayload => {
		return ResponsePayloadBuilder.build(null, null, { code, reason });
	},
};
