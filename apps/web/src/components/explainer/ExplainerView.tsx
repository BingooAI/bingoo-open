// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { ExplainerPlayer } from '@bingoo.ai/explainer-web'
import '@bingoo.ai/explainer-web/styles.css'
import { ACCEPTANCE_DOC, ACCEPTANCE_BUNDLES } from '@/lib/explainerLesson'

/** Client host for the explainer player (the player is a "use client" tree). The
 *  `.exw` wrapper scopes the ported player styles + design-token CSS variables. */
export function ExplainerView() {
  return (
    <div className="exw">
      <div className="page">
        <ExplainerPlayer doc={ACCEPTANCE_DOC} bundles={ACCEPTANCE_BUNDLES} />
      </div>
    </div>
  )
}
