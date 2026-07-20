-- Vector ngữ nghĩa của KC — CHỈ để TRUY HỒI ứng viên đối chiếu, KHÔNG BAO GIỜ để phán gộp.
-- Độ giống ngữ nghĩa là câu hỏi mờ; "có phải cùng một KC không" là câu hỏi nhị phân, quyết
-- bằng cấu trúc (facets) + người duyệt. Lẫn hai thứ này chính là gốc của mọi bug định danh.

-- CreateTable
CREATE TABLE "competency_embedding" (
    "id" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dim" INTEGER NOT NULL,
    "embedding" vector(1536),
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competency_embedding_competencyId_idx" ON "competency_embedding"("competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "competency_embedding_competencyId_model_key" ON "competency_embedding"("competencyId", "model");

-- AddForeignKey
ALTER TABLE "competency_embedding" ADD CONSTRAINT "competency_embedding_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

