-- CreateTable
CREATE TABLE "learner_profile" (
    "userId" TEXT NOT NULL,
    "level" TEXT,
    "gradeBand" TEXT,
    "goals" TEXT,
    "interests" TEXT[],
    "streak" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "teacher_profile" (
    "userId" TEXT NOT NULL,
    "subjects" TEXT[],
    "bio" TEXT,
    "certifications" JSONB,
    "rating" DOUBLE PRECISION,
    "yearsExperience" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "parent_profile" (
    "userId" TEXT NOT NULL,
    "preferences" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "professional_profile" (
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "organizationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "activity_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_event_userId_createdAt_idx" ON "activity_event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_event_type_idx" ON "activity_event"("type");

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profile" ADD CONSTRAINT "teacher_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_profile" ADD CONSTRAINT "parent_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profile" ADD CONSTRAINT "professional_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

