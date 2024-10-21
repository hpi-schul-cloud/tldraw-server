export const isSmallerRedisId = (a: string, b: string): boolean => {
	const [a1, a2 = '0'] = a.split('-');
	const [b1, b2 = '0'] = b.split('-');
	const a1n = parseInt(a1);
	const b1n = parseInt(b1);

	return a1n < b1n || (a1n === b1n && parseInt(a2) < parseInt(b2));
};

export const computeRedisRoomStreamName = (room: string, docid: string, prefix: string): string =>
	`${prefix}:room:${encodeURIComponent(room)}:${encodeURIComponent(docid)}`;

export const decodeRedisRoomStreamName = (rediskey: string, expectedPrefix: string) => {
	const match = rediskey.match(/^(.*):room:(.*):(.*)$/);
	if (match == null || match[1] !== expectedPrefix) {
		throw new Error(
			`Malformed stream name! prefix="${match?.[1]}" expectedPrefix="${expectedPrefix}", rediskey="${rediskey}"`,
		);
	}

	return { room: decodeURIComponent(match[2]), docid: decodeURIComponent(match[3]) };
};
