// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig(
	{
		ignores: ['dist', 'node_modules'],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: 'module',
			globals: globals.browser,
			parser: tseslint.parser,
			parserOptions: {
				project: ['./tsconfig.node.json', './tsconfig.app.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': [
				'warn',
				{ allowConstantExport: true },
			],
		},
	},
	eslintConfigPrettier,
);
