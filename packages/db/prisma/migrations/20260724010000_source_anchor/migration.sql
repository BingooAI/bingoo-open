-- AlterTable
ALTER TABLE "source_document" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "pageCount" INTEGER;

-- AlterTable
ALTER TABLE "decision_evidence" ADD COLUMN     "anchorContentHash" TEXT,
ADD COLUMN     "anchorKind" TEXT,
ADD COLUMN     "anchorLocator" JSONB;
