// @ts-check

import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default defineConfig(
	globalIgnores(['dist', 'node_modules', 'build']),
	{
		files: ['**/*.{ts,tsx}'],
		extends: [
			eslint.configs.recommended,
			...tseslint.configs.recommendedTypeChecked,
			reactHooks.configs.flat.recommended,
			eslintPluginPrettier
		],
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
);
