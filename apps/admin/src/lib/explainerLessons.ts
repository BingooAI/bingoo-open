/**
 * explainerLessons.ts — the lesson STORE, on the server.
 *
 * Replaces the browser-local draft: a lesson now has an owner, survives a reload,
 * and opens on another machine. The pictures and the narration inside it are
 * already MediaAssets with permanent URLs, so re-opening a lesson plays what was
 * made — it never regenerates, and it never pays twice.
 */
import type { ExplainerDoc, LocaleBundle } from '@bingoo/explainer';
import { api } from './api-client';

export type LessonRow = {
  id: string;
  publicId: string;
  slug: string;
  title: string;
  status: 'DRAFT' | 'READY' | 'PUBLISHED';
  imagesDone: number;
  imagesTotal: number;
  audioDone: number;
  audioTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type LessonFull = LessonRow & { doc: ExplainerDoc; bundles: Record<string, LocaleBundle> };

export const listLessons = () => api.get<LessonRow[]>('/explainer/lessons');
export const getLesson = (id: string) => api.get<LessonFull>(`/explainer/lessons/${id}`);
export const deleteLesson = (id: string) =>
  api.del<{ deleted: boolean }>(`/explainer/lessons/${id}`);

export function saveLesson(input: {
  doc: ExplainerDoc;
  bundles: Record<string, LocaleBundle>;
  images: { done: number; total: number };
  audio: { done: number; total: number };
  status?: LessonRow['status'];
}) {
  return api.put<LessonRow>('/explainer/lessons', {
    slug: input.doc.meta.id,
    title: input.doc.meta.title,
    doc: input.doc,
    bundles: input.bundles,
    imagesDone: input.images.done,
    imagesTotal: input.images.total,
    audioDone: input.audio.done,
    audioTotal: input.audio.total,
    ...(input.status ? { status: input.status } : {}),
  });
}
