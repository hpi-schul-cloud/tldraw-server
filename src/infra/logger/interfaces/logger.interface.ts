export interface RequestLoggingBody {
	userId?: string;
	request: { url: string; method: string; params: unknown; query: unknown };
	error: unknown | undefined;
}
