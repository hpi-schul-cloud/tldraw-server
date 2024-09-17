module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: 'tsconfig.json',
		tsconfigRootDir: __dirname,
		sourceType: 'module',
	},
	plugins: ['@typescript-eslint/eslint-plugin', 'jest'],
	// https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/stylistic-type-checked.ts
	extends: ['plugin:@typescript-eslint/stylistic-type-checked', 'plugin:prettier/recommended'],
	root: true,
	env: {
		node: true,
		jest: true,
	},
	ignorePatterns: ['.eslintrc.cjs'],
	rules: {
    "require-await": "error",
    "no-return-assign": "error",
    "max-classes-per-file": 'error',
    "@typescript-eslint/explicit-member-accessibility": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
		'@typescript-eslint/explicit-module-boundary-types': 'error',
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/unbound-method': 'error',
		'@typescript-eslint/no-unused-vars': 'error',
    "@typescript-eslint/no-non-null-assertion": "error",
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
  overrides: [
    {
      files: ['**/*spec.ts'],
      plugins: ['jest'],
      env: {
        jest: true,
      },
      rules: {
        // you should turn the original rule off *only* for test files
        '@typescript-eslint/unbound-method': 'off',
        "@typescript-eslint/explicit-function-return-type": "off",
        'jest/unbound-method': 'error',
        'jest/prefer-spy-on': 'error',
      },
    },
  ],
};
