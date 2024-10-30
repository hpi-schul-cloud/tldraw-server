import { XItem, XItems } from '../interfaces/redis.interface.js';
import { TypeGuard } from './type.guard.js';

export class RedisGuard {
	public static isXItem(value: unknown): value is XItem {
		if (!Array.isArray(value)) {
			return false;
		}

		const [id, fields] = value;

		const isBuffer =
			(Buffer.isBuffer(id) || TypeGuard.isString(id)) &&
			Array.isArray(fields) &&
			(fields.every((field) => Buffer.isBuffer(field)) || fields.every((field) => TypeGuard.isString(field)));

		return isBuffer;
	}

	public static checkXItem(value: unknown): XItem {
		if (!this.isXItem(value)) {
			throw new Error('Value is not a XItem');
		}

		return value;
	}

	public static isXItems(value: unknown): value is XItems {
		if (!Array.isArray(value)) {
			return false;
		}

		return value.every((item) => this.isXItem(item));
	}

	public static checkXItems(value: unknown): XItems {
		if (!this.isXItems(value)) {
			throw new Error('Value is not a XItems');
		}

		return value;
	}
}
