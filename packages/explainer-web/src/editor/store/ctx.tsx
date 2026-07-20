'use client';
import * as React from 'react';
import { createContext, useContext } from 'react';
import { type EditorStore, type Snapshot, useSnapshot } from './editorStore';

const Ctx = createContext<EditorStore | null>(null);

export function EditorProvider({
  store,
  children,
}: {
  store: EditorStore;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): EditorStore {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside EditorProvider');
  return s;
}

export function useSnap(): Snapshot {
  return useSnapshot(useStore());
}

/** Unique id for new document entities (editor session only, not persisted-sensitive). */
export function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 7)}`;
}
