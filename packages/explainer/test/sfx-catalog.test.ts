// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * The sound catalog is a list of names, and these tests exist to keep it one.
 *
 * The original pack was removed because its licence could not be traced, but the names
 * survived — and a name is one convenience away from becoming a URL again. The assertions
 * below are the negative kind: they fail when audio *reappears* in the repository, which is
 * the mistake worth catching, not when it is absent.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SFX_NAMES, SFX_META, isSfxName, sfxUrl } from '../src/sfx-catalog'

const source = readFileSync(fileURLToPath(new URL('../src/sfx-catalog.ts', import.meta.url)), 'utf8')

describe('no audio is distributed with this package', () => {
  it('hardcodes no host', () => {
    // A remote URL here would redistribute the clips by reference — the same licence problem
    // the removal was meant to solve, only harder to notice in a diff.
    expect(source).not.toMatch(/https?:\/\//)
  })

  it('resolves to nothing when the deployment has configured no pack', () => {
    expect(sfxUrl('correct', undefined)).toBeUndefined()
    // A `.env` line with nothing after the `=` reaches here as an empty string, not undefined.
    expect(sfxUrl('correct', '')).toBeUndefined()
  })

  it('carries no url on the editor metadata', () => {
    // SFX_META is built at module load. A url baked in there could not depend on deployment
    // config even if the catalog itself stayed clean.
    for (const m of SFX_META) expect(m).not.toHaveProperty('url')
  })
})

describe('names stay portable', () => {
  it('resolves against whatever base the host serves', () => {
    expect(sfxUrl('correct', 'https://example.test/pack')).toBe('https://example.test/pack/correct.mp3')
    expect(sfxUrl('correct', '/sfx')).toBe('/sfx/correct.mp3')
  })

  it('tolerates a trailing slash on the base', () => {
    // Both spellings appear in real .env files; neither should produce a double slash.
    expect(sfxUrl('correct', '/sfx/')).toBe('/sfx/correct.mp3')
  })

  it('refuses a name that is not in the catalog', () => {
    // An invented name must not resolve, or a typo silently 404s at play time instead of
    // being caught by the authoring lint.
    expect(sfxUrl('not_a_real_sound', '/sfx')).toBeUndefined()
    expect(isSfxName('not_a_real_sound')).toBe(false)
    expect(isSfxName('correct')).toBe(true)
  })

  it('keeps every name usable as a filename', () => {
    // Names become path segments. Anything needing escaping would break on some host.
    for (const n of SFX_NAMES) expect(n).toMatch(/^[a-z0-9_]+$/)
  })

  it('has no duplicates', () => {
    expect(new Set(SFX_NAMES).size).toBe(SFX_NAMES.length)
  })

  it('describes every name', () => {
    expect(SFX_META).toHaveLength(SFX_NAMES.length)
    for (const m of SFX_META) expect(m.label.trim()).not.toBe('')
  })
})
