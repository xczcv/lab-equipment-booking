import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['**/dist', '.local', '.stryker-tmp', 'reports', 'coverage']),
  js.configs.recommended,
  { files: ['**/*.js'], languageOptions: { globals: globals.node } },
]);
