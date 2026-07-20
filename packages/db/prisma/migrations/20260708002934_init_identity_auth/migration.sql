-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHILD', 'TEEN', 'ADULT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING_DELETION', 'DELETED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "username" TEXT,
    "displayUsername" TEXT,
    "publicId" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "accountType" "AccountType" NOT NULL DEFAULT 'ADULT',
    "dateOfBirth" TIMESTAMP(3),
    "country" TEXT,
    "locale" TEXT,
    "timezone" TEXT,
    "gender" TEXT,
    "managedByGuardian" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    "activeTeamId" TEXT,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'COMPANY',
    "parentId" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "inheritAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "teamId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "parentTeamId" TEXT,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardianship" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "relationship" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "consentAt" TIMESTAMP(3),
    "consentBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardianship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT,
    "subject" TEXT,
    "term" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_member" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "guardianApprovedById" TEXT,
    "guardianApprovedAt" TIMESTAMP(3),

    CONSTRAINT "relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "organizationId" TEXT,
    "classId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_publicId_key" ON "user"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_parentId_idx" ON "organization"("parentId");

-- CreateIndex
CREATE INDEX "organization_path_idx" ON "organization"("path");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "team_organizationId_idx" ON "team"("organizationId");

-- CreateIndex
CREATE INDEX "team_member_teamId_idx" ON "team_member"("teamId");

-- CreateIndex
CREATE INDEX "team_member_userId_idx" ON "team_member"("userId");

-- CreateIndex
CREATE INDEX "guardianship_childId_idx" ON "guardianship"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "guardianship_guardianId_childId_key" ON "guardianship"("guardianId", "childId");

-- CreateIndex
CREATE INDEX "class_organizationId_idx" ON "class"("organizationId");

-- CreateIndex
CREATE INDEX "class_member_userId_idx" ON "class_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "class_member_classId_userId_key" ON "class_member"("classId", "userId");

-- CreateIndex
CREATE INDEX "relationship_toUserId_idx" ON "relationship"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_fromUserId_toUserId_type_key" ON "relationship"("fromUserId", "toUserId", "type");

-- CreateIndex
CREATE INDEX "audit_log_actorUserId_idx" ON "audit_log"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_log_organizationId_idx" ON "audit_log"("organizationId");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardianship" ADD CONSTRAINT "guardianship_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardianship" ADD CONSTRAINT "guardianship_childId_fkey" FOREIGN KEY ("childId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_member" ADD CONSTRAINT "class_member_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_member" ADD CONSTRAINT "class_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

