-- Provenance cho authoring_plan: model + prompt (id + hash template hiệu lực) đã sinh bản doc.
-- Cột NULLABLE, thêm mới — bản cũ giữ NULL, không cần backfill; lùi = DROP COLUMN.
ALTER TABLE "authoring_plan" ADD COLUMN "aiModel" TEXT;
ALTER TABLE "authoring_plan" ADD COLUMN "promptId" TEXT;
ALTER TABLE "authoring_plan" ADD COLUMN "promptHash" TEXT;
