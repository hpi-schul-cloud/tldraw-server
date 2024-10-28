import { RedisGuard } from './redis.guard.js';

describe('RedisInterface', () => {
	describe('isXItem', () => {
		describe('when passing type of value is a XItem', () => {
			const idBuffer = Buffer.from('id');
			const fieldBuffer = Buffer.from('field');
			const xItem = [idBuffer, [fieldBuffer]];

			it('should return true', () => {
				expect(RedisGuard.isXItem(xItem)).toBe(true);
			});
		});

		describe('when passing type of value is NOT a XItem', () => {
			it('should return false', () => {
				expect(RedisGuard.isXItem(undefined)).toBe(false);
			});

			it('should return false', () => {
				expect(RedisGuard.isXItem(null)).toBe(false);
			});

			it('should return false', () => {
				expect(RedisGuard.isXItem({})).toBe(false);
			});

			it('should return false', () => {
				expect(RedisGuard.isXItem(1)).toBe(false);
			});

			it('should return false', () => {
				expect(RedisGuard.isXItem([Buffer.from('id')])).toBe(false);
			});
		});
	});

	describe('isXItems', () => {
		describe('when passing type of value is a XItems', () => {
			const idBuffer = Buffer.from('id');
			const fieldBuffer = Buffer.from('field');
			const xItem = [idBuffer, [fieldBuffer]];
			const xItems = [xItem];

			it('should return true', () => {
				expect(RedisGuard.isXItems(xItems)).toBe(true);
			});
		});

		describe('when passing type of value is NOT a XItems', () => {
			it('should return false', () => {
				expect(RedisGuard.isXItems(undefined)).toBe(false);
			});

			it('should return false', () => {
				expect(RedisGuard.isXItems(null)).toBe(false);
			});

			it('should return false', () => {
				expect(RedisGuard.isXItems({})).toBe(false);
			});

			it('should return false', () => {
				expect(RedisGuard.isXItems(1)).toBe(false);
			});

			it('should return false', () => {
				const value = [[Buffer.from('id')]];

				expect(RedisGuard.isXItems(value)).toBe(false);
			});
		});
	});
});
