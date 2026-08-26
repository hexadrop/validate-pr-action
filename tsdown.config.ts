import { isBuiltin } from 'node:module';

import { defineConfig } from 'tsdown';

export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: ['@actions/core', '@actions/github'],
		neverBundle: id => isBuiltin(id),
		onlyBundle: false,
	},
	entry: { index: 'src/main.ts' },
	format: 'esm',
	outDir: 'dist',
	outExtensions: ({ format: _format }) => ({ js: '.js' }),
	platform: 'node',
	target: 'node20',
});
