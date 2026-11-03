-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('DRAFT', 'VERIFIED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "lottery_draws" (
    "id" TEXT NOT NULL,
    "drawCode" TEXT NOT NULL,
    "drawDateText" TEXT NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceReference" TEXT,
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lottery_draws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draw_prizes" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "prizeName" TEXT NOT NULL,
    "winningNumber" TEXT NOT NULL,
    "prizeAmount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draw_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lottery_draws_drawCode_key" ON "lottery_draws"("drawCode");

-- CreateIndex
CREATE INDEX "lottery_draws_status_idx" ON "lottery_draws"("status");

-- CreateIndex
CREATE INDEX "lottery_draws_drawDateText_idx" ON "lottery_draws"("drawDateText");

-- CreateIndex
CREATE INDEX "draw_prizes_drawId_idx" ON "draw_prizes"("drawId");

-- CreateIndex
CREATE UNIQUE INDEX "draw_prizes_drawId_prizeName_winningNumber_key" ON "draw_prizes"("drawId", "prizeName", "winningNumber");

-- AddForeignKey
ALTER TABLE "draw_prizes" ADD CONSTRAINT "draw_prizes_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "lottery_draws"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
