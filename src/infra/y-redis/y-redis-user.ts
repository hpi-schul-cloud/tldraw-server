let _idCnt = 0;

export class YRedisUser {
	public subs: Set<string>;
	public id: number;
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
		/**
		 * This is just an identifier to keep track of the user for logging purposes.
		 */
		this.id = _idCnt++; // TODO
		this.awarenessId = null;
		this.awarenessLastClock = 0;
		this.isClosed = false;
	}

	public hasError(): boolean {
		return this.error !== null;
	}
}
