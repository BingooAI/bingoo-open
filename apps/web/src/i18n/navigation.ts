// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Locale-aware navigation APIs. Always import <Link>, useRouter, usePathname &
 * redirect from here (never from `next/*`) so the active locale prefix is kept.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
