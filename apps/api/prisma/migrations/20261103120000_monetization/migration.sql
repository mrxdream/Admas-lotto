-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PLUS', 'PREMIUM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable telegram_users
ALTER TABLE "telegram_users" ADD COLUMN IF NOT EXISTS "plan" "UserPlan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "telegram_users" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);

-- CreateTable platform_settings
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "limitsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "freeTicketLimit" INTEGER NOT NULL DEFAULT 5,
    "plusTicketLimit" INTEGER NOT NULL DEFAULT 15,
    "premiumTicketLimit" INTEGER NOT NULL DEFAULT 30,
    "plusPriceEtb" DECIMAL(12,2) NOT NULL DEFAULT 5,
    "premiumPriceEtb" DECIMAL(12,2) NOT NULL DEFAULT 15,
    "telebirrNumber" TEXT NOT NULL DEFAULT '',
    "telebirrName" TEXT NOT NULL DEFAULT '',
    "upgradeInfoAm" TEXT,
    "upgradeInfoEn" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_settings" ("id", "limitsEnabled", "freeTicketLimit", "plusTicketLimit", "premiumTicketLimit", "plusPriceEtb", "premiumPriceEtb", "telebirrNumber", "telebirrName", "updatedAt")
VALUES ('default', false, 5, 15, 30, 5, 15, '', '', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- CreateTable payment_requests
CREATE TABLE IF NOT EXISTS "payment_requests" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "requestedPlan" "UserPlan" NOT NULL,
    "amountEtb" DECIMAL(12,2) NOT NULL,
    "screenshotFileId" TEXT,
    "userNote" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_requests_status_idx" ON "payment_requests"("status");
CREATE INDEX IF NOT EXISTS "payment_requests_telegramUserId_idx" ON "payment_requests"("telegramUserId");

DO $$ BEGIN
  ALTER TABLE "payment_requests"
    ADD CONSTRAINT "payment_requests_telegramUserId_fkey"
    FOREIGN KEY ("telegramUserId") REFERENCES "telegram_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;