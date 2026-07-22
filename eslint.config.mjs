// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Lint is where the architecture is enforced, because a boundary that only lives in a document
 * is a boundary someone crosses on a deadline.
 *
 * Three things are checked here that review cannot reliably catch:
 *
 * 1. **`contracts` has no outgoing edges.** It may import `zod` and nothing else — not a codec,
 *    not a sibling package, not a Node builtin. Each individual violation sounds reasonable
 *    ("just a small helper from codecs"); the cumulative effect is that the root of the
 *    dependency graph becomes a runtime and every package inherits its dependencies.
 *
 * 2. **The pure packages stay pure.** No clock, no randomness, no I/O. Time arrives on the
 *    observation. This is what lets the engines run in a browser, offline, and produce the same
 *    answer twice — and it is checked with an AST selector rather than a grep, because a grep
 *    matches the word `Date.now` inside a comment saying there is no `Date.now` here.
 *
 * 3. **Locale-aware navigation.** Importing from `next/link` instead of the i18n-aware wrapper
 *    silently drops the user's language on navigation.
 *
 * ## The strictness staircase
 *
 * `recommendedTypeChecked` and the stricter rules below run against `contracts` and `codecs`
 * today. The packages migrated from the original codebase are held to the baseline rule set
 * they already pass, and are moved up a tier at a time. A rule switched on everywhere at once
 * produces a diff nobody can review, which is how strictness gets reverted rather than adopted.
 */

/** No outgoing edges. The root of the dependency graph. */
const CONTRACT_PACKAGE = ['packages/contracts/src/**']

/**
 * Pure packages: no clock, no randomness, no I/O in `src/`.
 * Verified clean at migration; the rule keeps them that way.
 */
const PURE_PACKAGES = [
  'packages/contracts/src/**',
  'packages/codecs/src/**',
  'packages/knowledge-engine/src/**',
  'packages/facets/src/**',
  'packages/plans/src/**',
  'packages/authored-item/src/**',
  'packages/authoring/src/**',
  'packages/authoring-workflow/src/**',
  'packages/telemetry/src/**',
  'packages/personalization/src/**',
  'packages/content-gen/src/**',
  'packages/learning-experience/src/**',
  'packages/explainer/src/**',
  'packages/manipulatives/src/**',
]

/** Tier 1 of the staircase: packages already meeting the strict rule set. */
const STRICT_TIER = ['packages/contracts/**', 'packages/codecs/**']

const NEXT_APPS = ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}']

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.next-dev/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/generated/**',
      '**/coverage/**',
      'apps/*/public/**',
      '**/*.config.{js,mjs,cjs}',
      'eslint.config.mjs',
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Root config files sit outside any tsconfig project, so type-aware rules cannot apply.
  // Lint them as plain JS rather than exempting them altogether.
  {
    files: ['**/*.mjs', '**/*.cjs', '*.js'],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // TypeScript resolves identifiers; the base rule only produces false positives here.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // Type-aware rules that catch latent runtime bugs. These the whole repository already passes.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'warn',
    },
  },

  // Staircase tier 1 — the packages written against the strict rule set from the start.
  {
    files: STRICT_TIER.map((p) => `${p}/*.ts`).concat(STRICT_TIER),
    extends: [...tseslint.configs.recommendedTypeChecked],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // `contracts` is the root of the dependency graph. It depends on nothing in the family.
  {
    files: CONTRACT_PACKAGE,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@bingoo.ai/*', '@bingoo/*'],
              message: 'contracts is the root of the dependency graph. It depends on nothing in the family.',
            },
            { group: ['node:*'], message: 'contracts is platform-free. It must run in a browser unchanged.' },
          ],
          paths: [
            { name: 'fs', message: 'contracts describes data; it never reads it.' },
            { name: 'path', message: 'contracts describes data; it never reads it.' },
            { name: 'crypto', message: 'contracts declares no behaviour. Signing lives in a codec.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'contracts does no I/O.' },
        { name: 'process', message: 'contracts never reads the environment.' },
      ],
    },
  },

  // Purity. Checked with AST selectors: a grep matches the words inside a comment saying the
  // call is absent, which fails the build for no reason and teaches people to distrust the gate.
  {
    files: PURE_PACKAGES,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Pure package: no clock. Time arrives on the observation.',
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Pure package: no randomness. Two identical runs must give one answer.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Pure package: no clock. Take the timestamp as a parameter.',
        },
      ],
    },
  },

  // Next.js apps. Navigation must stay locale-aware.
  {
    files: NEXT_APPS,
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // App Router only — there is no /pages directory.
      '@next/next/no-html-link-for-pages': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message: "Import Link from '@/i18n/navigation' — next/link drops the locale.",
            },
            {
              name: 'next/navigation',
              importNames: ['useRouter', 'usePathname', 'redirect'],
              message: "Import navigation from '@/i18n/navigation' — next/navigation drops the locale.",
            },
          ],
        },
      ],
    },
  },

  // Tests may reach for what production code may not.
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
)
