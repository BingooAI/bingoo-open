-- CreateTable
CREATE TABLE "segment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_segment" (
    "segmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_segment_pkey" PRIMARY KEY ("segmentId","userId")
);

-- CreateTable
CREATE TABLE "community" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "joinPolicy" TEXT NOT NULL DEFAULT 'request',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_member" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "moderatorApprovedAt" TIMESTAMP(3),
    "guardianApprovedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "segment_key_key" ON "segment"("key");

-- CreateIndex
CREATE INDEX "user_segment_userId_idx" ON "user_segment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_slug_key" ON "community"("slug");

-- CreateIndex
CREATE INDEX "community_member_userId_idx" ON "community_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_member_communityId_userId_key" ON "community_member"("communityId", "userId");

-- AddForeignKey
ALTER TABLE "user_segment" ADD CONSTRAINT "user_segment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_segment" ADD CONSTRAINT "user_segment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

