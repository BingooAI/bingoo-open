import {
  Archive,
  AudioLines,
  File,
  FileText,
  Film,
  Image as ImageIcon,
  Type,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { MediaKind } from '@bingoo/core';

const ICONS: Record<MediaKind, LucideIcon> = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  AUDIO: AudioLines,
  DOCUMENT: FileText,
  ANIMATION: Film,
  FONT: Type,
  ARCHIVE: Archive,
  OTHER: File,
};

export function kindIcon(kind: MediaKind): LucideIcon {
  return ICONS[kind] ?? File;
}

export function KindIcon({ kind, className }: { kind: MediaKind; className?: string }) {
  const Icon = kindIcon(kind);
  return <Icon className={className} />;
}
