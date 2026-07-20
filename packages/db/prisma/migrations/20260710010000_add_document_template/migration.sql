-- Document templates (docs/media-library-design.md §6). Server-controlled
-- blueprints for high-quality AI document generation. Additive, self-contained.

CREATE TABLE "document_template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "docKind" TEXT NOT NULL,
    "scope" "MediaScope" NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "locale" TEXT,
    "sections" JSONB NOT NULL,
    "style" JSONB,
    "rubric" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_template_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_template_key_key" ON "document_template"("key");
CREATE INDEX "document_template_scope_scopeId_idx" ON "document_template"("scope", "scopeId");
CREATE INDEX "document_template_docKind_idx" ON "document_template"("docKind");
