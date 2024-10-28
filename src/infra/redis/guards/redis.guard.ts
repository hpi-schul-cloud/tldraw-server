import { XItem, XItems } from '../interfaces/redis.interface.js';

export class RedisGuard {
	static isXItem(value: unknown): value is XItem {
		if (!Array.isArray(value) || value.length !== 2) {
			return false;
		}

		const [id, fields] = value;

		const isBuffer = Buffer.isBuffer(id) && Array.isArray(fields) && fields.every(Buffer.isBuffer);

		return isBuffer;
	}

	static checkXItem(value: unknown): XItem {
		if (!this.isXItem(value)) {
			throw new Error('Value is not a XItem');
		}

		return value;
	}

	static isXItems(value: unknown): value is XItems {
		if (!Array.isArray(value)) {
			return false;
		}

		return value.every(this.isXItem);
	}

	static checkXItems(value: unknown): XItems {
		if (!this.isXItems(value)) {
			throw new Error('Value is not a XItems');
		}

		return value;
	}
}
