import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // android — generated native project, not hand-maintained here.
  // supabase/functions — Deno Edge Functions (Deno.serve, npm: specifiers,
  // no DOM/Node globals) — a different runtime than the rest of this repo,
  // linted (if at all) by `deno lint`, not this config.
  globalIgnores(['dist', 'android', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
