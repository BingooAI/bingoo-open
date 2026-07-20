-- CreateEnum
CREATE TYPE "ExplainerStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED');

-- CreateTable
CREATE TABLE "explainer_lesson" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "doc" JSONB NOT NULL,
    "bundles" JSONB NOT NULL,
    "status" "ExplainerStatus" NOT NULL DEFAULT 'DRAFT',
    "imagesDone" INTEGER NOT NULL DEFAULT 0,
    "imagesTotal" INTEGER NOT NULL DEFAULT 0,
    "audioDone" INTEGER NOT NULL DEFAULT 0,
    "audioTotal" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "explainer_lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "explainer_lesson_publicId_key" ON "explainer_lesson"("publicId");

-- CreateIndex
CREATE INDEX "explainer_lesson_createdById_updatedAt_idx" ON "explainer_lesson"("createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "explainer_lesson_status_idx" ON "explainer_lesson"("status");

-- CreateIndex
CREATE UNIQUE INDEX "explainer_lesson_createdById_slug_key" ON "explainer_lesson"("createdById", "slug");

-- AddForeignKey
ALTER TABLE "explainer_lesson" ADD CONSTRAINT "explainer_lesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
