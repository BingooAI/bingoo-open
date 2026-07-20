-- Document export rendition kinds (docs/media-library-design.md §6.2): DOCX/PDF/
-- HTML are derived from the canonical Markdown ORIGINAL. Additive enum values
-- (safe; not used within this transaction).
ALTER TYPE "RenditionKind" ADD VALUE IF NOT EXISTS 'HTML';
ALTER TYPE "RenditionKind" ADD VALUE IF NOT EXISTS 'DOCX';
ALTER TYPE "RenditionKind" ADD VALUE IF NOT EXISTS 'PDF';
