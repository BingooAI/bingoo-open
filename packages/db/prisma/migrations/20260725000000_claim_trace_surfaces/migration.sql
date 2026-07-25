-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DecisionArtifact" ADD VALUE 'CONCEPT_EXISTS';
ALTER TYPE "DecisionArtifact" ADD VALUE 'LESSON_MAPPING';
ALTER TYPE "DecisionArtifact" ADD VALUE 'KC_PROPOSED';

-- AlterTable
ALTER TABLE "source_document" ADD COLUMN     "courseSlug" TEXT;

-- CreateIndex
CREATE INDEX "source_document_courseSlug_idx" ON "source_document"("courseSlug");

