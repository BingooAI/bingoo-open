// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** ts-hook.mjs — register the TS resolve hook, then let the target script run. */
import { register } from 'node:module'
register(new URL('./loader-hooks.mjs', import.meta.url))
