-- Đồ thị năng lực + biên soạn (framework, competency.facets, domain_profile, observation…).
-- Những bảng này ĐÃ tồn tại trên CSDL thật vì trước đây dùng `db push` — tức là sửa thẳng
-- CSDL mà không để lại lịch sử. Migration này là bản ghi lịch sử còn thiếu: trên môi trường
-- thật nó được đánh dấu ĐÃ ÁP (migrate resolve --applied), còn CSDL MỚI thì chạy thật.

-- CreateEnum
CREATE TYPE "CompetencyKind" AS ENUM ('OBJECTIVE', 'OUTCOME', 'SKILL', 'KNOWLEDGE', 'PROCEDURE', 'BEHAVIOR', 'ATTITUDE', 'DISPOSITION');

-- CreateEnum
CREATE TYPE "PrereqMode" AS ENUM ('REQUIRED', 'RECOMMENDED');

-- CreateEnum
CREATE TYPE "CapabilityRelType" AS ENUM ('PREREQUISITE', 'ENABLES', 'COMPOSES', 'ALIGNS', 'VARIANT_OF', 'MAPS_TO');

-- CreateEnum
CREATE TYPE "FrameworkKind" AS ENUM ('CURRICULUM', 'CREDENTIAL', 'JOB_PROFILE');

-- CreateEnum
CREATE TYPE "FrameworkReleaseType" AS ENUM ('PATCH', 'MINOR', 'MAJOR');

-- CreateEnum
CREATE TYPE "FrameworkVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('QUIZ', 'PROJECT', 'RUBRIC', 'PEER', 'OBSERVATION', 'TIME');

-- CreateEnum
CREATE TYPE "ObservationSubject" AS ENUM ('LEARNER', 'TEACHER', 'CURRICULUM');

-- CreateEnum
CREATE TYPE "AssessmentMode" AS ENUM ('LEARN', 'MEASURE');

-- CreateEnum
CREATE TYPE "ContentItemStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED');

-- DropIndex
DROP INDEX "media_asset_search_idx";

-- DropIndex
DROP INDEX "media_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "competency" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "CompetencyKind" NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "parentId" TEXT,
    "level" INTEGER,
    "altitude" TEXT,
    "targetLevel" TEXT,
    "source" TEXT,
    "code" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "frameworkId" TEXT,
    "frameworkVersionId" TEXT,
    "stage" TEXT,
    "strand" TEXT,
    "subject" TEXT,
    "facets" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_relation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relType" "CapabilityRelType" NOT NULL,
    "mode" "PrereqMode" NOT NULL DEFAULT 'REQUIRED',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "capability_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "framework" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "kind" "FrameworkKind" NOT NULL DEFAULT 'CURRICULUM',
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT,
    "programId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "framework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "framework_version" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "major" INTEGER NOT NULL DEFAULT 1,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "patch" INTEGER NOT NULL DEFAULT 0,
    "releaseType" "FrameworkReleaseType" NOT NULL DEFAULT 'MAJOR',
    "status" "FrameworkVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "label" JSONB,
    "notes" JSONB,
    "source" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "framework_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation" (
    "id" TEXT NOT NULL,
    "subjectType" "ObservationSubject" NOT NULL DEFAULT 'LEARNER',
    "subjectId" TEXT,
    "userId" TEXT,
    "skillSlug" TEXT NOT NULL,
    "metric" TEXT,
    "source" "EvidenceSource" NOT NULL DEFAULT 'QUIZ',
    "outcome" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "mode" "AssessmentMode" NOT NULL DEFAULT 'LEARN',
    "itemKey" TEXT,
    "lang" TEXT,
    "latencyMs" INTEGER,
    "hintsUsed" INTEGER,
    "retry" INTEGER,
    "frameworkVersionId" TEXT,
    "knowledgePointId" TEXT,
    "attemptId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_state" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillSlug" TEXT NOT NULL,
    "pKnown" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "ability" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "fluency" DOUBLE PRECISION,
    "transfer" DOUBLE PRECISION,
    "independence" DOUBLE PRECISION,
    "level" TEXT,
    "competencyVersion" INTEGER,
    "frameworkVersionId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_snapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillSlug" TEXT NOT NULL,
    "pKnown" DOUBLE PRECISION NOT NULL,
    "ability" DOUBLE PRECISION NOT NULL,
    "level" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_item" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "skills" TEXT[],
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "mode" "AssessmentMode" NOT NULL DEFAULT 'LEARN',
    "measurable" BOOLEAN NOT NULL DEFAULT true,
    "primitiveKind" TEXT NOT NULL,
    "lessonSlug" TEXT,
    "payload" JSONB NOT NULL,
    "status" "ContentItemStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srs_card_state" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "dueDay" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srs_card_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authoring_pipeline" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authoring_pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authoring_step" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "parents" TEXT[],
    "builtFrom" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authoring_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "frameworkVersionId" TEXT,
    "plan" JSONB NOT NULL,
    "status" "ContentItemStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_profile" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "requiredAxes" TEXT[],
    "identityAxes" TEXT[] DEFAULT ARRAY['object', 'scope']::TEXT[],
    "aliases" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_slug_key" ON "competency"("slug");

-- CreateIndex
CREATE INDEX "competency_frameworkId_idx" ON "competency"("frameworkId");

-- CreateIndex
CREATE INDEX "competency_frameworkVersionId_idx" ON "competency"("frameworkVersionId");

-- CreateIndex
CREATE INDEX "competency_kind_idx" ON "competency"("kind");

-- CreateIndex
CREATE INDEX "competency_parentId_idx" ON "competency"("parentId");

-- CreateIndex
CREATE INDEX "capability_relation_fromId_idx" ON "capability_relation"("fromId");

-- CreateIndex
CREATE INDEX "capability_relation_toId_idx" ON "capability_relation"("toId");

-- CreateIndex
CREATE INDEX "capability_relation_relType_idx" ON "capability_relation"("relType");

-- CreateIndex
CREATE UNIQUE INDEX "capability_relation_fromId_toId_relType_key" ON "capability_relation"("fromId", "toId", "relType");

-- CreateIndex
CREATE UNIQUE INDEX "framework_slug_key" ON "framework"("slug");

-- CreateIndex
CREATE INDEX "framework_version_frameworkId_status_idx" ON "framework_version"("frameworkId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "framework_version_frameworkId_major_minor_patch_key" ON "framework_version"("frameworkId", "major", "minor", "patch");

-- CreateIndex
CREATE UNIQUE INDEX "observation_attemptId_key" ON "observation"("attemptId");

-- CreateIndex
CREATE INDEX "observation_userId_skillSlug_idx" ON "observation"("userId", "skillSlug");

-- CreateIndex
CREATE INDEX "observation_userId_at_idx" ON "observation"("userId", "at");

-- CreateIndex
CREATE INDEX "observation_subjectType_subjectId_idx" ON "observation"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "skill_state_userId_idx" ON "skill_state"("userId");

-- CreateIndex
CREATE INDEX "skill_state_skillSlug_idx" ON "skill_state"("skillSlug");

-- CreateIndex
CREATE INDEX "skill_state_frameworkVersionId_idx" ON "skill_state"("frameworkVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_state_userId_skillSlug_key" ON "skill_state"("userId", "skillSlug");

-- CreateIndex
CREATE INDEX "skill_snapshot_userId_skillSlug_at_idx" ON "skill_snapshot"("userId", "skillSlug", "at");

-- CreateIndex
CREATE UNIQUE INDEX "content_item_itemKey_key" ON "content_item"("itemKey");

-- CreateIndex
CREATE INDEX "content_item_primitiveKind_idx" ON "content_item"("primitiveKind");

-- CreateIndex
CREATE INDEX "content_item_status_idx" ON "content_item"("status");

-- CreateIndex
CREATE INDEX "content_item_lessonSlug_idx" ON "content_item"("lessonSlug");

-- CreateIndex
CREATE INDEX "srs_card_state_userId_dueDay_idx" ON "srs_card_state"("userId", "dueDay");

-- CreateIndex
CREATE UNIQUE INDEX "srs_card_state_userId_itemKey_key" ON "srs_card_state"("userId", "itemKey");

-- CreateIndex
CREATE INDEX "authoring_step_pipelineId_idx" ON "authoring_step"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "authoring_step_pipelineId_stepKey_key" ON "authoring_step"("pipelineId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "course_slug_key" ON "course"("slug");

-- CreateIndex
CREATE INDEX "course_frameworkVersionId_idx" ON "course"("frameworkVersionId");

-- CreateIndex
CREATE INDEX "course_status_idx" ON "course"("status");

-- CreateIndex
CREATE UNIQUE INDEX "domain_profile_domain_key" ON "domain_profile"("domain");

-- AddForeignKey
ALTER TABLE "competency" ADD CONSTRAINT "competency_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency" ADD CONSTRAINT "competency_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency" ADD CONSTRAINT "competency_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "framework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency" ADD CONSTRAINT "competency_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "framework_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_relation" ADD CONSTRAINT "capability_relation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_relation" ADD CONSTRAINT "capability_relation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "framework_version" ADD CONSTRAINT "framework_version_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "framework_version" ADD CONSTRAINT "framework_version_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "framework_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_state" ADD CONSTRAINT "skill_state_frameworkVersionId_fkey" FOREIGN KEY ("frameworkVersionId") REFERENCES "framework_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authoring_step" ADD CONSTRAINT "authoring_step_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "authoring_pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

