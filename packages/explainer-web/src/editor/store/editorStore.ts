// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * editorStore.ts — the editor's single source of truth (editor-spec §3.2).
 * Holds { doc, bundles } + undo/redo stacks + ephemeral UI state. Every doc
 * mutation goes through `dispatch(op)`; drags coalesce into one undo step.
 * Autosaves to localStorage. Exposed to React via useSyncExternalStore.
 */
'use client'
import { useSyncExternalStore } from 'react'
import type { ExplainerDoc, LocaleBundle, Aspect } from '@bingoo.ai/explainer'
import { applyOp, applyBatch, type EditOp, type EditState } from './ops'

export type AspectMode = Aspect | 'dual'
export type LeftTab = 'scenes' | 'layers' | 'library'
export type BottomTab = 'timeline' | 'narration' | 'lint'

export type UIState = {
  selection: string | null // element id
  selectedBeat: string | null
  connecting: boolean // "draw flow" mode: click two shapes to connect them
  connectFrom: string | null // first shape picked while connecting
  activeSceneId: string
  activeLocale: string
  t: number // playhead (scene-local seconds)
  aspect: AspectMode
  previewing: boolean
  leftTab: LeftTab
  bottomTab: BottomTab
  drawMode: boolean
  showRegions: boolean
  /** set by a double-click on an image element → ImageProps opens the media
   *  picker. Cleared once consumed. */
  pickImageFor?: string | null
  /** open the lesson-level background settings dialog (doc.background). */
  showBackground?: boolean
}

export type Snapshot = {
  doc: ExplainerDoc
  bundles: Record<string, LocaleBundle>
  ui: UIState
  canUndo: boolean
  canRedo: boolean
}

export type EditorStore = ReturnType<typeof createEditorStore>

const KEY = (id: string) => `explainer-editor:${id}`

export function createEditorStore(initial: EditState) {
  let doc = initial.doc
  let bundles = initial.bundles
  let undo: EditOp[] = []
  let redo: EditOp[] = []
  let coalesceKey: string | null = null

  const ui: UIState = {
    selection: null,
    selectedBeat: null,
    connecting: false,
    connectFrom: null,
    activeSceneId: doc.scenes[0]?.id ?? '',
    activeLocale: doc.meta.defaultLocale,
    t: 0,
    aspect: '16:9',
    previewing: false,
    leftTab: 'scenes',
    bottomTab: 'timeline',
    drawMode: false,
    showRegions: false,
  }

  let snap: Snapshot = build()
  const listeners = new Set<() => void>()

  function build(): Snapshot {
    return { doc, bundles, ui: { ...ui }, canUndo: undo.length > 0, canRedo: redo.length > 0 }
  }
  function emit() {
    snap = build()
    listeners.forEach((l) => l())
    save()
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function save() {
    if (typeof window === 'undefined') return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY(doc.meta.id), JSON.stringify({ doc, bundles }))
      } catch {
        /* quota / private mode — ignore */
      }
    }, 400)
  }

  return {
    subscribe(cb: () => void) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getSnapshot: () => snap,

    /** Apply a doc op. Pass `coalesce` so a burst (e.g. a drag) is one undo. */
    dispatch(op: EditOp, coalesce?: string) {
      const { state, inverse } = applyOp({ doc, bundles }, op)
      doc = state.doc
      bundles = state.bundles
      if (coalesce && coalesce === coalesceKey) {
        // same interaction → keep the original inverse, don't grow the stack
      } else {
        undo.push(inverse)
        coalesceKey = coalesce ?? null
      }
      redo = []
      emit()
    },
    endCoalesce() {
      coalesceKey = null
    },
    batch(ops: EditOp[]) {
      const { state, inverse } = applyBatch({ doc, bundles }, ops)
      doc = state.doc
      bundles = state.bundles
      // push inverses as a group marker: store as a single combined op list via meta
      inverse.forEach((iv) => undo.push(iv))
      undo.push({ t: '__batch', n: inverse.length } as unknown as EditOp)
      redo = []
      coalesceKey = null
      emit()
    },

    undo() {
      if (undo.length === 0) return
      const top = undo.pop()! as EditOp & { t: string; n?: number }
      const runOne = (iv: EditOp) => {
        const { state, inverse } = applyOp({ doc, bundles }, iv)
        doc = state.doc
        bundles = state.bundles
        redo.push(inverse)
      }
      if ((top as { t: string }).t === '__batch') {
        const n = (top as { n: number }).n
        for (let i = 0; i < n; i++) runOne(undo.pop()!)
      } else {
        runOne(top)
      }
      coalesceKey = null
      emit()
    },
    redo() {
      if (redo.length === 0) return
      const iv = redo.pop()!
      const { state, inverse } = applyOp({ doc, bundles }, iv)
      doc = state.doc
      bundles = state.bundles
      undo.push(inverse)
      coalesceKey = null
      emit()
    },

    setUI(patch: Partial<UIState>) {
      Object.assign(ui, patch)
      emit()
    },

    load(state: EditState) {
      doc = state.doc
      bundles = state.bundles
      undo = []
      redo = []
      coalesceKey = null
      ui.selection = null
      ui.activeSceneId = doc.scenes[0]?.id ?? ''
      ui.activeLocale = doc.meta.defaultLocale
      ui.t = 0
      emit()
    },
    exportJSON(): string {
      return JSON.stringify({ doc, bundles }, null, 2)
    },
    raw: () => ({ doc, bundles }),
  }
}

/** Load a previously autosaved edit state for a doc id, if present. */
export function loadSaved(docId: string): EditState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY(docId))
    return raw ? (JSON.parse(raw) as EditState) : null
  } catch {
    return null
  }
}

export function useSnapshot(store: EditorStore): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
