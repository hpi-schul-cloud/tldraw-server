import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jest from 'eslint-plugin-jest';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default [
	{
		ignores: ['**/.eslintrc.cjs', '**/ansible', '**/.github', 'src/infra/authorization/authorization-api-client'],
	},
	...compat.extends('plugin:@typescript-eslint/stylistic-type-checked', 'plugin:prettier/recommended'),
	{
		plugins: {
			'@typescript-eslint': typescriptEslintEslintPlugin,
			jest,
		},

		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest,
			},

			parser: tsParser,
			ecmaVersion: 5,
			sourceType: 'module',

			parserOptions: {
				project: 'tsconfig.json',
				tsconfigRootDir: '.',
			},
		},

		rules: {
			'newline-before-return': 'error',
			'require-await': 'error',
			'no-return-assign': 'error',
			'max-classes-per-file': 'error',
			'@typescript-eslint/explicit-member-accessibility': 'error',
			'@typescript-eslint/explicit-function-return-type': 'error',
			'@typescript-eslint/explicit-module-boundary-types': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/unbound-method': 'error',
			'@typescript-eslint/no-unused-vars': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',

			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'interface',
					format: ['PascalCase'],

					custom: {
						regex: '^I[A-Z]',
						match: false,
					},
				},
			],

			'@typescript-eslint/no-empty-interface': [
				'error',
				{
					allowSingleExtends: true,
				},
			],
		},
	},
	{
		files: ['**/*spec.ts'],

		plugins: {
			jest,
		},

		languageOptions: {
			globals: {
				...globals.jest,
			},
		},

		rules: {
			'@typescript-eslint/unbound-method': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'jest/unbound-method': 'error',
			'jest/prefer-spy-on': 'error',
		},
	},
];
