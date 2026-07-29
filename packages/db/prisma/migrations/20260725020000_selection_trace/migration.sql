-- CreateEnum
CREATE TYPE "TraceOrigin" AS ENUM ('LEARNER', 'SIMULATION');

-- CreateTable
CREATE TABLE "selection_trace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "origin" "TraceOrigin" NOT NULL DEFAULT 'LEARNER',
    "policy" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "exploreN" INTEGER NOT NULL,
    "daySeed" TEXT,
    "offered" INTEGER NOT NULL,
    "eligible" INTEGER NOT NULL,
    "considered" JSONB NOT NULL,
    "picked" TEXT[],
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selection_trace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "selection_trace_userId_at_idx" ON "selection_trace"("userId", "at");

-- CreateIndex
CREATE INDEX "selection_trace_origin_at_idx" ON "selection_trace"("origin", "at");

-- CreateIndex
CREATE INDEX "selection_trace_policy_idx" ON "selection_trace"("policy");
