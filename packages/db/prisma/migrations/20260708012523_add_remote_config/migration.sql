-- CreateTable
CREATE TABLE "remote_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remote_config_pkey" PRIMARY KEY ("key")
);

