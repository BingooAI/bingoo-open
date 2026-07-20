-- Media library (docs/media-library-design.md).
-- Self-contained domain: every FK points at another media table, so this
-- migration never touches the AAA-core tables. pgvector + a GENERATED tsvector
-- column power the hybrid search organisation (invariant M2) — these are
-- hand-authored here because Prisma has no native vector/generated-column support
-- (the schema marks them Unsupported so Prisma leaves them alone).

-- Semantic search needs pgvector. Available on Neon via the extensions allowlist.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ANIMATION', 'FONT', 'ARCHIVE', 'OTHER');
CREATE TYPE "MediaStatus" AS ENUM ('DRAFT', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');
CREATE TYPE "MediaScope" AS ENUM ('GLOBAL', 'ORG', 'CLASS', 'COMMUNITY', 'USER');
CREATE TYPE "MediaVisibility" AS ENUM ('PRIVATE', 'SCOPE', 'PUBLIC');
CREATE TYPE "RenditionKind" AS ENUM ('ORIGINAL', 'OPTIMIZED', 'THUMBNAIL', 'PREVIEW', 'POSTER', 'HLS', 'WAVEFORM', 'TRANSCRIPT');
CREATE TYPE "GrantSubjectType" AS ENUM ('USER', 'ORG', 'TEAM', 'ROLE', 'SERVICE', 'PUBLIC');
CREATE TYPE "MediaPermission" AS ENUM ('VIEW', 'USE', 'EDIT', 'MANAGE');
CREATE TYPE "TagKind" AS ENUM ('SUBJECT', 'GRADE_BAND', 'TOPIC', 'STYLE', 'LANGUAGE', 'LICENSE', 'AGE_RATING', 'SOURCE', 'ENTITY', 'KEYWORD', 'FORMAT');
CREATE TYPE "TagRelType" AS ENUM ('BROADER', 'RELATED', 'ALIAS');
CREATE TYPE "AssetRelType" AS ENUM ('DERIVED_FROM', 'VARIANT_OF', 'PART_OF', 'TRANSCRIPT_OF', 'THUMBNAIL_OF', 'REPLACES');
CREATE TYPE "TagSource" AS ENUM ('MANUAL', 'AI', 'IMPORT');

-- CreateTable
CREATE TABLE "media_folder" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "slug" TEXT,
    "description" JSONB,
    "parentId" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "scope" "MediaScope" NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'SCOPE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'DRAFT',
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderationReason" TEXT,
    "folderId" TEXT,
    "scope" "MediaScope" NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'SCOPE',
    "title" JSONB NOT NULL,
    "description" JSONB,
    "altText" JSONB,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "pageCount" INTEGER,
    "dominantColor" TEXT,
    "locale" TEXT,
    "license" TEXT,
    "ageRating" TEXT,
    "source" TEXT,
    "createdById" TEXT,
    "ownerId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "keywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- Full-text projection (invariant M2): a tsvector over the localised
-- title/description + denormalised keyword slugs, maintained by a trigger.
-- Config `simple` avoids a language stemmer picking the wrong stems for
-- Vietnamese; recall is widened by the tag ALIAS/BROADER graph at query time.
-- NB: a GENERATED column can't be used here — the text→regconfig cast inside
-- to_tsvector is only STABLE, so Postgres rejects it as a generation expression.
-- A trigger has no immutability requirement and keeps the column always in sync.
ALTER TABLE "media_asset" ADD COLUMN "searchVector" tsvector;

CREATE OR REPLACE FUNCTION media_asset_tsv() RETURNS trigger AS $$
BEGIN
    NEW."searchVector" := to_tsvector('simple',
        coalesce(NEW."title"->>'vi', '') || ' ' ||
        coalesce(NEW."title"->>'en', '') || ' ' ||
        coalesce(NEW."description"->>'vi', '') || ' ' ||
        coalesce(NEW."description"->>'en', '') || ' ' ||
        coalesce(array_to_string(NEW."keywords", ' '), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_asset_tsv_trg
    BEFORE INSERT OR UPDATE OF "title", "description", "keywords"
    ON "media_asset"
    FOR EACH ROW EXECUTE FUNCTION media_asset_tsv();

-- CreateTable
CREATE TABLE "media_rendition" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "RenditionKind" NOT NULL,
    "provider" TEXT,
    "storageKey" TEXT,
    "videoId" TEXT,
    "url" TEXT,
    "checksum" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "bitrate" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_rendition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_grant" (
    "id" TEXT NOT NULL,
    "subjectType" "GrantSubjectType" NOT NULL,
    "subjectId" TEXT,
    "permission" "MediaPermission" NOT NULL,
    "folderId" TEXT,
    "assetId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL,
    "label" JSONB NOT NULL,
    "description" JSONB,
    "parentId" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "externalRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_relation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relType" "TagRelType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "tag_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_tag" (
    "assetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" "TagSource" NOT NULL DEFAULT 'MANUAL',
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_tag_pkey" PRIMARY KEY ("assetId","tagId")
);

-- CreateTable
CREATE TABLE "media_asset_relation" (
    "id" TEXT NOT NULL,
    "fromAssetId" TEXT NOT NULL,
    "toAssetId" TEXT NOT NULL,
    "relType" "AssetRelType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_asset_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "scope" "MediaScope" NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "isSmart" BOOLEAN NOT NULL DEFAULT false,
    "query" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_item" (
    "collectionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_item_pkey" PRIMARY KEY ("collectionId","assetId")
);

-- CreateTable
CREATE TABLE "media_embedding" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dim" INTEGER NOT NULL,
    "embedding" vector(1536),
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_folder_parentId_idx" ON "media_folder"("parentId");
CREATE INDEX "media_folder_path_idx" ON "media_folder"("path");
CREATE INDEX "media_folder_scope_scopeId_idx" ON "media_folder"("scope", "scopeId");
CREATE UNIQUE INDEX "media_asset_publicId_key" ON "media_asset"("publicId");
CREATE INDEX "media_asset_folderId_idx" ON "media_asset"("folderId");
CREATE INDEX "media_asset_scope_scopeId_idx" ON "media_asset"("scope", "scopeId");
CREATE INDEX "media_asset_kind_idx" ON "media_asset"("kind");
CREATE INDEX "media_asset_status_moderation_idx" ON "media_asset"("status", "moderation");
CREATE INDEX "media_asset_keywords_idx" ON "media_asset" USING GIN ("keywords");
-- Lexical search index over the generated tsvector column.
CREATE INDEX "media_asset_search_idx" ON "media_asset" USING GIN ("searchVector");
CREATE INDEX "media_rendition_assetId_idx" ON "media_rendition"("assetId");
CREATE UNIQUE INDEX "media_rendition_assetId_kind_key" ON "media_rendition"("assetId", "kind");
CREATE INDEX "media_grant_subjectType_subjectId_idx" ON "media_grant"("subjectType", "subjectId");
CREATE INDEX "media_grant_folderId_idx" ON "media_grant"("folderId");
CREATE INDEX "media_grant_assetId_idx" ON "media_grant"("assetId");
CREATE UNIQUE INDEX "media_grant_folderId_subjectType_subjectId_permission_key" ON "media_grant"("folderId", "subjectType", "subjectId", "permission");
CREATE UNIQUE INDEX "media_grant_assetId_subjectType_subjectId_permission_key" ON "media_grant"("assetId", "subjectType", "subjectId", "permission");
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("slug");
CREATE INDEX "tag_kind_idx" ON "tag"("kind");
CREATE INDEX "tag_parentId_idx" ON "tag"("parentId");
CREATE INDEX "tag_path_idx" ON "tag"("path");
CREATE INDEX "tag_relation_toId_idx" ON "tag_relation"("toId");
CREATE UNIQUE INDEX "tag_relation_fromId_toId_relType_key" ON "tag_relation"("fromId", "toId", "relType");
CREATE INDEX "media_tag_tagId_idx" ON "media_tag"("tagId");
CREATE INDEX "media_asset_relation_toAssetId_idx" ON "media_asset_relation"("toAssetId");
CREATE UNIQUE INDEX "media_asset_relation_fromAssetId_toAssetId_relType_key" ON "media_asset_relation"("fromAssetId", "toAssetId", "relType");
CREATE INDEX "collection_scope_scopeId_idx" ON "collection"("scope", "scopeId");
CREATE INDEX "collection_item_assetId_idx" ON "collection_item"("assetId");
CREATE INDEX "media_embedding_assetId_idx" ON "media_embedding"("assetId");
CREATE UNIQUE INDEX "media_embedding_assetId_model_key" ON "media_embedding"("assetId", "model");
-- Approximate-nearest-neighbour index for semantic search (cosine distance).
CREATE INDEX "media_embedding_hnsw_idx" ON "media_embedding" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "media_folder" ADD CONSTRAINT "media_folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "media_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_rendition" ADD CONSTRAINT "media_rendition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_grant" ADD CONSTRAINT "media_grant_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_grant" ADD CONSTRAINT "media_grant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tag" ADD CONSTRAINT "tag_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tag_relation" ADD CONSTRAINT "tag_relation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tag_relation" ADD CONSTRAINT "tag_relation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_tag" ADD CONSTRAINT "media_tag_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_tag" ADD CONSTRAINT "media_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_asset_relation" ADD CONSTRAINT "media_asset_relation_fromAssetId_fkey" FOREIGN KEY ("fromAssetId") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_asset_relation" ADD CONSTRAINT "media_asset_relation_toAssetId_fkey" FOREIGN KEY ("toAssetId") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_embedding" ADD CONSTRAINT "media_embedding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
