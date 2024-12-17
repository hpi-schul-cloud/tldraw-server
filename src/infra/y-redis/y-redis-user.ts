export class YRedisUser {
	public subs: Set<string>;
	public awarenessId: number | null;
	public awarenessLastClock: number;
	public isClosed: boolean;
	public initialRedisSubId: string;

	public constructor(
		public readonly room: string | null,
		public readonly hasWriteAccess: boolean,
		/**
		 * Identifies the User globally.
		 * Note that several clients can have the same userid (e.g. if a user opened several browser
		 * windows)
		 */
		public readonly userid: string | null,
		public readonly error: Partial<CloseEvent> | null = null,
	) {
		this.initialRedisSubId = '0';
		this.subs = new Set();
		this.awarenessId = null;
		this.awarenessLastClock = 0;
		this.isClosed = false;
	}
}
