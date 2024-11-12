/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
			},
		],
	},
	moduleFileExtensions: ['js', 'json', 'ts'],
	rootDir: 'src',
	testRegex: '.*\\.spec\\.ts$',
	collectCoverageFrom: ['**/*.(t|j)s'],
	coverageDirectory: '../coverage',
	testEnvironment: 'node',
	globalSetup: '<rootDir>/../scripts/testing/globalSetup.ts',
	globalTeardown: '<rootDir>/../scripts/testing/globalTeardown.ts',
};
