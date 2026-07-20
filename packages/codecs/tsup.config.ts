// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'tsup'

export default defineConfig({
  // One entry per subpath, not a single bundle. A consumer importing `/xapi` must not pull in
  // the CASE decoder — that is the whole reason this package uses subpath exports rather than
  // a root barrel (see ARCHITECTURE.md §2).
  entry: { 'case/index': 'src/case/index.ts', 'xapi/index': 'src/xapi/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
})
