-- Kế hoạch biên soạn phân cấp (Khoá→Unit→Bài) + trạng thái duyệt — context chảy xuống, cổng duyệt.

-- CreateTable
CREATE TABLE "authoring_plan" (
    "id" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "refSlug" TEXT NOT NULL,
    "doc" JSONB NOT NULL,
    "status" "ContentItemStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "quality" JSONB,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authoring_plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "authoring_plan_courseSlug_idx" ON "authoring_plan"("courseSlug");

-- CreateIndex
CREATE INDEX "authoring_plan_status_idx" ON "authoring_plan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "authoring_plan_courseSlug_level_refSlug_key" ON "authoring_plan"("courseSlug", "level", "refSlug");

