-- CreateEnum
CREATE TYPE "DecisionArtifact" AS ENUM ('OBJECTIVE_EXISTS', 'OBJECTIVE_COVERAGE', 'PREREQ_EDGE', 'CONCEPT_IDENTITY');

-- CreateEnum
CREATE TYPE "DecisionMethod" AS ENUM ('LLM', 'RULE_SCOPE', 'RULE_INVARIANT', 'TRIGRAM', 'HUMAN');

-- CreateEnum
CREATE TYPE "EvidenceBasis" AS ENUM ('FROM_SOURCE', 'STRUCTURAL', 'AI_INFERRED');

-- CreateEnum
CREATE TYPE "DecisionEvidenceKind" AS ENUM ('SOURCE_SPAN', 'STRUCTURAL_CHECK');

-- CreateEnum
CREATE TYPE "DecisionVerdict" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EDITED');

-- CreateTable
CREATE TABLE "source_document" (
    "id" TEXT NOT NULL,
    "frameworkVersionId" TEXT,
    "storageKey" TEXT,
    "excerptText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_record" (
    "id" TEXT NOT NULL,
    "artifact" "DecisionArtifact" NOT NULL,
    "subjectSlug" TEXT NOT NULL,
    "objectSlug" TEXT,
    "relType" TEXT,
    "claim" JSONB NOT NULL,
    "reason" JSONB,
    "method" "DecisionMethod" NOT NULL,
    "basis" "EvidenceBasis" NOT NULL,
    "checksPassed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checksFailed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verdict" "DecisionVerdict" NOT NULL DEFAULT 'PENDING',
    "overridden" BOOLEAN NOT NULL DEFAULT false,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "aiModel" TEXT,
    "promptHash" TEXT,
    "frameworkVersionId" TEXT,
    "sourceDocumentId" TEXT,
    "alignmentDecisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_evidence" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "kind" "DecisionEvidenceKind" NOT NULL,
    "basis" "EvidenceBasis" NOT NULL,
    "method" TEXT NOT NULL,
    "quote" TEXT,
    "chunkId" TEXT,
    "quoteVerified" BOOLEAN DEFAULT false,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "checkCode" TEXT,
    "passed" BOOLEAN,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_document_frameworkVersionId_idx" ON "source_document"("frameworkVersionId");

-- CreateIndex
CREATE INDEX "decision_record_artifact_subjectSlug_idx" ON "decision_record"("artifact", "subjectSlug");

-- CreateIndex
CREATE INDEX "decision_record_subjectSlug_idx" ON "decision_record"("subjectSlug");

-- CreateIndex
CREATE INDEX "decision_record_objectSlug_idx" ON "decision_record"("objectSlug");

-- CreateIndex
CREATE INDEX "decision_record_frameworkVersionId_idx" ON "decision_record"("frameworkVersionId");

-- CreateIndex
CREATE INDEX "decision_record_verdict_idx" ON "decision_record"("verdict");

-- CreateIndex
CREATE INDEX "decision_evidence_decisionId_idx" ON "decision_evidence"("decisionId");

-- CreateIndex
CREATE INDEX "decision_evidence_kind_idx" ON "decision_evidence"("kind");

-- AddForeignKey
ALTER TABLE "decision_record" ADD CONSTRAINT "decision_record_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_evidence" ADD CONSTRAINT "decision_evidence_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
