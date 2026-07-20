-- Lịch sử đối chiếu: ai chốt hai khái niệm là MỘT, dựa vào đâu, máy đề xuất gì.
-- Không có bảng này thì quyết định GỘP — thứ vĩnh viễn và không suy ngược được từ đồ thị —
-- biến mất không dấu vết.

-- CreateTable
CREATE TABLE "alignment_decision" (
    "id" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "sourceTitle" JSONB NOT NULL,
    "subject" TEXT,
    "facets" JSONB,
    "targetSlug" TEXT,
    "proposedVerdict" TEXT,
    "proposedBy" TEXT,
    "proposedReason" TEXT,
    "verdict" TEXT NOT NULL,
    "decidedById" TEXT,
    "overridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alignment_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alignment_decision_sourceSlug_idx" ON "alignment_decision"("sourceSlug");

-- CreateIndex
CREATE INDEX "alignment_decision_targetSlug_idx" ON "alignment_decision"("targetSlug");

-- CreateIndex
CREATE INDEX "alignment_decision_verdict_idx" ON "alignment_decision"("verdict");

-- AddForeignKey
ALTER TABLE "alignment_decision" ADD CONSTRAINT "alignment_decision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

